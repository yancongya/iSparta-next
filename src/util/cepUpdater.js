/**
 * CEP 一体更新（面板内后台下官方安装包 → 唤起安装向导）。
 *
 * 边界（AGENTS.md §8.1）：CEP 内**不跑 electron-updater**；AE 扩展目录由 NSIS
 * 组件页与桌面一起刷新（build/installer.nsh），所以「下同一个最新版安装包」就是
 * 双端唯一真相源。安装完成后需重启 After Effects 才加载新面板代码。
 *
 * 分工：判定/semver/资产名仍走 updateCheck 纯函数；本文件只做三件事——
 * 1) 把桥的 updater:http 适配成 checkUpdate 的 fetchHead / fetchJson；
 * 2) 解析 latest.yml 拿 sha512，交给桥做流式下载 + 校验；
 * 3) 唤起安装包（detached，面板不阻塞）。
 */

/* global window */

import { ipc } from './node-env'
import {
  checkUpdate,
  resolveUpdateConfig
} from './updateCheck'

const DEFAULT_TIMEOUT_MS = 12000
/** 面板轮询桥下载态的间隔（桥无推送通道） */
export const POLL_MS = 800

/** 同步能力探测：桥注入才有 Node（mac 无 NSIS，回「前往下载」） */
export function bridgeUpdater () {
  if (typeof window === 'undefined') { return null }
  var b = window.ispartaCepBridge
  return (b && b.updater) || null
}

export function cepPlatform () {
  var u = bridgeUpdater()
  if (u && u.platform) { return u.platform }
  var proc = (typeof window !== 'undefined' && window.ispartaAPI && window.ispartaAPI.process) || null
  return (proc && proc.platform) || ''
}

export function cepArch () {
  var u = bridgeUpdater()
  if (u && u.arch) { return u.arch }
  var proc = (typeof window !== 'undefined' && window.ispartaAPI && window.ispartaAPI.process) || null
  return (proc && proc.arch) || ''
}

/** CEP 能否走「面板内下载安装包 + 起向导」：需 Node 且 Windows（NSIS） */
export function cepInstallerCapable () {
  var u = bridgeUpdater()
  if (!u || !u.hasNode) { return false }
  return cepPlatform() === 'win32'
}

/** 桥已就绪（能查、能开外链），但形态不支持自动安装包 */
export function cepBridgeAvailable () {
  return !!(bridgeUpdater() && bridgeUpdater().hasNode)
}

function httpCall (opts) {
  return ipc.invoke('updater:http', opts)
}

/**
 * fetchHead：maxRedirects 0 —— 302 Location 是版本真相源，跟下去就读不到了。
 * 返回形状与 updateCheck 的 deps.fetchHead 一致。
 */
export function bridgeFetchHead (url, timeoutMs) {
  return httpCall({
    method: 'HEAD',
    url: url,
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
    maxRedirects: 0
  }).then(function (r) {
    return { status: (r && r.status) || 0, location: (r && r.location) || null }
  })
}

/** fetchJson：API 兜底（GitHub 需要 UA，桥里已统一带上） */
export function bridgeFetchJson (url, timeoutMs) {
  return httpCall({
    method: 'GET',
    url: url,
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
    maxRedirects: 0,
    headers: { Accept: 'application/vnd.github+json' }
  }).then(function (r) {
    var json = null
    try { json = JSON.parse((r && r.text) || '') } catch (e) { json = null }
    return { status: (r && r.status) || 0, json: json }
  })
}

function bridgeFetchText (url, timeoutMs) {
  return httpCall({
    method: 'GET',
    url: url,
    timeoutMs: timeoutMs || DEFAULT_TIMEOUT_MS,
    maxRedirects: 5
  }).then(function (r) {
    return { status: (r && r.status) || 0, text: (r && r.text) || '' }
  })
}

/**
 * CEP 侧更新检查：与桌面同一条 checkUpdate 判定，只是网络走桥（Node）。
 * 产物名由 updateCheck 依 platform/arch 生成，正好就是双端一体更用的官方安装包。
 * @param {object} p { force, enabled, lastCheckAt, skipVersion, cachedResult, current }
 */
export function cepCheckUpdate (p) {
  var pkg = p || {}
  return checkUpdate({
    force: !!pkg.force,
    enabled: pkg.enabled !== false,
    lastCheckAt: pkg.lastCheckAt || pkg.lastAt || 0,
    skipVersion: pkg.skipVersion || '',
    cachedResult: pkg.cachedResult || null,
    currentVersion: pkg.current || '',
    platform: cepPlatform() || 'win32',
    arch: cepArch() || 'x64',
    env: {},
    fetchHead: bridgeFetchHead,
    fetchJson: bridgeFetchJson,
    now: Date.now()
  })
}

/**
 * latest.yml（electron-builder 产物）→ 指定资产的 sha512 / size。
 * 只取需要的字段，容忍 files 列表与顶层 path 两种写法。
 * @returns {{version: string, sha512: string, size: number}|null}
 */
export function parseLatestYml (text, artifactName) {
  var raw = String(text || '')
  if (!raw.trim()) { return null }
  var lines = raw.split(/\r?\n/)
  var top = { version: '', path: '', sha512: '', size: 0 }
  var entries = []
  var cur = null
  var inFiles = false
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (/^files:\s*$/.test(line)) { inFiles = true; cur = null; continue }
    if (inFiles && /^\S/.test(line)) { inFiles = false; cur = null }
    var mUrl = line.match(/^\s*-\s*url:\s*(.+?)\s*$/)
    if (mUrl) {
      cur = { url: mUrl[1], sha512: '', size: 0 }
      entries.push(cur)
      continue
    }
    var mSha = line.match(/^\s*(?:-\s*)?sha512:\s*(.+?)\s*$/)
    if (mSha) {
      if (inFiles && cur) { cur.sha512 = mSha[1] } else { top.sha512 = mSha[1] }
      continue
    }
    var mSize = line.match(/^\s*size:\s*(\d+)/)
    if (mSize) {
      if (inFiles && cur) { cur.size = Number(mSize[1]) || 0 } else { top.size = Number(mSize[1]) || 0 }
      continue
    }
    var mPath = line.match(/^path:\s*(.+?)\s*$/)
    if (mPath) { top.path = mPath[1]; continue }
    var mVer = line.match(/^version:\s*["']?([\w.+-]+)["']?\s*$/)
    if (mVer) { top.version = mVer[1] }
  }
  var name = String(artifactName || '')
  var hit = null
  if (name) {
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].url === name || entries[j].url.indexOf('/' + name) >= 0) { hit = entries[j]; break }
    }
    if (!hit && top.path === name) { hit = { url: name, sha512: top.sha512, size: top.size } }
  } else if (entries.length) {
    hit = entries[0]
  } else if (top.path) {
    hit = { url: top.path, sha512: top.sha512, size: top.size }
  }
  if (!hit) { return null }
  return { version: top.version || '', sha512: hit.sha512 || '', size: hit.size || 0 }
}

/** 安装包落盘目录：%TEMP%/iSparta/update（与 storage 同根，卸载不牵连用户工程） */
export function installerDir (os, path) {
  return path.join(os.tmpdir(), 'iSparta', 'update')
}

function latestYmlCandidates (env, platform, arch) {
  var cfg = resolveUpdateConfig(env)
  var base = cfg.baseUrl.replace(/\/+$/, '') + '/' + cfg.repo + '/releases/latest/download/'
  var names = ['latest.yml']
  if (arch === 'arm64') { names.unshift('latest-arm64.yml') }
  if (platform === 'darwin') { names = ['latest-mac.yml'] }
  if (platform === 'linux') { names = ['latest-linux.yml'] }
  return names.map(function (n) { return base + n })
}

/**
 * 后台下载安装包：先取 latest.yml 的 sha512，再让桥流式下载并校验。
 * @param {object} result updateCheck 的 available 结果
 * @param {object} deps { os, path } 注入 node-env 便于测试
 * @returns {Promise<object>} { ok, reason?, state }，state 为桥的下载快照
 */
export function startInstallerDownload (result, deps) {
  var d = deps || {}
  var osMod = d.os
  var pathMod = d.path
  if (!result || !result.artifactName) {
    return Promise.resolve({ ok: false, reason: 'no-artifact' })
  }
  var platform = cepPlatform() || 'win32'
  var arch = cepArch() || 'x64'
  var urls = latestYmlCandidates({}, platform, arch)
  var artifact = result.artifactName
  var sha512 = ''
  var total = 0

  var tryYml = function (i) {
    if (i >= urls.length) { return Promise.resolve(null) }
    return bridgeFetchText(urls[i], DEFAULT_TIMEOUT_MS).then(function (r) {
      if (!r || r.status < 200 || r.status >= 300 || !r.text) { return tryYml(i + 1) }
      return parseLatestYml(r.text, artifact)
    })
  }

  return tryYml(0).then(function (yml) {
    if (yml) {
      sha512 = yml.sha512 || ''
      total = yml.size || 0
    }
    var file
    try {
      file = pathMod.join(installerDir(osMod, pathMod), artifact)
    } catch (ePath) {
      return { ok: false, reason: 'no-tmpdir' }
    }
    return ipc.invoke('updater:download', {
      url: result.downloadUrl,
      file: file,
      sha512: sha512,
      total: total
    }).then(function (r) {
      if (!r || !r.ok) {
        return { ok: false, reason: (r && (r.reason || r.error)) || 'download-failed', state: r && r.state }
      }
      return { ok: true, state: r.state || null, file: file, verified: !!sha512 }
    })
  }).catch(function (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  })
}

export function queryDownloadState () {
  return ipc.invoke('updater:downloadState').catch(function () { return null })
}

export function cancelInstallerDownload () {
  return ipc.invoke('updater:cancelDownload').catch(function () { return null })
}

/** 起安装向导：detached，面板不阻塞；装完由用户重启 AE 生效 */
export function launchInstaller (file) {
  return ipc.invoke('updater:runInstaller', file ? { file: file } : {})
    .catch(function (e) { return { ok: false, reason: String((e && e.message) || e) } })
}

/** 把桥的下载快照映射成 updateService 的 auto 状态（UI 复用同一套 phase） */
export function toAutoState (snap, extra) {
  var s = snap || {}
  return Object.assign({
    supported: cepInstallerCapable(),
    mode: 'installer',
    checking: false,
    downloading: !!s.downloading,
    downloaded: !!s.downloaded,
    progress: Number(s.progress) || 0,
    error: s.error || null,
    version: null,
    file: s.file || '',
    verified: !!s.verified,
    active: !!s.active
  }, extra || {})
}

export default {
  bridgeUpdater,
  cepInstallerCapable,
  cepBridgeAvailable,
  cepCheckUpdate,
  parseLatestYml,
  installerDir,
  startInstallerDownload,
  queryDownloadState,
  cancelInstallerDownload,
  launchInstaller,
  toAutoState,
  POLL_MS
}
