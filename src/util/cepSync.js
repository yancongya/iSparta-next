/**
 * 桌面启动 / 热更完成后：CEP 扩展落盘自检与刷新。
 * 比较 app 版本 vs %APPDATA%\Adobe\CEP\extensions\io.github.isparta-next
 * 与 resources/cep payload（version.json）；不一致则重拷刷新。
 * 只动 EXT_ID 子目录，不误删用户其它扩展。
 */

const path = require('path')
const fs = require('fs')
const {
  EXT_ID,
  compareVersions,
  refreshExtFromPayload,
  readVersionJson,
  isOwnedExtDir
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
  if (userParent) targets.push({ parent: userParent, kind: 'user' })

  const commonParent = resolveCommonExtParent(o.env, o.commonFiles)
  if (commonParent) {
    const commonDest = path.join(commonParent, EXT_ID)
    // 仅当已安装过本扩展时才动 Common Files，避免无中生有
    try {
      if (fs.existsSync(commonDest) && isOwnedExtDir(commonDest)) {
        targets.push({ parent: commonParent, kind: 'common' })
      }
    } catch (e) { /* skip */ }
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
