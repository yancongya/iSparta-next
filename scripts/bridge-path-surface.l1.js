/**
 * L1：renderer 侧 path 方法面守卫
 * 用法：node scripts/bridge-path-surface.l1.js
 *
 * 背景（真实事故）：
 *   renderer 里没有 node 的 path 对象，拿到的 path 来自 preload / cep-bridge /
 *   mock-bridge 三套 bridge，方法面只有 join / dirname / basename / sep
 *   （契约见 docs/BRIDGE.md §2.3）。新增代码误用 path.extname 后，
 *   L1 沙箱注入真 node path（含 extname）→ 沙箱绿灯；
 *   桌面 Electron 真机却抛 "path.extname is not a function"，点「开始」直接报错。
 *
 * 本脚本锁两件事：
 *   1) 三套 bridge 的 path 方法面必须一致，且与 BRIDGE.md 文档一致；
 *   2) renderer 侧（走 node-env 的 path）不得调用面外方法。
 *
 * 主进程文件（background.js 等，require('path') 拿真 node path）不在管辖范围。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { BRIDGE_PATH_METHODS } = require('./bridge-path')

const ROOT = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')

let passed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else {
    console.error('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
    process.exitCode = 1
  }
}

console.log('L1 bridge path 方法面守卫')

// ---- 1) 三套 bridge 的 path 方法面 ----
/** 从 marker 处开始，按花括号配对取出整个对象体 */
function objectBody (source, marker) {
  const start = source.indexOf(marker)
  assert(start >= 0, '找不到定义：' + marker)
  const from = start + marker.length
  let depth = 1
  for (let i = from; i < source.length; i++) {
    const c = source[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return source.slice(from, i)
    }
  }
  throw new Error('对象体没闭合：' + marker)
}

/** 取对象体里深度 1 的键名（`join:` / `get sep ()` / `join: function`） */
function methodsOf (source, marker) {
  const body = objectBody(source, marker)
  const names = []
  const re = /(?:^|[{;\n])\s*(?:get\s+)?([A-Za-z_$][\w$]*)\s*[:(]/g
  let m
  while ((m = re.exec(body)) !== null) {
    const n = m[1]
    if (['get', 'function', 'return', 'if', 'for', 'while'].indexOf(n) >= 0) continue
    if (names.indexOf(n) < 0) names.push(n)
  }
  return names.sort()
}

const preload = read('src/preload.js')
const mockBridge = read('src/util/mock-bridge.js')
const cepBridge = read('targets/cep/lib/cep-bridge.js')
const nodeEnv = read('src/util/node-env.js')

const preloadMethods = methodsOf(preload, '  path: {')
const mockMethods = methodsOf(mockBridge, 'function createMockPath () {')
const cepMethods = methodsOf(cepBridge, '  var path = {')
const nodeEnvMethods = methodsOf(nodeEnv, 'export const path = {')

ok('preload path 面 = ' + BRIDGE_PATH_METHODS.join(','), JSON.stringify(preloadMethods) === JSON.stringify(BRIDGE_PATH_METHODS.slice().sort()), preloadMethods)
ok('mock-bridge path 面一致', JSON.stringify(mockMethods) === JSON.stringify(BRIDGE_PATH_METHODS.slice().sort()), mockMethods)
ok('cep-bridge path 面一致', JSON.stringify(cepMethods) === JSON.stringify(BRIDGE_PATH_METHODS.slice().sort()), cepMethods)
ok('node-env path 面一致', JSON.stringify(nodeEnvMethods) === JSON.stringify(BRIDGE_PATH_METHODS.slice().sort()), nodeEnvMethods)

// ---- 2) BRIDGE.md 文档与实际一致 ----
const bridgeDoc = read('docs/BRIDGE.md')
const docStart = bridgeDoc.indexOf('### 2.3 `path`')
assert(docStart >= 0, 'BRIDGE.md 里找不到 §2.3 path 段')
const docEnd = bridgeDoc.indexOf('### ', docStart + 5)
const docSection = bridgeDoc.slice(docStart, docEnd > 0 ? docEnd : bridgeDoc.length)
const docMethods = []
const docRe = /^\|\s*([A-Za-z_$][\w$]*)\s*\|/gm
let dm
while ((dm = docRe.exec(docSection)) !== null) {
  if (docMethods.indexOf(dm[1]) < 0) docMethods.push(dm[1])
}
ok('BRIDGE.md §2.3 表格与方法面一致', JSON.stringify(docMethods.sort()) === JSON.stringify(BRIDGE_PATH_METHODS.slice().sort()), docMethods)

// ---- 3) renderer 侧（走 node-env 的 path）不得调用面外方法 ----
// 只扫「从 node-env 引入 path」的 renderer 文件；主进程 require('path') 不在其列。
function walk (dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build' || name === '.worktrees') continue
      walk(full, out)
    } else if (/\.(js|vue)$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

const files = walk(path.join(ROOT, 'src'), [])
const allowed = BRIDGE_PATH_METHODS
const violations = []
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/')
  const src = fs.readFileSync(file, 'utf8')
  // 只管「import { path ... } from '.../node-env'」的文件
  const importRe = /import\s*\{([^}]*)\}\s*from\s*['"][^'"]*node-env['"]/g
  let im
  let usesBridgePath = false
  while ((im = importRe.exec(src)) !== null) {
    if (/(^|[,\s])path(\s+as\s+\w+)?\s*(,|$)/.test(im[1])) usesBridgePath = true
  }
  if (!usesBridgePath) continue
  // 该文件里 path 绑定的本地名（path / npath 等）
  const localNames = []
  const asRe = /import\s*\{[^}]*?\bpath\s+as\s+(\w+)[^}]*\}\s*from\s*['"][^'"]*node-env['"]/g
  let am
  while ((am = asRe.exec(src)) !== null) localNames.push(am[1])
  localNames.push('path')
  for (const local of localNames) {
    const useRe = new RegExp('\\b' + local + '\\.([A-Za-z_$][\\w$]*)\\s*\\(', 'g')
    let um
    while ((um = useRe.exec(src)) !== null) {
      const m = um[1]
      if (allowed.indexOf(m) < 0) {
        violations.push({ file: rel, method: m, line: src.slice(0, um.index).split('\n').length })
      }
    }
  }
}
ok('renderer 侧未调用 bridge 面外的 path 方法', violations.length === 0, violations)

// ---- 4) node-env 的 path 不能偷偷代理面外方法 ----
const envProxy = nodeEnv.slice(nodeEnv.indexOf('export const path = {'))
const envProxyBody = envProxy.slice(0, envProxy.indexOf('}'))
ok('node-env.path 未代理面外方法', !/(extname|resolve|relative|normalize|parse|format|isAbsolute|delimiter)\s*[:(]/.test(envProxyBody), envProxyBody.trim())

console.log('\nbridge path surface L1:', passed, 'passed')
if (process.exitCode) console.error('存在失败项')
