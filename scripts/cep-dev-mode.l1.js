/**
 * L1：CEP 开发位独立 ID 切换（cep-mode.js v2）守卫。
 * 用法：node scripts/cep-dev-mode.l1.js
 *
 * 锁死四条契约：
 *  ① 开发位 ID 与生产 ID 独立（io.github.isparta-next.dev ≠ io.github.isparta-next）；
 *  ② buildDevManifest 从生产 manifest 派生，只换 ID/菜单/MainPath，结构其余不变；
 *  ③ 源码 targets/cep/CSXS/manifest.xml 只读、不被任何写入路径污染；
 *  ④ dev 走 serve:cep（不改 manifest），restore 删开发位真实目录且不碰系统级。
 *
 * 用 vm 沙箱加载真实 cep-mode.js，把末尾 main() 换成导出，实测 buildDevManifest。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const SCRIPT = path.join(__dirname, '..', 'scripts', 'dev', 'cep-mode.js')
const SRC_MANIFEST = path.join(ROOT, 'targets', 'cep', 'CSXS', 'manifest.xml')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed += 1; console.log('  PASS', name) } else { failed += 1; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

const raw = fs.readFileSync(SCRIPT, 'utf8')

// ---- 静态契约 ----
ok('① 生产 ID 常量仍为 io.github.isparta-next', /const EXT_ID = 'io\.github\.isparta-next'/.test(raw))
ok('① 开发位 ID 独立且带 .dev', /const DEV_EXT_ID = 'io\.github\.isparta-next\.dev'/.test(raw))
ok('① 用户级挂载位用 DEV_EXT_ID（非生产 ID）', /extensions', DEV_EXT_ID\)/.test(raw))
ok('③ 源码 manifest 仅 readFileSync，无写入',
  /readFileSync\(MANIFEST, 'utf8'\)/.test(raw) &&
  !/writeFileSync\(MANIFEST/.test(raw) &&
  !/writeFileSync\(path\.join\(SOURCE, 'CSXS'/.test(raw))
ok('③ dev 用 serve:cep（不改源码 manifest），非 dev:cep',
  /\['run', 'serve:cep'\]/.test(raw) && !/\['run', 'dev:cep'\]/.test(raw))
ok('④ restore 先删内部 junction 再 rmSync 开发位',
  /fs\.unlinkSync\(p\)/.test(raw) && /fs\.rmSync\(USER_EXT/.test(raw))
ok('④ restore 不碰系统级（无对 SYSTEM_EXT 的 rm/unlink）',
  !/rmSync\(SYSTEM_EXT/.test(raw) && !/unlinkSync\(SYSTEM_EXT/.test(raw))
ok('④ 链接清单含 ui/jsx 与 dev-hmr.html',
  /LINK_DIRS = \[[^\]]*'ui'[^\]]*'jsx'/.test(raw) && /LINK_FILES = \[[^\]]*'dev-hmr\.html'/.test(raw))

// ---- 动态契约：vm 加载真实脚本，导出 buildDevManifest 实测 ----
const sandbox = {
  require: (m) => {
    if (m === 'fs') return fs
    if (m === 'path') return path
    if (m === 'child_process') return { spawn: () => ({ on: () => {} }) }
    throw new Error('unexpected require: ' + m)
  },
  console: { log: () => {}, error: () => {} },
  process: {
    platform: 'win32',
    env: { APPDATA: 'C:\\Users\\Test\\AppData\\Roaming' },
    argv: ['node', 'cep-mode.js', 'status'],
    exitCode: 0
  },
  __dirname: path.dirname(SCRIPT),
  module: { exports: {} }
}
// 去掉末尾裸调用 main()，改为导出内部函数供断言
const instrumented = raw.replace(/\nmain\(\)\s*$/, '\nglobalThis.__api = { buildDevManifest, DEV_EXT_ID, EXT_ID, USER_EXT, SYSTEM_EXT }\n')
vm.runInNewContext(instrumented, sandbox, { filename: 'cep-mode.js' })
const api = sandbox.__api
ok('vm 加载成功并导出 buildDevManifest', !!(api && typeof api.buildDevManifest === 'function'))

if (api) {
  const prod = fs.readFileSync(SRC_MANIFEST, 'utf8')
  const dev = api.buildDevManifest()

  ok('② dev manifest BundleId 已换独立 ID',
    /ExtensionBundleId="io\.github\.isparta-next\.dev"/.test(dev))
  ok('② 两处 <Extension Id> 都换独立 ID',
    (dev.match(/<Extension Id="io\.github\.isparta-next\.dev"/g) || []).length === 2 &&
    !/<Extension Id="io\.github\.isparta-next"/.test(dev))
  ok('② 菜单名带 DEV 可区分', /<Menu>io\.github\.isparta-next · DEV<\/Menu>/.test(dev))
  ok('② MainPath 指向 dev-hmr.html', /<MainPath>\.\/dev-hmr\.html<\/MainPath>/.test(dev))
  ok('② Host/RequiredRuntime 等结构原样保留',
    /<Host Name="AEFT" Version="\[15\.0,99\.9\]"\/>/.test(dev) &&
    /<RequiredRuntime Name="CSXS" Version="6\.0"\/>/.test(dev))
  ok('② dev manifest 与生产差异仅限预期字段（行数一致）',
    dev.split('\n').length === prod.split('\n').length)
  ok('② 生产 manifest 未被 buildDevManifest 改写（仍是生产 ID）',
    /ExtensionBundleId="io\.github\.isparta-next"/.test(fs.readFileSync(SRC_MANIFEST, 'utf8')))
}

// ---- v1 废弃契约（用户 11-27「真实发版与本地 dev 热更要分开」）----
// 根因：v1 cep-manifest-dev.js 直接 writeFileSync 改写源码 manifest 的 MainPath，
// 热更后忘 off 就把生产配置污染成 dev-hmr.html。现把 v1 收敛为转发器，
// 生产/manifest 与 dev 彻底分开，以下几组断言防止回退。
const LEGACY = path.join(ROOT, 'scripts', 'cep-manifest-dev.js')
const legacy = fs.readFileSync(LEGACY, 'utf8')
const pkg = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
const devAll = fs.readFileSync(path.join(ROOT, 'scripts', 'dev-all.js'), 'utf8')
const liveManifest = fs.readFileSync(SRC_MANIFEST, 'utf8')

ok('v1 转发器不再写源码 manifest', !/writeFileSync\s*\(/.test(legacy))
ok('v1 转发器 on→dev、off→restore',
  /=== 'on' \? 'dev' : 'restore'/.test(legacy) && /cep-mode\.js/.test(legacy))
ok('源码 manifest 当前恒为生产值 ./ui/index.html',
  /<MainPath>\.\/ui\/index\.html<\/MainPath>/.test(liveManifest) &&
  !/dev-hmr\.html/.test(liveManifest))
ok('package.json dev:cep/dev:cep:off 走 v2',
  /"dev:cep":\s*"node scripts\/dev\/cep-mode\.js dev"/.test(pkg) &&
  /"dev:cep:off":\s*"node scripts\/dev\/cep-mode\.js restore"/.test(pkg))
ok('package.json build:windows 不再调 v1 off',
  !/cep-manifest-dev\.js off/.test(pkg))
ok('dev-all.js 不直接调 v1（dev:cep 经转发到 v2）',
  !/cep-manifest-dev\.js/.test(devAll) && /restore/.test(devAll))
// 全仓禁止任何脚本 writeFileSync 源码 manifest（排除守卫自身文本与 node_modules）
function scanWriters (dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'dist_electron' || name === '.tmp') continue
    const p = path.join(dir, name)
    let st
    try { st = fs.statSync(p) } catch (e) { continue }
    if (st.isDirectory()) { scanWriters(p, out); continue }
    if (!/\.(js|cjs)$/.test(name) || p === __filename) continue
    const txt = fs.readFileSync(p, 'utf8')
    // 只抓写「源码 manifest」：字面 CSXS/manifest.xml 路径，或名为 MANIFEST 的常量。
    // v2 写用户级 DEV_MANIFEST 是合法的，用否定前缀排除 DEV_/USER_ 前缀常量。
    const hit = /(?:writeFileSync|appendFileSync)\([^,)]*['"`][^'"`]*(?:CSXS[\/\\]manifest\.xml|CSXS['"`]|manifest\.xml)/.test(txt) ||
      /(?:^|[^\w])(?:fs\.)?writeFileSync\(MANIFEST\b/.test(txt)
    if (hit) out.push(path.relative(ROOT, p))
  }
}
const writers = []
scanWriters(path.join(ROOT, 'scripts'), writers)
ok('全仓 scripts 无脚本写入源码/任何 manifest', writers.length === 0, writers)

console.log('\n' + passed + ' passed, ' + failed + ' failed')
process.exitCode = failed ? 1 : 0
