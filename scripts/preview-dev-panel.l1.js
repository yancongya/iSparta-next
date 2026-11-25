/* L1 守卫：引导页预览台的 dev 控制台必须收在面板内部
 *
 * 契约：
 *  1. .ctrl 的 DOM 位于 .frame 内部，不再是面板外的独立侧栏；
 *  2. .app 不再用 264px 两列 grid；
 *  3. .ctrl 默认收起（translateX + opacity 0），.ctrl.open 展开；
 *  4. 切到「落地页复用」视图时 .ctrl 脱离面板，dev 主题切换仍可用；
 *  5. 面板内有 #devToggle 入口，点步骤后自动收起，Escape 也收起。
 */
'use strict'
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const file = path.join(__dirname, '..', 'scripts', 'dev', 'guide-preview', 'index.html')
const raw = fs.readFileSync(file, 'utf8')
let passed = 0
const ok = (name, cond, extra) => {
  assert.ok(cond, name + (extra ? ' :: ' + extra : ''))
  passed++
}

/* 1. DOM 位置 */
const frameAt = raw.indexOf('<div class="frame glow-full" id="frame"')
const ctrlAt = raw.indexOf('<aside class="ctrl">')
const galleryAt = raw.indexOf('<div class="gallery" id="gallery"')
const appEnd = raw.indexOf('<script>')
ok('面板 DOM 存在', frameAt > 0)
ok('控制台 DOM 存在', ctrlAt > frameAt, 'ctrlAt=' + ctrlAt + ' frameAt=' + frameAt)
ok('控制台在面板内部（早于 </main>）', ctrlAt < raw.indexOf('</main>', ctrlAt))
ok('控制台不在落地页复用区内', ctrlAt < galleryAt)
ok('app 外壳不再是两列 grid', !/\.app\{[^}]*grid-template-columns:\s*264px/.test(raw))

/* 2. 抽屉样式 */
const ctrlCss = raw.slice(raw.indexOf('.ctrl{', raw.indexOf('.app{')), raw.indexOf('.steps button{', raw.indexOf('.app{')))
ok('控制台绝对定位在面板内', /\.ctrl\{[^}]*position:absolute/.test(ctrlCss))
ok('默认收起：translateX 负位移', /\.ctrl\{[^}]*transform:translateX\(-102%\)/.test(ctrlCss))
ok('默认收起：opacity 0', /\.ctrl\{[^}]*opacity:0/.test(ctrlCss))
ok('展开态回到面板内', /\.ctrl\.open\{[^}]*transform:translateX\(0\)/.test(ctrlCss))
ok('脱离态存在（落地页复用视图）', /\.ctrl\.detached\{/.test(ctrlCss))
ok('抽屉宽度受限不铺满面板', /width:min\(214px,44%\)/.test(ctrlCss))

/* 3. 面板内入口与交互 */
ok('DEV 入口 DOM 在面板内', ctrlAt < raw.indexOf('id="devToggle"') && raw.indexOf('id="devToggle"') < raw.indexOf('id="pop"'))
ok('DEV 入口在设置控件条内', /<div class="tb-right">\s*<button class="dev-toggle" id="devToggle"/.test(raw))
ok('DEV 入口有 aria-expanded', /id="devToggle"[^>]*aria-expanded="false"/.test(raw))
ok('DEV 入口绑定开合', /devToggle\.addEventListener\('click'/.test(raw))
ok('定义 closeDev 收起函数', /function closeDev \(\) \{[\s\S]{0,140}classList\.remove\('open'\)/.test(raw))
ok('点步骤后自动收起', /stepBtns\.forEach[\s\S]{0,220}closeDev\(\)/.test(raw))
ok('Escape 同时收起控制台', /if \(e\.key === 'Escape'\) \{ closePop\(\); closeDev\(\) \}/.test(raw))

/* 4. 视图切换时脱离/回归 */
ok('切回向导时控制台回归面板', /frame\.insertBefore\(ctrl, frame\.firstChild\)/.test(raw))
ok('切到复用视图时控制台脱离', /appRoot\.insertBefore\(ctrl, appRoot\.firstChild\)/.test(raw))
ok('脱离态解除收起', /closeDev\(\)/.test(raw.slice(raw.indexOf("initSeg('segView'"), raw.indexOf("initSeg('segRuntime'"))))
ok('dev 主题组在复用视图下仍可用', /devThemeGroup\.hidden = wizard/.test(raw))

/* 5. 抽屉内 7 步一屏可见（压缩节奏） */
ok('步骤列表间距压缩', /\.ctrl \.steps\{gap:0\}/.test(raw))
ok('步骤按钮压缩内边距', /\.ctrl \.steps button\{font-size:11px;padding:3px 6px\}/.test(raw))
ok('次要说明在抽屉内隐藏', /\.ctrl \.note\{display:none\}/.test(raw))
ok('脱离后恢复完整说明', /\.ctrl\.detached \.note\{display:block/.test(raw))

console.log('preview-dev-panel.l1: ' + passed + ' checks passed')
