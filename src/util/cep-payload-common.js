/**
 * CEP payload 公共逻辑（打包脚本与桌面自检共用）。
 * - 小工具子集清单与 targets/cep/bin/README.md、processor/* 一致
 * - version.json 清单读写，供 prepare-cep / installer / 运行时自检对齐
 * 无 Electron 依赖；scripts/ 与主进程均可 require。
 */

const fs = require('fs')
const path = require('path')

const EXT_ID = 'io.github.isparta-next'
const EXT_NAME = 'iSparta'
const EXT_DISPLAY_NAME = 'iSparta-next AE'

// 小工具子集（与 targets/cep/bin/README.md 一致）
const WIN_TOOLS = ['apngasm.exe', 'apngquant.exe', 'apngopt.exe', 'cwebp.exe', 'webpmux.exe']
const MAC_TOOLS = ['apngasm', 'apngquant', 'apngopt', 'cwebp', 'webpmux']
const NIX_TOOLS = MAC_TOOLS
const SKIP_COPY = new Set(['.git', '.DS_Store', 'Thumbs.db'])

function copyFile (from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

function copyTree (from, to) {
  const st = fs.statSync(from)
  if (st.isFile()) {
    copyFile(from, to)
    return
  }
  fs.mkdirSync(to, { recursive: true })
  for (const name of fs.readdirSync(from)) {
    if (SKIP_COPY.has(name)) continue
    copyTree(path.join(from, name), path.join(to, name))
  }
}

/** 删除本扩展目录；仅当确认归属（version.json.id / manifest）时删。绝不扫父目录。 */
function removeOwnedExtDir (dir) {
  if (!dir) return false
  const base = path.basename(dir)
  if (base !== EXT_ID) return false
  if (!isOwnedExtDir(dir)) return false
  fs.rmSync(dir, { recursive: true, force: true })
  return true
}

function isOwnedExtDir (dir) {
  try {
    const vj = readVersionJson(dir)
    if (vj && vj.id === EXT_ID) return true
  } catch (e) { /* fall through */ }
  try {
    const man = path.join(dir, 'CSXS', 'manifest.xml')
    if (fs.existsSync(man)) {
      const xml = fs.readFileSync(man, 'utf8')
      if (xml.indexOf(EXT_ID) !== -1 || xml.indexOf('ExtensionBundleId') !== -1) {
        // 目录名已限定 EXT_ID；manifest 在此即可认领
        return true
      }
    }
  } catch (e) { /* ignore */ }
  return false
}

function readVersionJson (dir) {
  const p = path.join(dir, 'version.json')
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    return null
  }
}

/**
 * 写入 version.json（与 prepare-cep / installer 字段对齐）。
 * @param {string} dir 扩展根目录
 * @param {object} doc 合并进清单的字段
 */
function writeVersionJson (dir, doc) {
  const merged = Object.assign({
    id: EXT_ID,
    name: EXT_NAME,
    displayName: EXT_DISPLAY_NAME
  }, doc || {})
  const p = path.join(dir, 'version.json')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(p, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  return merged
}

/** 读 manifest 的 ExtensionBundleVersion（缺省回退 appVersion） */
function readExtensionBundleVersion (manifestPath, fallback) {
  try {
    const xml = fs.readFileSync(manifestPath, 'utf8')
    const m = xml.match(/ExtensionBundleVersion="([^"]+)"/)
    if (m) return m[1]
  } catch (e) { /* keep fallback */ }
  return fallback
}

/**
 * 组装 version.json 文档（**唯一来源**，写入方必须走这里，防字段漂移）。
 * 三个写入通道字段对齐（docs/CEP-ALIGNMENT.md）：
 *   1. prepare-cep-payload（桌面 payload / 本地独立 zip）
 *   2. NSIS installer.nsh（安装时覆盖 installedAt/source）
 *   3. cepSync 自检刷新（refreshExtFromPayload 覆盖 refreshedAt/source）
 *   4. CI 独立 zip（scripts/seed-cep-zip-version.js —— rsync 源码树没有清单，
 *      必须补播，否则 CI 包与本地包不一致：桌面自检判 not-installed、
 *      面板 updater:meta 只能回退 brand 静态版本）
 *
 * install 元数据必须按 win32 / darwin 分列 —— payload 由 extraResources 一次性
 * 打进所有平台产物，写死 %APPDATA%/HKCU 会把错路径带进 mac 包。仅供排障参考。
 *
 * @param {object} opts
 *   version {string} 必填（package.json 版本）
 *   extensionBundleVersion {string} manifest 的 ExtensionBundleVersion
 *   builtAt {string} ISO 时间；缺省当前时间
 *   payload {string} 来源标识；缺省 cep/<EXT_ID>
 *   binaries {string[]} 已暂存的编码器相对路径列表
 */
function buildVersionDoc (opts) {
  const o = opts || {}
  return {
    id: EXT_ID,
    name: EXT_NAME,
    displayName: EXT_DISPLAY_NAME,
    version: o.version || '',
    extensionBundleVersion: o.extensionBundleVersion || o.version || '',
    builtAt: o.builtAt || new Date().toISOString(),
    payload: o.payload || ('cep/' + EXT_ID),
    binaries: o.binaries || [],
    install: {
      userCep: {
        win32: '%APPDATA%\\Adobe\\CEP\\extensions\\' + EXT_ID,
        darwin: '~/Library/Application Support/Adobe/CEP/extensions/' + EXT_ID
      },
      commonCep: {
        win32: '%CommonProgramFiles%\\Adobe\\CEP\\extensions\\' + EXT_ID,
        darwin: '/Library/Application Support/Adobe/CEP/extensions/' + EXT_ID
      },
      playerDebugMode: {
        win32: 'NSIS 组件页写 HKCU\\Software\\Adobe\\CSXS.6-14\\PlayerDebugMode=1',
        darwin: '扩展落盘后由桌面应用执行 install/install-as-admin（CSXS.5-25）'
      }
    }
  }
}

/**
 * 判断是否需要刷新：应用版本 / payload / 已安装 三者 version 不一致，或未安装。
 * @returns {{ need: boolean, reason: string, installed: object|null, payload: object|null }}
 */
function compareVersions (appVersion, payloadDir, installedDir) {
  const payload = readVersionJson(payloadDir)
  const installed = readVersionJson(installedDir)
  const payloadVer = (payload && payload.version) || ''
  const installedVer = (installed && installed.version) || ''

  if (!payloadDir || !fs.existsSync(path.join(payloadDir, 'CSXS', 'manifest.xml'))) {
    return { need: false, reason: 'no-payload', installed: installed, payload: payload }
  }
  if (!installed || !fs.existsSync(path.join(installedDir, 'CSXS', 'manifest.xml'))) {
    return { need: true, reason: 'not-installed', installed: installed, payload: payload }
  }
  if (payloadVer && installedVer && payloadVer !== installedVer) {
    return { need: true, reason: 'payload-mismatch', installed: installed, payload: payload }
  }
  if (appVersion && installedVer && appVersion !== installedVer) {
    return { need: true, reason: 'app-mismatch', installed: installed, payload: payload }
  }
  if (appVersion && payloadVer && appVersion !== payloadVer) {
    // payload 与应用不同包：仍以 payload 为准重拷，保证扩展与安装包一致
    return { need: true, reason: 'payload-app-mismatch', installed: installed, payload: payload }
  }
  return { need: false, reason: 'in-sync', installed: installed, payload: payload }
}

/**
 * 从 payload 重拷到目标扩展目录（只动 EXT_ID 子目录）。
 * @returns {{ ok: boolean, dest: string, version: string, reason?: string }}
 */
function refreshExtFromPayload (payloadDir, destParent, opts) {
  const o = opts || {}
  const dest = path.join(destParent, EXT_ID)
  if (!fs.existsSync(path.join(payloadDir, 'CSXS', 'manifest.xml'))) {
    return { ok: false, dest: dest, version: '', reason: 'no-payload' }
  }
  // 目标必须是 extensions/EXT_ID，禁止误删同级其它扩展
  if (path.basename(dest) !== EXT_ID) {
    return { ok: false, dest: dest, version: '', reason: 'bad-dest' }
  }
  try {
    if (fs.existsSync(dest) && !isOwnedExtDir(dest)) {
      return { ok: false, dest: dest, version: '', reason: 'not-owned' }
    }
    fs.mkdirSync(destParent, { recursive: true })
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true })
    }
    copyTree(payloadDir, dest)
  } catch (e) {
    return { ok: false, dest: dest, version: '', reason: 'fs-error', error: String((e && e.message) || e) }
  }

  const payload = readVersionJson(dest) || {}
  const appVersion = o.appVersion || payload.version || ''
  const manifestPath = path.join(dest, 'CSXS', 'manifest.xml')
  const extBundle = readExtensionBundleVersion(manifestPath, payload.extensionBundleVersion || appVersion)
  try {
    const doc = writeVersionJson(dest, {
      version: appVersion || payload.version || '',
      extensionBundleVersion: extBundle,
      builtAt: payload.builtAt || new Date().toISOString(),
      installedAt: o.installedAt || new Date().toISOString(),
      refreshedAt: new Date().toISOString(),
      payload: payload.payload || ('cep/' + EXT_ID),
      binaries: payload.binaries || [],
      source: o.source || 'app-self-check'
    })
    return { ok: true, dest: dest, version: doc.version || '', doc: doc }
  } catch (e) {
    return { ok: false, dest: dest, version: '', reason: 'fs-error', error: String((e && e.message) || e) }
  }
}

module.exports = {
  EXT_ID,
  EXT_NAME,
  EXT_DISPLAY_NAME,
  WIN_TOOLS,
  MAC_TOOLS,
  NIX_TOOLS,
  SKIP_COPY,
  copyFile,
  copyTree,
  isOwnedExtDir,
  removeOwnedExtDir,
  readVersionJson,
  writeVersionJson,
  readExtensionBundleVersion,
  buildVersionDoc,
  compareVersions,
  refreshExtFromPayload
}
