/**
 * 桌面启动 / 热更完成后：CEP 扩展落盘自检与刷新。
 * 比较 app 版本 vs 已安装 CEP 副本（version.json）；不一致则重拷刷新。
 *
 * 单副本策略（与 NSIS installer.nsh 对齐，§9）：
 *   - 安装作用域由「Common Files 副本是否存在且认领」判定（win32），
 *     mac / 无 Common Files 一律用户级 —— 与安装器 customInit 的探测口径一致。
 *   - 系统级（Common Files 副本存在）：只维护 Common Files，绝不在用户级重新播种，
 *     并兜底删除可能残留的用户级副本（避免双副本 + AE 用户级优先级遮挡系统级）。
 *   - 用户级（无 Common Files 副本）：仅维护 %APPDATA% 用户级，并尽力清掉残留的系统级副本。
 * 只动 EXT_ID 子目录，不误删用户其它扩展。
 */

const path = require('path')
const fs = require('fs')
const {
  EXT_ID,
  compareVersions,
  refreshExtFromPayload,
  readVersionJson,
  isOwnedExtDir,
  removeOwnedExtDir
} = require('./cep-payload-common')

/** payload 源目录：打包后 resources/cep/EXT_ID；开发态回退 build/cep-payload/EXT_ID */
function resolvePayloadDir (resourcesPath, appPath) {
  const candidates = []
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, 'cep', EXT_ID))
  }
  if (appPath) {
    candidates.push(path.join(appPath, 'build', 'cep-payload', EXT_ID))
    candidates.push(path.join(appPath, 'resources', 'cep', EXT_ID))
  }
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'CSXS', 'manifest.xml'))) return dir
    } catch (e) { /* next */ }
  }
  return null
}

/** 用户级 CEP 扩展父目录（Windows %APPDATA%；mac ~/Library/Application Support） */
function resolveUserExtParent (env, home) {
  const e = env || process.env
  if (process.platform === 'darwin') {
    const h = home || require('os').homedir()
    return path.join(h, 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions')
  }
  // win32 / linux 皆用 APPDATA 风格；linux 下若无则回退 ~/.adobe/cep
  if (e.APPDATA) {
    return path.join(e.APPDATA, 'Adobe', 'CEP', 'extensions')
  }
  const h = home || require('os').homedir()
  return path.join(h, '.adobe', 'CEP', 'extensions')
}

/** 管理员安装时的 Common Files 落盘（仅当已存在本扩展时同步刷新） */
function resolveCommonExtParent (env, commonFiles) {
  const e = env || process.env
  const base = commonFiles || e.CommonProgramFiles || e.COMMONPROGRAMFILES
  if (!base) return null
  return path.join(base, 'Adobe', 'CEP', 'extensions')
}

/**
 * 判定当前安装作用域：系统级（Common Files 副本存在且认领）或用户级。
 * 与 NSIS installer.nsh::ispartaResolveScope / customInit 的探测口径一致：
 * mac / 无 CommonProgramFiles 环境无系统级概念，一律用户级。
 * @returns {'all'|'user'}
 */
function resolveInstallScope (opts) {
  const o = opts || {}
  const e = o.env || process.env
  if (process.platform !== 'win32') return 'user'
  const commonParent = resolveCommonExtParent(e, o.commonFiles)
  if (commonParent) {
    const commonDest = path.join(commonParent, EXT_ID)
    try {
      if (fs.existsSync(commonDest) && isOwnedExtDir(commonDest)) {
        return 'all'
      }
    } catch (e) { /* 探测失败按用户级兜底 */ }
  }
  return 'user'
}

/** 仅当目录属本扩展时删除（best-effort，AE 占用等失败静默跳过） */
function tryRemoveOwnedExtDir (dir) {
  if (!dir) return false
  try {
    if (fs.existsSync(dir) && isOwnedExtDir(dir)) {
      return removeOwnedExtDir(dir)
    }
  } catch (e) { /* best-effort */ }
  return false
}

/**
 * 自检入口。
 * @param {object} opts
 *   appVersion {string}
 *   resourcesPath {string} process.resourcesPath
 *   appPath {string} app.getAppPath()
 *   env {object} process.env
 *   home {string}
 *   commonFiles {string}
 *   force {boolean} 无条件重拷
 * @returns {object} { checked, refreshed, reason, dest, version, targets }
 */
function ensureCepExtension (opts) {
  const o = opts || {}
  const appVersion = o.appVersion || ''
  const payloadDir = resolvePayloadDir(o.resourcesPath, o.appPath)
  const targets = []

  const userParent = resolveUserExtParent(o.env, o.home)
  const commonParent = resolveCommonExtParent(o.env, o.commonFiles)

  // 单副本：作用域只取其一，并清理另一作用域可能残留的旧副本
  const scope = resolveInstallScope(o)
  if (scope === 'all') {
    // 系统级：只维护 Common Files，绝不在用户级重新播种（防 AE 用户级遮挡 + 双副本）
    if (commonParent) {
      const commonDest = path.join(commonParent, EXT_ID)
      try {
        if (fs.existsSync(commonDest) && isOwnedExtDir(commonDest)) {
          targets.push({ parent: commonParent, kind: 'common' })
        }
      } catch (e) { /* skip */ }
    }
    // 兜底清掉残留的用户级副本（安装器已清，这里防其它路径重生）
    if (userParent) {
      tryRemoveOwnedExtDir(path.join(userParent, EXT_ID))
    }
  } else {
    // 用户级：仅维护当前用户，并尽力清掉残留的系统级副本（需管理员令牌，否则跳过）
    if (userParent) targets.push({ parent: userParent, kind: 'user' })
    if (commonParent) {
      tryRemoveOwnedExtDir(path.join(commonParent, EXT_ID))
    }
  }

  if (!payloadDir) {
    return {
      checked: true,
      refreshed: false,
      reason: 'no-payload',
      dest: '',
      version: appVersion,
      targets: targets.map((t) => t.kind)
    }
  }

  let refreshed = false
  let reason = 'in-sync'
  let lastDest = ''
  let lastVer = ''

  for (const t of targets) {
    const dest = path.join(t.parent, EXT_ID)
    lastDest = dest
    const cmp = compareVersions(appVersion, payloadDir, dest)
    if (o.force || cmp.need) {
      const r = refreshExtFromPayload(payloadDir, t.parent, {
        appVersion: appVersion,
        source: o.force ? 'app-force' : 'app-self-check',
        installedAt: o.installedAt
      })
      if (r.ok) {
        refreshed = true
        reason = o.force ? 'force' : cmp.reason
        lastVer = r.version
      } else if (!refreshed) {
        reason = r.reason || cmp.reason
      }
    } else {
      reason = cmp.reason
      const inst = readVersionJson(dest)
      lastVer = (inst && inst.version) || appVersion
    }
  }

  return {
    checked: true,
    refreshed: refreshed,
    reason: reason,
    dest: lastDest,
    version: lastVer || appVersion,
    payloadDir: payloadDir,
    targets: targets.map((t) => t.kind)
  }
}

module.exports = {
  EXT_ID,
  resolvePayloadDir,
  resolveUserExtParent,
  resolveCommonExtParent,
  ensureCepExtension
}
