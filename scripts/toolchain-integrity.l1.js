/**
 * L1：工具链完整性诊断守卫（纯 Node，无浏览器/无真实转换）
 * 用法：node scripts/toolchain-integrity.l1.js
 *
 * 覆盖：
 * - diagnoseToolchain() 的校验 base 必须带平台子目录 bin/<pf>（回归 bug：漏 <pf> 致全部 missing）
 * - 沙箱用真实 fs/path + 真实目录：desktop 副本校验应 10/10 通过
 * - 静态守卫：verifyToolchain 的 base 参数不得退回 path.join(c.base,'bin')
 * - verifyTool 的 missing / size / hash / no-manifest 分类
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

// 把 ESM 模块剥成可在沙箱求值
function loadModule (rel, names, extraGlobals) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const code = raw
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+(const|function|let|var)\s/gm, '$1 ')
    .replace(/^export default[^\n]*\n?/gm, '')
  const sandbox = Object.assign({
    module: { exports: {} }, exports: {}, console, Date, Math, JSON, Array, Object, String, Number, RegExp, Error, Promise,
    Uint8Array, ArrayBuffer, TextEncoder, setTimeout
  }, extraGlobals || {})
  vm.createContext(sandbox)
  vm.runInContext(code + '\n;Object.assign(globalThis,{' + names.join(',') + '});', sandbox, { filename: rel })
  return sandbox
}

function run () {
  const src = fs.readFileSync(path.join(ROOT, 'src/util/processor/toolIntegrity.js'), 'utf8')

  // ---- 静态守卫：校验 base 必须带 <pf> ----
  ok('diagnose 传 dir(bin/<pf>) 给 verifyToolchain', /verifyToolchain\(pf,\s*dir,/.test(src))
  ok('不再传裸 bin 作校验 base', !/verifyToolchain\(pf,\s*path\.join\(c\.base,\s*['"]bin['"]\)/.test(src))

  // ---- 用真实 fs 加载依赖 + 真实目录，验证诊断不再误报 ----
  const manifest = loadModule('src/util/processor/toolManifest.js', ['TOOL_MANIFEST', 'TOOL_NAMES'])
  // sha256 是 export default function，普通 loadModule 会把整行删掉留悬空函数体，这里单独处理
  const sha256Raw = fs.readFileSync(path.join(ROOT, 'src/util/processor/sha256.js'), 'utf8')
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export default\s+function\s+sha256/, 'function sha256')
  const shaCtx = { module: { exports: {} }, exports: {}, Uint8Array, ArrayBuffer, Array, String, TextEncoder, Math, console }
  vm.createContext(shaCtx)
  vm.runInContext(sha256Raw + '\n;globalThis.sha256=sha256;', shaCtx, { filename: 'sha256.js' })

  const noopLog = { info: function () {}, warn: function () {} }
  const procEnv = { cwd: function () { return ROOT } }
  const ti = loadModule('src/util/processor/toolIntegrity.js', ['diagnoseToolchain', 'verifyToolchain', 'verifyTool'], {
    fs: fs,
    path: path,
    navigator: { platform: 'Win32' },
    getProcessBridge: function () { return procEnv },
    TOOL_MANIFEST: manifest.TOOL_MANIFEST,
    TOOL_NAMES: manifest.TOOL_NAMES,
    sha256: shaCtx.sha256,
    appLog: noopLog
  })

  const diag = ti.diagnoseToolchain()
  console.log('  diagnose:', JSON.stringify({ available: diag.available, source: diag.source, platform: diag.platform, ok: diag.ok, checked: diag.checked, failed: diag.failed }))
  ok('桌面副本可用', diag.available === true)
  ok('来源识别为 desktop', diag.source === 'desktop')
  ok('平台为 Windows 分支', diag.platform === 'win64' || diag.platform === 'win32', diag.platform)
  ok('校验项 = 10', diag.checked === 10, diag.checked)
  ok('全部通过（不再误报缺失）', diag.ok === 10 && diag.failed === 0, { ok: diag.ok, failed: diag.failed })

  // verifyTool 分类口径
  const win64Base = path.join(ROOT, 'public', 'bin', 'win64')
  const bases = { desktop: path.join(ROOT, 'public'), static: path.join(ROOT, 'static'), cep: path.join(ROOT, 'targets', 'cep', 'ui') }
  const good = ti.verifyTool(path.join(win64Base, 'apngasm.exe'), 'win64', bases)
  ok('verifyTool 命中清单 -> ok', good.checked === true && good.ok === true && good.reason === 'ok', good)
  const missing = ti.verifyTool(path.join(win64Base, 'no-such-tool.exe'), 'win64', bases)
  ok('白名单外工具 -> no-manifest 跳过', missing.checked === false && missing.reason === 'no-manifest', missing)

  console.log('\n[toolchain-integrity] ' + passed + ' passed, ' + failed + ' failed')
  if (failed) process.exitCode = 1
}

try { run() } catch (e) { console.error(e); process.exitCode = 1 }
