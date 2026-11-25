/**
 * L1：全局设置弹窗本轮改动守卫（纯 Node 源码级，无浏览器）
 * 用法：node scripts/gs-settings-ui.l1.js
 *
 * 覆盖：
 * A) 环境检查工具路径 bug 修复（带平台子目录）→ 见 toolchain-integrity.l1.js
 * B) 常规 Tab 端口配置：两端默认 + 立即生效 + 持久化
 * C) 标题栏布局切换：header-actions slot + allInOne + 独立持久化
 * D) 面板样式不挤：hint 有行高/换行约束、button 用专有类名
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

function run () {
  const gs = read('src/components/globalSetting/globalSetting.vue')
  const gsc = read('src/components/globalSetting/globalSetting.scss')
  const dialog = read('src/ui-next/components/ui/IsDialog.vue')
  const uiscss = read('src/ui-next/styles/ui.scss')
  const host = read('src/util/debugLogHost.js')
  const login = read('src/ui-next/log.js')
  const home = read('src/ui-next/views/Home.vue')

  // ---- B) 端口配置 ----
  ok('常规 tab 有端口输入', /debugLogPort/.test(gs) && /\$t\('debugPort'\)/.test(gs))
  ok('端口存 debugLog.port', /o\.debugLog, 'port'/.test(gs))
  ok('端口 change 触发立即生效', /@change="onDebugPortChange"/.test(gs))
  ok('端口改动后 disable+enable 重启', /onDebugPortChange[\s\S]{0,400}c\.disable\(\)[\s\S]{0,200}c\.enable\(\)/.test(gs))
  ok('两端默认端口不同', /this\.isCep \? CEP_DEBUG_LOG_PORT : DESKTOP_DEBUG_LOG_PORT/.test(gs))
  ok('host 端口单例可写', /setDebugLogPort/.test(host) && /hasConfiguredPort/.test(host))
  ok('log enable 前同步端口（已配置则不覆盖）', /hasConfiguredPort\(\)/.test(login) && /syncPortFromSetting/.test(login))
  ok('Home 自动开启保留 enabled 读取', /setting\.options\.debugLog\.enabled/.test(home))

  // 本地调试日志开关归类：开关 + 端口都在常规 tab，关于 tab 不再有开关
  const generalPane = (gs.match(/activeTab === 'general'[\s\S]*?<\/div><!-- \/常规 -->/) || [''])[0]
  const aboutPane = (gs.match(/activeTab === 'about'[\s\S]*?<\/div><!-- \/关于 -->/) || [''])[0]
  ok('调试日志开关在常规 tab', /debugToggle/.test(generalPane) && /debugPort/.test(generalPane))
  ok('关于 tab 不再有调试日志开关', !/debugToggle/.test(aboutPane))

  // ---- C) 标题栏布局切换 ----
  ok('IsDialog 提供 header-actions slot', /\$slots\['header-actions'\]/.test(dialog))
  ok('IsDialog 渲染 header-actions 容器', /is-dialog__header-actions/.test(dialog))
  ok('全局设置使用 header-actions', /#header-actions/.test(gs))
  ok('布局切换按钮存在', /gs-layout-toggle/.test(gs) && /toggleGsAllInOne/.test(gs))
  ok('切换图标 grid/list 双态', /gsAllInOne \? 'grid' : 'list'/.test(gs))
  ok('切 tab bar 随 allInOne 隐藏', /v-if="!gsAllInOne" class="gs-tabs-bar"/.test(gs))
  ok('四个 pane 都带 allInOne 条件', (gs.match(/v-show="gsAllInOne \|\| activeTab ===/g) || []).length === 4)
  ok('布局独立持久化 key', /uiGlobalSettingAllInOne/.test(gs))
  ok('header-actions 样式靠右', /__header-actions/.test(uiscss) && /margin-left:\s*auto/.test(uiscss))

  // ---- D) 样式不挤：专有类名 + 间距约束 ----
  ok('布局按钮用专有类 gs-layout-toggle（不撞 is-tag/is-info）', /\.gs-layout-toggle/.test(gsc))
  ok('全部一页模式有段间分隔', /\.gs-pane \+ \.gs-pane/.test(gsc))
  ok('hint 有行高', /line-height:\s*1\.6/.test(gsc) || /line-height/.test(gsc))
  ok('弹窗固定高度仍在（不因切换跳动）', /height:\s*600px/.test(gsc))

  // ---- E) teleport 作用域：样式根必须含 .gs-dialog，否则 dialog 提到 body 后全失效 ----
  // IsDialog 默认 toBody=true，open() 把弹窗 append 到 document.body，
  // <section class="globalsetting"> 变空壳。样式根若只有 .globalsetting，
  // teleport 后 .globalsetting .xxx 全部失配 → 按钮白底方块、面板竖排挤成一团。
  ok('IsDialog 默认 toBody（弹窗会脱离原 DOM 树）', /toBody:\s*\{[\s\S]{0,120}default:\s*true/.test(dialog))
  ok('样式根选择器含 .gs-dialog（跟随 teleport 后的弹窗节点）', /^\.globalsetting,\s*\n?\.gs-dialog\s*\{/m.test(gsc))
  ok('CEP 窄面板选择器也用 .gs-dialog', /html\.is-cep \.gs-dialog \.gs-tabs-bar/.test(gsc))
  const rootSel = (gsc.match(/^\.globalsetting[^\n]*\{/m) || [''])[0]
  ok('样式根不是裸 .globalsetting 单选择器', !/^\.globalsetting\s*\{/m.test(gsc), rootSel)

  console.log('\n[gs-settings-ui] ' + passed + ' passed, ' + failed + ' failed')
  if (failed) process.exitCode = 1
}

try { run() } catch (e) { console.error(e); process.exitCode = 1 }
