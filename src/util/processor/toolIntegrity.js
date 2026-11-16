// 工具链完整性校验（软校验）：按清单核对编码器 SHA256 + 大小。
// 设计约束（见 docs/TODO-toolchain-and-sizing.md）：
// - 不改 ispartaAPI 桥契约（docs/BRIDGE.md 冻结）：哈希用纯 JS 在渲染层算，读字节走既有 readFileSync。
// - 不阻断转换：校验失败只告警 + 记录，Action.bin 仍可用；是否需要恢复由调用方决定。
// - 三端一致：Electron / CEP / 浏览器 mock 都走 node-env.fs，签名相同。
import { fs, path, getProcessBridge } from '../node-env'
import sha256 from './sha256'
import { TOOL_MANIFEST, TOOL_NAMES } from './toolManifest'
import appLog from '../../ui-next/log'

function detectPlatform () {
  try {
    const pf = navigator.platform
    const ua = navigator.userAgent || ''
    if (pf === 'Win32' || pf === 'Windows') {
      return (ua.indexOf('WOW64') > -1 || ua.indexOf('Win64') > -1) ? 'win64' : 'win32'
    }
    if (String(pf).indexOf('Mac') !== -1) { return 'mac' }
    if (String(pf).indexOf('Linux') !== -1 || pf === 'X11') { return 'linux' }
  } catch (e) { /* ignore */ }
  return 'unknown'
}

const EXE_BY_PF = {
  win32: (n) => n + '.exe',
  win64: (n) => n + '.exe',
  mac: (n) => n,
  linux: (n) => n,
  unix: (n) => n,
  unknown: (n) => n
}

function exeName (pf, name) {
  const f = EXE_BY_PF[pf] || EXE_BY_PF.unknown
  return f(name)
}

// 清单按副本分组；把传入 base 路径归类到 desktop/static/cep 之一
function manifestKeyForBase (base, bases) {
  const b = String(base || '').replace(/[\\/]+$/, '').replace(/\\/g, '/')
  if (!b) { return '' }
  const norm = (p) => String(p || '').replace(/[\\/]+$/, '').replace(/\\/g, '/')
  const cep = norm(bases && bases.cep)
  const stc = norm(bases && bases.static)
  const dsk = norm(bases && bases.desktop)
  // 空 base 不匹配任何路径（indexOf('') 恒为 0，必须排除）；长路径优先避免包含关系误判
  if (cep && b.indexOf(cep) >= 0) { return 'cep' }
  if (stc && b.indexOf(stc) >= 0) { return 'static' }
  if (dsk && b.indexOf(dsk) >= 0) { return 'desktop' }
  return ''
}

function expectedOf (manifestKey, pf, file) {
  const group = TOOL_MANIFEST[manifestKey]
  if (!group || !group[pf]) { return null }
  const raw = group[pf][file]
  if (!raw) { return null }
  const [hash, size] = String(raw).split('|')
  return { sha256: hash, size: Number(size) }
}

function readBytes (p) {
  try {
    const r = fs.readFileSync(p)
    if (r instanceof Uint8Array) { return r }
    if (Array.isArray(r)) { return Uint8Array.from(r) }
    if (r instanceof ArrayBuffer) { return new Uint8Array(r) }
    if (typeof r === 'string') {
      // mock fs 返回字符串；用 UTF-8 编码成字节参与哈希，行为与真实端一致
      if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(r) }
      const out = new Uint8Array(r.length)
      for (let i = 0; i < r.length; i++) { out[i] = r.charCodeAt(i) & 0xff }
      return out
    }
  } catch (e) { /* missing / unreadable */ }
  return null
}

/**
 * 校验单个候选可执行文件。
 * 返回 { checked, ok, reason, expected, actual }；checked=false 表示清单缺失（跳过，不判定）。
 */
export function verifyTool (cand, pf, bases) {
  const file = path.basename(cand)
  const mk = manifestKeyForBase(path.dirname(cand), bases)
  const expected = expectedOf(mk, pf, file)
  if (!expected) {
    // 白名单外的工具/平台无清单：不误判为损坏
    return { checked: false, ok: true, reason: 'no-manifest', file }
  }
  if (!fs.existsSync(cand)) {
    return { checked: true, ok: false, reason: 'missing', file, expected }
  }
  const bytes = readBytes(cand)
  if (!bytes) {
    return { checked: true, ok: false, reason: 'unreadable', file, expected }
  }
  if (expected.size > 0 && bytes.length !== expected.size) {
    return {
      checked: true, ok: false, reason: 'size', file, expected,
      actual: { size: bytes.length }
    }
  }
  const actualHash = sha256(bytes)
  if (actualHash !== expected.sha256) {
    return {
      checked: true, ok: false, reason: 'hash', file, expected,
      actual: { sha256: actualHash, size: bytes.length }
    }
  }
  return { checked: true, ok: true, reason: 'ok', file, expected }
}

/**
 * 全量校验某个平台、某个副本的全部白名单工具。
 * opts.log=false 可抑制逐条日志（默认写 warn 汇总）。
 */
export function verifyToolchain (pf, base, opts) {
  const o = opts || {}
  const bases = o.bases || { desktop: 'public/bin', static: 'static/bin', cep: 'ui/bin' }
  const results = []
  for (let i = 0; i < TOOL_NAMES.length; i++) {
    const name = TOOL_NAMES[i]
    const cand = path.join(base, exeName(pf, name))
    const r = verifyTool(cand, pf, bases)
    r.name = name
    results.push(r)
  }
  const checked = results.filter((r) => r.checked)
  const bad = checked.filter((r) => !r.ok)
  const summary = {
    platform: pf,
    base,
    total: results.length,
    checked: checked.length,
    ok: checked.length - bad.length,
    failed: bad.length,
    skipped: results.length - checked.length,
    bad: bad,
    results: results
  }
  if (o.log !== false) {
    if (bad.length) {
      appLog.warn('工具链校验：' + bad.length + '/' + checked.length + ' 项异常（' +
        bad.map((r) => r.file + ':' + r.reason).join(', ') + '）')
    } else if (checked.length) {
      appLog.info('工具链校验：' + checked.length + '/' + checked.length + ' 项通过')
    }
  }
  return summary
}

/**
 * 自包含诊断：探测本机工具目录，校验一个副本，返回可展示的汇总。
 * 供「关于」页的完整性状态卡片调用；只读、不抛错。
 */
export function diagnoseToolchain () {
  const pf = detectPlatform()
  let cwd = ''
  try { cwd = (getProcessBridge() && getProcessBridge().cwd && getProcessBridge().cwd()) || '' } catch (e) { /* ignore */ }
  // 探测顺序：桌面 public/bin → static/bin → CEP ui/bin（都不存在则标记不可用）
  const candidates = [
    { key: 'desktop', base: path.join(cwd || '.', 'public') },
    { key: 'static', base: path.join(cwd || '.', 'static') },
    { key: 'cep', base: '.' }
  ]
  const bases = {
    desktop: path.join(cwd || '.', 'public'),
    static: path.join(cwd || '.', 'static'),
    cep: '.'
  }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    const dir = path.join(c.base, 'bin', pf)
    let exists = false
    try { exists = fs.existsSync(dir) } catch (e) { /* ignore */ }
    if (!exists) { continue }
    const summary = verifyToolchain(pf, path.join(c.base, 'bin'), { bases, log: false })
    summary.source = c.key
    summary.available = true
    return summary
  }
  return { platform: pf, available: false, total: TOOL_NAMES.length, checked: 0, ok: 0, failed: 0, skipped: TOOL_NAMES.length, bad: [], results: [] }
}

/**
 * 从另一处健康副本恢复损坏工具。copier 需返回 Promise，形如 (src, dst) => Promise。
 * 仅在明确需要时调用；Action.bin 不自动触发恢复（避免副作用）。
 */
export function restoreTool (badResult, pf, sourceBase, targetBase, copier) {
  if (!badResult || badResult.ok || !badResult.file) { return Promise.resolve(false) }
  const src = path.join(sourceBase, badResult.file)
  const dst = path.join(targetBase, badResult.file)
  const check = verifyTool(src, pf, { desktop: sourceBase, static: sourceBase, cep: sourceBase })
  if (!check.checked || !check.ok) { return Promise.resolve(false) }
  return Promise.resolve(copier(src, dst)).then(() => true).catch(() => false)
}
