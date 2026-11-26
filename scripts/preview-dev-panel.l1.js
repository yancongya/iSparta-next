/* L1 守卫：引导页预览台的 dev 控制台为「页面级固定侧栏」，面板独立居中
 *
 * 契约（2026-11-26 三次改判：对齐页面左边缘，回应"控制台不是对齐页面、面板居中，而是他们一起居中"反馈）：
 *  1. .ctrl 的 DOM 在 .app 顶层、与 .stage 平级，不再在 .frame 内（不再跟面板绑成一体居中）；
 *  2. .ctrl position:fixed，贴页面左边缘 + 上下贴边占满可用高度（真正对齐页面、7 步一屏可见）；
 *  3. .app 不再用 264px 两列 grid，也不再给 ctrl 宽度/高度绑定面板变量；
 *  4. 面板右上 DEV 按钮切换 .ctrl.collapsed（translateX 滑出左缘），默认展开可见；
 *  5. 点步骤 / Escape 不再收起控制台（真正常驻）；
 *  6. .ctrl 半透明 + backdrop blur 保留 alpha 观感；
 *  7. 视图切换不再 insertBefore 搬运控制台（已在页面层），仅切 frame/gallery/devThemeGroup 的 hidden；
 *  8. .stage height:100% 铺满窗口（面板居中于整个预览窗口）。
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

/* 1. DOM 位置：控制台在 app 顶层、面板之外 */
const appOpen = raw.indexOf('<div class="app" id="app"')
const stageAt = raw.indexOf('<main class="stage">')
const frameAt = raw.indexOf('<div class="frame glow-full" id="frame"')
const ctrlAt = raw.indexOf('<aside class="ctrl">')
ok('app 外壳存在', appOpen > 0)
ok('控制台 DOM 存在', ctrlAt > appOpen)
ok('控制台在面板之外（早于 stage）', ctrlAt > appOpen && ctrlAt < stageAt)
ok('控制台不在面板内部（早于 frame）', ctrlAt < frameAt)
ok('控制台在 stage 之前结束（不在面板里）', raw.indexOf('</aside>', ctrlAt) < stageAt)
ok('app 外壳不再是两列 grid', !/\.app\{[^}]*grid-template-columns:\s*264px/.test(raw))

/* 2. 页面级固定定位：贴左边缘 + 上下贴边 */
const ctrlCss = raw.slice(raw.indexOf('.ctrl{', raw.indexOf('.app{')), raw.indexOf('.ctrl h1{', raw.indexOf('.app{')))
ok('控制台 fixed 定位', /(?:^|\n)\.ctrl\{[^}]*position:fixed/.test(ctrlCss))
ok('贴页面左边缘 left:var(--is-s-6)', /(?:^|\n)\.ctrl\{[^}]*left:var\(--is-s-6\)/.test(ctrlCss))
ok('上下贴边 top:var(--is-s-6)', /(?:^|\n)\.ctrl\{[^}]*top:var\(--is-s-6\)/.test(ctrlCss))
ok('上下贴边 bottom:var(--is-s-6)', /(?:^|\n)\.ctrl\{[^}]*bottom:var\(--is-s-6\)/.test(ctrlCss))
ok('固定宽度 264px', /(?:^|\n)\.ctrl\{[^}]*width:264px/.test(ctrlCss))
ok('不再绑定面板高度变量/负 margin', !/margin-top:-\d+px/.test(ctrlCss) && !/\.ctrl\{[^}]*height:\d+px/.test(ctrlCss))
ok('半透明背景保留 alpha', /(?:^|\n)\.ctrl\{[^}]*background:color-mix\(in srgb,var\(--is-panel\) 88%,transparent\)/.test(ctrlCss))
ok('backdrop blur 保留毛玻璃', /(?:^|\n)\.ctrl\{[^}]*backdrop-filter:blur\(14px\)/.test(ctrlCss))

/* 3. 收起态：.ctrl.collapsed 滑出左缘 */
ok('收起态由 .ctrl.collapsed 驱动', /\.ctrl\.collapsed\{transform:translateX\(calc\(-100%[^}]*opacity:0/.test(ctrlCss))
ok('不再有旧的 .frame.ctrl-collapsed 契约', !/ctrl-collapsed/.test(raw))
ok('不再有 detached 契约', !/detached/.test(raw))

/* 4. 舞台铺满 + 面板独立居中 */
ok('舞台铺满窗口高度', /\.stage\{[\s\S]{0,300}height:100%/.test(raw))
ok('舞台 place-items:center 让面板居中', /\.stage\{[^}]*place-items:center/.test(raw))

/* 5. 面板内 DEV 入口与交互 */
const devToggleAt = raw.indexOf('id="devToggle"')
ok('DEV 入口 DOM 在面板内', frameAt < devToggleAt && devToggleAt < raw.indexOf('</div>\n  </main>', frameAt))
ok('DEV 入口默认 aria-expanded=true（展开态）', /id="devToggle"[^>]*aria-expanded="true"/.test(raw))
ok('DEV 入口绑定开合', /devToggle\.addEventListener\('click'/.test(raw))
ok('开合切换 .ctrl.collapsed', /ctrl\.classList\.toggle\('collapsed', collapsed\)/.test(raw))
ok('点步骤不再收起控制台', !/stepBtns\.forEach[\s\S]{0,220}closeDev\(\)/.test(raw))
ok('Escape 不再收起控制台', !/if \(e\.key === 'Escape'\) \{ closePop\(\); closeDev\(\) \}/.test(raw))

/* 6. 视图切换不再搬运控制台 */
ok('视图切换无 frame.insertBefore(ctrl)', !/frame\.insertBefore\(ctrl/.test(raw))
ok('视图切换无 appRoot.insertBefore(ctrl)', !/appRoot\.insertBefore\(ctrl/.test(raw))
ok('视图切换仍切 gallery hidden', /gallery\.hidden = wizard/.test(raw))
ok('dev 主题组在复用视图下仍可用', /devThemeGroup\.hidden = wizard/.test(raw))

/* 7. 控制台完整节奏（页面层空间充足，7 步一屏可见） */
ok('步骤列表正常间距（非压缩 gap:0）', /\.ctrl \.steps\{gap:2px\}/.test(raw))
ok('步骤按钮完整内边距', /\.ctrl \.steps button\{font-size:var\(--is-fs-md\);padding:7px var\(--is-s-2\)\}/.test(raw))
ok('说明文字在页面层侧栏显示', /\.ctrl \.note\{display:block/.test(raw))

console.log('preview-dev-panel.l1: ' + passed + ' checks passed')
