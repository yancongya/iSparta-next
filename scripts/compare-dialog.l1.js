/**
 * L1：对比弹窗「控制面板收敛到 dialog footer 外壳」结构守卫（纯 Node）
 * 用法：node scripts/compare-dialog.l1.js
 *
 * 契约：画布（IsCompareSlider）只渲染图像 / 分隔线 / 标签，不再内嵌工具条；
 *   缩放 / 背景 / 复位 / 提示 / 重新同步全部在 compareDialog 的 #footer 外壳。
 *   外壳通过 view-state 事件读画布状态、通过 ref 调画布公开方法。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

let passed = 0
const failures = []
function check (name, fn) {
  try { fn(); passed++ } catch (e) { failures.push(name + ': ' + e.message) }
}

const dlg = read('src/components/compareDialog/index.vue')
const slider = read('src/ui-next/components/IsCompareSlider.vue')

check('slider canvas has no embedded toolbar', () => {
  assert(!/is-cmp__tools/.test(slider), 'slider must not render inner toolbar')
  assert(!/is-cmp__zoom/.test(slider), 'slider must not render zoom readout')
  assert(!/is-cmp__tool-sep/.test(slider), 'slider must not render toolbar separator')
  assert(!/zoomInLabel|zoomOutLabel|resetLabel|bgLabel/.test(slider), 'slider should not own button labels')
})

check('slider emits view-state and keeps public tool methods', () => {
  assert(/\$emit\('view-state'/.test(slider), 'slider must emit view-state')
  assert(/zoomIn \(\)/.test(slider) && /zoomOut \(\)/.test(slider), 'slider must keep zoom methods')
  assert(/resetView \(\)/.test(slider) && /cycleBg \(\)/.test(slider), 'slider must keep reset/bg methods')
  assert(/replay \(\)/.test(slider), 'slider must keep replay method')
})

check('compare dialog keeps all controls in footer slot', () => {
  assert(/slot="footer"/.test(dlg), 'compareDialog must use #footer slot')
  const foot = dlg.slice(dlg.indexOf('slot="footer"'))
  assert(/cmp-tools/.test(foot), 'footer must render tool group')
  assert(/cmp-hint/.test(foot), 'footer must render hint')
  assert(/cmp-replay/.test(foot), 'footer must render replay button')
  assert(/cmpZoomIn|cmpZoomOut/.test(foot), 'footer tool buttons must be labelled')
})

check('compare dialog no longer wraps canvas in cmp-body', () => {
  assert(!/class="cmp-body"/.test(dlg), 'cmp-body wrapper must be removed')
  assert(!/class="cmp-foot"/.test(dlg), 'in-canvas cmp-foot must be removed')
})

check('footer wires view-state and slider tool API', () => {
  assert(/@view-state="onViewState"/.test(dlg), 'must listen to view-state')
  assert(/onViewState \(state\)/.test(dlg), 'must handle view-state')
  assert(/tool \(name\)/.test(dlg), 'must have footer tool dispatcher')
  assert(/s\[name\]\(\)/.test(dlg), 'tool dispatcher must call slider method')
  assert(/ref="slider"/.test(dlg), 'must keep slider ref')
})

if (failures.length) {
  console.error('compare dialog L1 FAILED (' + failures.length + '):')
  failures.forEach((f) => console.error('  - ' + f))
  process.exit(1)
}
console.log('compare dialog L1 OK (' + passed + ' checks)')
