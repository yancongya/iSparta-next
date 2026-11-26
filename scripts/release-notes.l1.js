/**
 * L1：应用内「更新日志」链路守卫（纯 Node，不启浏览器）
 * 用法：node scripts/release-notes.l1.js
 *
 * 覆盖：烘焙数据与 .github/release-notes 源一致 / 三语 key / 关于面板按钮 /
 * 全局单实例挂载 / CEP 铺满与 teleport 作用域 / 只读不联网 / 格式化单一来源。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

function main () {
  console.log('L1 应用内更新日志')

  const generated = read('src/generated/releaseNotes.js')
  const util = read('src/util/releaseNotes.js')
  const state = read('src/ui-next/releaseNotesDialog.js')
  const dialog = read('src/ui-next/components/IsReleaseNotesDialog.vue')
  const setting = read('src/components/globalSetting/globalSetting.vue')
  const home = read('src/ui-next/views/Home.vue')

  // ---- 1) 烘焙数据必须与编辑源逐字一致（防手改生成文件 / 忘重跑脚本） ----
  const notesMatch = generated.match(/export const RELEASE_NOTES = (\{[\s\S]*?\n\})/)
  ok('生成文件含 RELEASE_NOTES', !!notesMatch)
  let notes = null
  if (notesMatch) {
    try { notes = JSON.parse(notesMatch[1]) } catch (e) { /* fail below */ }
  }
  ok('RELEASE_NOTES 是合法 JSON 对象', !!notes && typeof notes === 'object')
  if (notes) {
    const files = fs.readdirSync(path.join(ROOT, '.github', 'release-notes'))
      .filter((n) => /^v\d+\.\d+\.\d+.*\.md$/.test(n))
    ok('版本条目数与源文件数一致', Object.keys(notes).length === files.length, { generated: Object.keys(notes).length, source: files.length })
    let drift = []
    files.forEach((name) => {
      const v = name.slice(1, -3)
      if (notes[v] !== read('.github/release-notes/' + name)) { drift.push(v) }
    })
    ok('全部版本原文与编辑源一致', drift.length === 0, { drift })
    const versionsMatch = generated.match(/export const RELEASE_VERSIONS = (\[[^\n]*\])/)
    const versions = versionsMatch ? JSON.parse(versionsMatch[1]) : []
    // 动态校验（不写死版本号，发版烘焙后自动通过）：与源文件集合一致 + 严格 semver 倒序
    const srcVersions = files.map((n) => n.slice(1, -3))
    const sameSet = versions.length === srcVersions.length &&
      srcVersions.every((v) => versions.indexOf(v) >= 0)
    const cmp = (a, b) => {
      const x = String(a).split('.').map(Number); const y = String(b).split('.').map(Number)
      for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] - y[i] }
      return 0
    }
    const strictDesc = versions.length > 0 && versions.every((v, i) => i === 0 || cmp(versions[i - 1], v) > 0)
    ok('版本列表倒序（新→旧，与源文件集合一致）', sameSet && strictDesc,
      { first: versions[0], last: versions[versions.length - 1], count: versions.length })
  }

  // ---- 2) 格式化走 formatReleaseNotes 单一来源，不在 UI 重写解析 ----
  ok('util 复用 formatReleaseNotes', /import \{ formatReleaseNotes \}[^\n]*from '\.\/updateCheck'/.test(util))
  ok('util 不自行 split 日志正文', !/split\(\/\\r\?\\n\/\)/.test(util))
  ok('util 替换 TAG 占位', /TAG/.test(util) && /replace\(/.test(util))
  ok('util 取 package.json 版本单一来源', /currentVersion \(\)[\s\S]*?cleanVersion\(APP_VERSION\)/.test(util))

  // formatReleaseNotes 实际跑一遍：概要 + 【新增】分组，且不漏「体验优化」条目
  {
    const raw = read('src/util/updateCheck.js')
    const start = raw.indexOf('export function formatReleaseNotes')
    const end = raw.indexOf('export function isAllowedExternalUrl', start)
    const fnSource = raw.slice(start, end > start ? end : undefined)
    const sandbox = { String, Object, Array, RegExp, console }
    vm.createContext(sandbox)
    vm.runInContext(fnSource.replace(/^export\s+/, '') + '\n;this.fmt = formatReleaseNotes;', sandbox, { filename: 'updateCheck.js(l1)' })
    const text = sandbox.fmt(notes && notes['3.10.2'])
    ok('3.10.2 日志格式化非空', !!text)
    ok('格式化含首屏概要条目', /开启压缩/.test(text || ''), { head: String(text || '').slice(0, 60) })
    ok('格式化含【新增】分组', /【新增】/.test(text || ''))
    ok('格式化不含安装包噪音', !/Installers|latest\.yml/.test(text || ''))
  }

  // ---- 3) 三语文案齐 ----
  ;['zh-cn', 'zh-tw', 'en-us'].forEach((locale) => {
    const text = read('src/locales/' + locale + '.js')
    ok(locale + ' 有 aboutReleaseNotes', /"aboutReleaseNotes":"[^"]+"/.test(text))
    ok(locale + ' 有 aboutReleaseNotesVersion', /"aboutReleaseNotesVersion":"[^"]+"/.test(text))
  })

  // ---- 4) 关于面板按钮 + 全局单实例 ----
  ok('关于面板有更新日志按钮', /@click="openReleaseNotes\(\)"/.test(setting) && /\$t\('aboutReleaseNotes'\)/.test(setting))
  ok('按钮调用不带事件参数（否则版本号变成 PointerEvent）', !/@click="openReleaseNotes"(?!\()/.test(setting))
  ok('设置面板 import 全局开关', /import \{ openReleaseNotes \}[^\n]*releaseNotesDialog/.test(setting))
  ok('methods 暴露 openReleaseNotes', /methods: \{[\s\S]{0,160}openReleaseNotes,/.test(setting))
  ok('Home 挂载且仅挂一次', (home.match(/<is-release-notes-dialog[\s/>]/g) || []).length === 1)
  ok('Home 注册组件', /'is-release-notes-dialog': IsReleaseNotesDialog/.test(home))
  ok('全局 state 用 Vue.observable', /Vue\.observable\(\{/.test(state))
  ok('open 设置版本与 visible', /releaseNotesState\.version = version \|\| currentVersion\(\)/.test(state) && /releaseNotesState\.visible = true/.test(state))

  // ---- 5) 弹窗契约：CEP 上下左右铺满 + 内部滚动、teleport 锚点、只读 ----
  ok('CEP 用 rn-dialog 铺满', /isCep \? 'rn-dialog' : ''/.test(dialog) && /is-dialog\.rn-dialog\s*\{\s*padding: 6px/.test(dialog))
  ok('CEP panel 100% 宽', /rn-panel rn-panel--full/.test(dialog) && /\.is-dialog__panel\.rn-panel--full\s*\{\s*width: 100%/.test(dialog))
  const rnFull = (dialog.match(/\.is-dialog__panel\.rn-panel--full\s*\{([\s\S]*?)\}/) || [])[1] || ''
  ok('CEP panel 上下也铺满', /width:\s*100%/.test(rnFull) && /height:\s*calc\(100vh - 12px\)/.test(rnFull) && /max-height:\s*calc\(100vh - 12px\)/.test(rnFull))
  ok('滚动收进弹窗内部（body 不滚）', /\.rn-panel \.is-dialog__body\s*\{[^}]*overflow:\s*hidden/.test(dialog))
  ok('滚动区吃满剩余高度', /\.rn\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/.test(dialog) && /\.rn-panel \.upd__notes-fade\s*\{[^}]*flex:\s*1/.test(dialog) && /\.rn-panel \.upd__notes-fade\s*\{[^}]*max-height:\s*none/.test(dialog))
  ok('展开/收起链接在滚动内容末尾（不贴面板底）', /<is-scroll-fade[\s\S]*upd__notes-fade[\s\S]*upd__notes-toggle[\s\S]*<\/is-scroll-fade>/.test(dialog))
  ok('宽度按宿主切换', /dialogWidth \(\) \{ return this\.isCep \? '100%' : '480px' \}/.test(dialog))
  const dialogNoComments = dialog.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  ok('样式锚点不依赖外部 wrapper', !/\.globalsetting\s+\.rn-/.test(dialogNoComments))
  ok('弹窗只读：不 import updateService', !/updateService/.test(dialog))
  ok('弹窗不发网络请求', !/fetch\(|runUpdateCheck/.test(dialog))
  ok('支持按版本切换', /versionOptions \(\)/.test(dialog) && /activeVersion:/.test(dialog))
  ok('摘要/详细展开', /hasDetail/.test(dialog) && /visibleItems/.test(dialog) && /updateNotesExpand/.test(dialog))
  ok('关闭走全局 close', /closeReleaseNotes\(\)/.test(dialog))
  ok('不渲染底部关闭按钮（只留右上角 X）', !/<template #footer>/.test(dialog))
  ok('CSS 兜底隐藏残留 footer', /\.rn-panel \.is-dialog__footer\s*\{\s*display: none/.test(dialog))
  ok('去掉 panel 聚焦描边', /\.rn-panel\s*\{[^}]*outline: none/.test(dialog))

  // ---- 5a) CEP 关于区双列错位修复 ----
  {
    const scss = read('src/components/globalSetting/globalSetting.scss')
    ok('关于区有独立 pair 类', /gs-pair gs-pair--about/.test(setting))
    ok('CEP 关于区改单列避免按钮错位', /\.gs-pair--about\s*\{\s*grid-template-columns: 1fr/.test(scss))
    ok('CEP 关于区控件不换行', /\.gs-pair--about \.gs-pair__ctrl\s*\{\s*flex-wrap: nowrap/.test(scss))
  }

  // ---- 5b) 更新/升级说明 CEP 上下铺满（用户 11-26 拍板；更新日志见 §5：同样铺满但滚动在内部） ----
  {
    const ui = read('src/ui-next/styles/ui.scss')
    const own = read('src/ui-next/onboarding/OnboardingWhatsNew.vue')
    ok('更新弹窗 CEP 上下铺满', /\.is-dialog__panel\.upd-panel--full\s*\{[^}]*height: calc\(100vh - 12px\)/.test(ui))
    ok('升级说明 CEP 上下铺满', /\.own--cep \.own-card\s*\{[^}]*height: 100%/.test(own))
    ok('升级说明 CEP 主按钮沉底', /\.own--cep \.own-cta\s*\{[^}]*margin-top: auto/.test(own))
  }

  // ---- 6) 烘焙脚本可重复执行且产物稳定 ----
  {
    const before = generated
    require('child_process').execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'bake-release-notes.js')], { cwd: ROOT, stdio: 'ignore' })
    const after = read('src/generated/releaseNotes.js')
    ok('重复烘焙产物稳定', before === after)
  }

  console.log('\nrelease-notes L1:', passed, 'passed,', failed, 'failed')
  if (failed) { process.exitCode = 1 }
}

try { main() } catch (e) { console.error(e); process.exitCode = 1 }
