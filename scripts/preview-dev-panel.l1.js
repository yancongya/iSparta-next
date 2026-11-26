/* L1 守卫：引导页预览台的 dev 控制台浮在面板内、默认展开可见
 *
 * 契约（2026-11-26 再改判：浮层不挤内容，回应"控制台被收缩/四周裁切"反馈）：
 *  1. .ctrl 的 DOM 位于 .frame 内部，不再是面板外的独立侧栏；
 *  2. .app 不再用 264px 两列 grid；
 *  3. .ctrl 绝对定位浮层、默认展开（无 translateX 负位移、无 opacity 0），
 *     宽度 min(214px,44%) 自适应，CEP 下不再写死 176px；
 *  4. 内容区（.dots/.screen/.foot）不 margin-left 让位——内容铺满整个面板；
 *  5. 只有 .frame.ctrl-collapsed 才滑出收起（DEV 按钮手动），无需内容回铺；
 *  6. .ctrl 半透明 + backdrop blur 保留 alpha 观感；
 *  7. 点步骤 / Escape 不再收起控制台（真正常驻可见）；
 *  8. 切到「落地页复用」视图时 .ctrl 脱离面板，dev 主题切换仍可用。
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
ok('面板 DOM 存在', frameAt > 0)
ok('控制台 DOM 存在', ctrlAt > frameAt, 'ctrlAt=' + ctrlAt + ' frameAt=' + frameAt)
ok('控制台在面板内部（早于 </main>）', ctrlAt < raw.indexOf('</main>', ctrlAt))
ok('控制台不在落地页复用区内', ctrlAt < galleryAt)
ok('app 外壳不再是两列 grid', !/\.app\{[^}]*grid-template-columns:\s*264px/.test(raw))

/* 2. 浮层样式：默认展开、不挤内容 */
const ctrlCss = raw.slice(raw.indexOf('.ctrl{', raw.indexOf('.app{')), raw.indexOf('.steps button{', raw.indexOf('.app{')))
ok('控制台绝对定位浮层', /(?:^|\n)\.ctrl\{[^}]*position:absolute/.test(ctrlCss))
ok('宽度 min(214px,44%) 自适应，不再写死 176px', /(?:^|\n)\.ctrl\{[^}]*width:min\(214px,44%\)/.test(ctrlCss))
ok('不再有 --ctrl-w 变量', !/--ctrl-w/.test(raw))
ok('半透明背景保留 alpha', /(?:^|\n)\.ctrl\{[^}]*background:color-mix\(in srgb,var\(--is-panel\) 88%,transparent\)/.test(ctrlCss))
ok('backdrop blur 保留毛玻璃', /(?:^|\n)\.ctrl\{[^}]*backdrop-filter:blur\(14px\)/.test(ctrlCss))
ok('默认不藏：无 translateX 负位移', !/(?:^|\n)\.ctrl\{[^}]*transform:translateX\(-\d+%\)/.test(ctrlCss))
ok('默认不藏：无 opacity 0', !/(?:^|\n)\.ctrl\{[^}]*opacity:0/.test(ctrlCss))
ok('收起态由 .frame.ctrl-collapsed 驱动', /\.frame\.ctrl-collapsed \.ctrl\{transform:translateX\(-102%\)/.test(ctrlCss))
ok('脱离态存在（落地页复用视图）', /\.ctrl\.detached\{/.test(ctrlCss))
ok('脱离态恢复不透明（脱离面板无需 alpha）', /\.ctrl\.detached\{[^}]*background:var\(--is-panel\)/.test(ctrlCss))

/* 3. 内容铺满：不 margin-left 让位 */
ok('内容区不再右让（无 margin-left:var(--ctrl-w)）', !/\.frame \.dots,\.frame \.screen,\.frame \.foot\{[^}]*margin-left:var\(--ctrl-w/.test(ctrlCss))
ok('无收起回铺规则', !/\.frame\.ctrl-collapsed \.dots/.test(ctrlCss))
ok('内容铺满注释在', /内容始终铺满面板：控制台是浮层，不占布局宽度/.test(ctrlCss))

/* 4. 面板内入口与交互 */
ok('DEV 入口 DOM 在面板内', ctrlAt < raw.indexOf('id="devToggle"') && raw.indexOf('id="devToggle"') < raw.indexOf('id="pop"'))
ok('DEV 入口在设置控件条内', /<div class="tb-right">\s*<button class="dev-toggle" id="devToggle"/.test(raw))
ok('DEV 入口默认 aria-expanded=true（展开态）', /id="devToggle"[^>]*aria-expanded="true"/.test(raw))
ok('DEV 入口绑定开合', /devToggle\.addEventListener\('click'/.test(raw))
ok('定义 closeDev 恢复展开函数', /function closeDev \(\) \{[\s\S]{0,140}classList\.remove\('ctrl-collapsed'\)/.test(raw))
ok('点步骤不再收起控制台', !/stepBtns\.forEach[\s\S]{0,220}closeDev\(\)/.test(raw))
ok('Escape 不再收起控制台', !/if \(e\.key === 'Escape'\) \{ closePop\(\); closeDev\(\) \}/.test(raw))

/* 5. 视图切换时脱离/回归 */
ok('切回向导时控制台回归面板', /frame\.insertBefore\(ctrl, frame\.firstChild\)/.test(raw))
ok('切到复用视图时控制台脱离', /appRoot\.insertBefore\(ctrl, appRoot\.firstChild\)/.test(raw))
ok('脱离视图仍恢复展开态', /closeDev\(\)/.test(raw.slice(raw.indexOf("initSeg('segView'"), raw.indexOf("initSeg('segRuntime'"))))
ok('dev 主题组在复用视图下仍可用', /devThemeGroup\.hidden = wizard/.test(raw))

/* 6. 浮层栏内 7 步一屏可见（压缩节奏） */
ok('步骤列表间距压缩', /\.ctrl \.steps\{gap:0\}/.test(raw))
ok('步骤按钮压缩内边距', /\.ctrl \.steps button\{font-size:11px;padding:3px 6px\}/.test(raw))
ok('次要说明在浮层栏内隐藏', /\.ctrl \.note\{display:none\}/.test(raw))
ok('脱离后恢复完整说明', /\.ctrl\.detached \.note\{display:block/.test(raw))

console.log('preview-dev-panel.l1: ' + passed + ' checks passed')
