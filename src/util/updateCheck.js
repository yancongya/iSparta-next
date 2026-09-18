// 更新检查：纯逻辑层。
//
// 这里**不 import electron**——网络、版本号、平台架构全部由 background.js 注入，
// 目的是让版本比较、tag 解析、资产名拼接、各降级分支能脱离 Electron 直接测试。
// 远端只依赖 GitHub：版本号走 releases/latest 的 302 Location（不耗 API 配额），
// API 仅在 302 失败时兜底（顺带取 release body 作为更新说明）。
//
// 资产探测注意：releases/latest/download/<name> 对缺失资产也返回 302，
// 必须再 HEAD 二跳 releases/download/<tag>/<name> 才能见到 404。

import { ARTIFACT_PREFIX } from '../brand.js'

export const DEFAULT_REPO = 'yancongya/iSparta-next'
export const DEFAULT_BASE_URL = 'https://github.com'
export const DEFAULT_API_URL = 'https://api.github.com'
export { ARTIFACT_PREFIX }
export const THROTTLE_MS = 24 * 60 * 60 * 1000
export const DEFAULT_TIMEOUT_MS = 12000

/** 主进程注入 env 覆盖，测试与将来加镜像兜底都不用改架构 */
export function resolveUpdateConfig (env) {
  var e = env || {}
  var apiRaw = String(e.ISPARTA_UPDATE_API_URL || DEFAULT_API_URL).replace(/\/+$/, '')
  // 允许只写 host（https://api.github.com），也允许写完整前缀
  var apiBase = /\/repos$/i.test(apiRaw) ? apiRaw : apiRaw + '/repos'
  return {
    repo: e.ISPARTA_UPDATE_REPO || DEFAULT_REPO,
    baseUrl: String(e.ISPARTA_UPDATE_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiUrl: apiBase
  }
}

export function buildUrls (cfg) {
  var base = cfg.baseUrl || DEFAULT_BASE_URL
  var repo = cfg.repo
  var apiBase = cfg.apiUrl || (DEFAULT_API_URL + '/repos')
  return {
    latestRedirect: base + '/' + repo + '/releases/latest',
    api: apiBase + '/' + repo + '/releases/latest',
    releasesPage: base + '/' + repo + '/releases'
  }
}

/** 二跳资产 URL：latest 解析出 tag 后才能判定资产是否存在 */
export function buildReleaseAssetUrl (cfg, tag, artifactName) {
  var base = (cfg.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '')
  var clean = String(tag || '').replace(/^v/i, '')
  return base + '/' + cfg.repo + '/releases/download/v' + clean + '/' + artifactName
}

/** 平台 → electron-builder 的 ${os} 段；产物只有 win/mac 分架构，linux 仅 x64 */
export function osSlug (platform) {
  if (platform === 'win32') { return 'win' }
  if (platform === 'darwin') { return 'mac' }
  return 'linux'
}

export function archSlug (platform, arch) {
  if (osSlug(platform) === 'linux') { return 'x64' }
  return arch === 'arm64' ? 'arm64' : 'x64'
}

/** electron-builder 的 ${ext}：win=NSIS exe、linux=AppImage、mac=zip（与 electron-builder.yml 一致） */
export function extOf (platform) {
  var os = osSlug(platform)
  if (os === 'win') { return 'exe' }
  if (os === 'linux') { return 'AppImage' }
  return 'zip'
}

/** 与 electron-builder.yml 的 artifactName / CI 稳定别名一致：isparta-next-<os>-<arch>.<ext> */
export function buildArtifactName (platform, arch) {
  return ARTIFACT_PREFIX + '-' + osSlug(platform) + '-' + archSlug(platform, arch) + '.' + extOf(platform)
}

/**
 * 从 releases/latest 的重定向 Location（或裸 tag）里取版本号。
 * 'https://github.com/o/r/releases/tag/v3.3.4' → '3.3.4'；'v9.10.0-beta.2' → '9.10.0-beta.2'
 */
export function parseVersionTag (input) {
  if (!input || typeof input !== 'string') { return null }
  var s = input.trim()
  var m = s.match(/\/releases\/tag\/([^/?#]+)/)
  if (m) { s = m[1] }
  s = s.replace(/^v/i, '')
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(s) ? s : null
}

function splitSemver (v) {
  var core = String(v).replace(/^v/i, '')
  var plus = core.indexOf('+')
  if (plus >= 0) { core = core.slice(0, plus) } // build metadata 不参与比较
  var dash = core.indexOf('-')
  var main = dash >= 0 ? core.slice(0, dash) : core
  var pre = dash >= 0 ? core.slice(dash + 1) : ''
  return {
    nums: main.split('.').map(function (n) { return parseInt(n, 10) || 0 }),
    pre: pre ? pre.split('.') : []
  }
}

function comparePrerelease (a, b) {
  // 有 prerelease < 无 prerelease（3.3.4-beta.1 < 3.3.4）
  if (!a.length && !b.length) { return 0 }
  if (!a.length) { return 1 }
  if (!b.length) { return -1 }
  var n = Math.max(a.length, b.length)
  for (var i = 0; i < n; i++) {
    var x = a[i]
    var y = b[i]
    if (x === undefined) { return -1 }
    if (y === undefined) { return 1 }
    var xn = /^\d+$/.test(x)
    var yn = /^\d+$/.test(y)
    if (xn && yn) {
      if (Number(x) !== Number(y)) { return Number(x) > Number(y) ? 1 : -1 }
    } else if (xn !== yn) {
      return xn ? -1 : 1 // 数字段 < 字母段
    } else if (x !== y) {
      return x > y ? 1 : -1
    }
  }
  return 0
}

/** a>b → 1，a<b → -1，相等 → 0；非法输入按 0 处理（宁可不提示，不可误报） */
export function compareSemver (a, b) {
  var va = parseVersionTag(a)
  var vb = parseVersionTag(b)
  if (!va || !vb) { return 0 }
  var sa = splitSemver(va)
  var sb = splitSemver(vb)
  for (var i = 0; i < 3; i++) {
    var x = sa.nums[i] || 0
    var y = sb.nums[i] || 0
    if (x !== y) { return x > y ? 1 : -1 }
  }
  return comparePrerelease(sa.pre, sb.pre)
}

/** 失败分类：网络层错误一律 offline，绝不向上抛成"有更新" */
export function classifyFailure (err) {
  var msg = (err && err.message) || String(err || '')
  if (/rate[- ]?limit/i.test(msg)) { return 'rate-limit' }
  if (/timeout|aborted|ENOTFOUND|ECONN|EAI_AGAIN|network|offline|ERR_/i.test(msg)) { return 'offline' }
  return 'error'
}

function baseResult (deps) {
  var cfg = resolveUpdateConfig(deps.env)
  var urls = buildUrls(cfg)
  var artifact = buildArtifactName(deps.platform, deps.arch)
  return {
    state: 'error',
    current: deps.currentVersion || '',
    latest: null,
    notes: null,
    artifactName: artifact,
    downloadUrl: urls.latestRedirect + '/download/' + artifact,
    fallbackUrl: urls.releasesPage,
    needsGatekeeperHint: osSlug(deps.platform) === 'mac',
    checkedAt: deps.now || Date.now(),
    throttled: false,
    assetMissing: false,
    firstError: null
  }
}

/**
 * deps:
 *   fetchHead(url, timeoutMs) → { status, location }   必须不跟随重定向
 *   fetchJson(url, timeoutMs) → { status, json }
 *   currentVersion / platform / arch / env / now / timeoutMs
 *   force / enabled / lastCheckAt / skipVersion / cachedResult
 */
export async function checkUpdate (deps) {
  var d = deps || {}
  var result = baseResult(d)
  var now = d.now || Date.now()
  var timeoutMs = d.timeoutMs || DEFAULT_TIMEOUT_MS
  var cfg = resolveUpdateConfig(d.env)
  var urls = buildUrls(cfg)

  if (d.enabled === false) {
    return Object.assign({}, result, { state: 'disabled' })
  }

  // 节流：非手动检查且 24h 内查过，直接回缓存，不发网络请求
  var since = now - (Number(d.lastCheckAt) || 0)
  if (!d.force && d.lastCheckAt && since < THROTTLE_MS && d.cachedResult) {
    return Object.assign({}, d.cachedResult, { throttled: true, checkedAt: d.cachedResult.checkedAt || now })
  }

  var latest = null
  var notes = null

  // 主路径：302 Location，零 API 配额
  try {
    var head = await d.fetchHead(urls.latestRedirect, timeoutMs)
    latest = parseVersionTag(head && head.location)
  } catch (e) {
    result.firstError = classifyFailure(e)
  }

  // 兜底：API（顺带能拿到 release body 作为更新说明）
  if (!latest) {
    try {
      var res = await d.fetchJson(urls.api, timeoutMs)
      if (res && (res.status === 403 || res.status === 429)) {
        return Object.assign({}, result, { state: 'rate-limit', firstError: 'rate-limit' })
      }
      if (res && res.json && res.json.tag_name) {
        latest = parseVersionTag(res.json.tag_name)
        notes = typeof res.json.body === 'string' ? res.json.body.slice(0, 4000) : null
      }
    } catch (e2) {
      return Object.assign({}, result, { state: classifyFailure(e2), firstError: classifyFailure(e2) })
    }
  }

  if (!latest) {
    var failState = result.firstError || 'error'
    return Object.assign({}, result, { state: failState })
  }

  result.latest = latest

  // 弹窗必须有版本说明：302 主路径只拿到 tag，这里补拉 Release body
  //（拿不到则 notes 为 null，UI 显示「暂无说明」而不是空白区块）
  if (!notes) {
    try {
      var noteRes = await d.fetchJson(urls.api, timeoutMs)
      if (noteRes && noteRes.json && noteRes.json.tag_name &&
          parseVersionTag(noteRes.json.tag_name) === latest &&
          typeof noteRes.json.body === 'string') {
        notes = formatReleaseNotes(noteRes.json.body)
      }
    } catch (eNotes) { /* notes 缺失不阻断更新判定 */ }
  } else {
    notes = formatReleaseNotes(notes)
  }

  if (compareSemver(latest, result.current) <= 0) {
    return Object.assign({}, result, { state: 'latest', notes: notes })
  }
  if (d.skipVersion && d.skipVersion === latest) {
    return Object.assign({}, result, { state: 'skipped', notes: notes })
  }

  // 资产探测：latest/download 第一跳对缺失资产也 302，必须二跳
  // 存在 → 302 到 release-assets；不存在 → 404
  try {
    var probeUrl = buildReleaseAssetUrl(cfg, latest, result.artifactName)
    var probe = await d.fetchHead(probeUrl, timeoutMs)
    var st = probe && probe.status
    // 3xx/2xx 视为存在；404/410 视为缺失；其它失败宁给下载链
    result.assetMissing = st === 404 || st === 410
  } catch (e3) {
    result.assetMissing = false
  }

  return Object.assign({}, result, { state: 'available', notes: notes })
}

/** 渲染层展示用：去掉 CI 噪音行，保留 feat/fix 等用户可读条目 */
export function formatReleaseNotes (body) {
  if (typeof body !== 'string' || !body.trim()) { return null }
  var lines = body.split(/\r?\n/)
  var out = []
  var skipSection = false
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    var t = line.trim()
    if (/^#{1,6}\s/.test(t)) {
      // 跳过工程向小节标题及其内容
      skipSection = /工程|CI|Chore|chore|Other|其他|Commits|Full Changelog/i.test(t)
      // 保留功能/修复类标题
      if (/功能|修复|Features|Fixes|Docs|文档/i.test(t) && !skipSection) {
        out.push(line)
        skipSection = false
      }
      continue
    }
    if (skipSection) { continue }
    if (/^\[skip ci\]|^chore(\(|:)|^ci(\(|:)|^build(\(|:)|^refactor(\(|:)|^perf(\(|:)/i.test(t)) { continue }
    if (/github\.com\/.*\/compare\//i.test(t)) { continue }
    out.push(line)
  }
  var text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text || null
}

/** 渲染层/测试用：该 URL 是否允许 shell.openExternal */
export function isAllowedExternalUrl (url, env) {
  if (typeof url !== 'string' || !url) { return false }
  var cfg = resolveUpdateConfig(env)
  var allowOrigin
  var allowPathPrefix
  try {
    var base = new URL(cfg.baseUrl)
    allowOrigin = base.origin
    allowPathPrefix = '/' + cfg.repo + '/'
  } catch (e) {
    return false
  }
  var u
  try {
    u = new URL(url)
  } catch (e2) {
    return false
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') { return false }
  if (u.origin !== allowOrigin) { return false }
  // 拒绝 .. 等路径技巧
  if (u.pathname.indexOf('..') >= 0) { return false }
  return u.pathname.indexOf(allowPathPrefix) === 0
}
