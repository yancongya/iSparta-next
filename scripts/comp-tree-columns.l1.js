/**
 * L1：CEP 合成树列宽纯函数契约（纯 Node，不启浏览器）
 * 用法：node scripts/comp-tree-columns.l1.js
 *
 * 背景：A3.6/A3.7/A3.8/A3.12 的列宽拖动、右键档位、持久化全靠
 *       src/util/compTreeColumns.js 这一个真相源。本守卫锁住出厂宽度、
 *       非法值回退、负向拖动钳到下限、名字列 0=自适应、顺序归一化与读写往返。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const file = path.join(__dirname, '..', 'src', 'util', 'compTreeColumns.js')
const src = fs.readFileSync(file, 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')

const saved = {}
const storage = {
  getItem: (k) => Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : null,
  setItem: (k, v) => { saved[k] = String(v) }
}
const ctx = vm.createContext({ window: { storage }, console })
// vm 里的顶层 const/let 不会挂到 context 上，显式导出成对象
vm.runInContext(src + '\nthis.__api = { CT_COLUMNS, CT_NAME_KEY, CT_NAME_MIN, clampNameWidth, columnOf, presetColumnWidth, clampColumnWidth, normalizeColumnLayout, loadColumnLayout, saveColumnLayout }', ctx, { filename: file })
const api = ctx.__api

let passed = 0
const failures = []
function check (name, fn) {
  try { fn(); passed++ } catch (e) { failures.push(name + ': ' + e.message) }
}

check('出厂宽度 64/64/112，下限都小于出厂值', () => {
  const m = {}
  api.CT_COLUMNS.forEach(c => { m[c.key] = c })
  assert.deepStrictEqual(Object.keys(m), ['size', 'fps', 'state'])
  assert.strictEqual(m.size.width, 64)
  assert.strictEqual(m.fps.width, 64)
  assert.strictEqual(m.state.width, 112)
  api.CT_COLUMNS.forEach(c => {
    assert(c.min < c.width && c.width < c.max, c.key + ' 出厂值必须在上下限内')
    assert(c.narrow >= c.min && c.wide <= c.max, c.key + ' 档位必须落在上下限内')
  })
})

check('非法宽度回退出厂值，不让坏数据把列压成 0', () => {
  for (const v of [null, undefined, '', 0, NaN, 'abc']) {
    assert.strictEqual(api.clampColumnWidth('size', v), 64, String(v))
  }
  assert.strictEqual(api.clampColumnWidth('size', -50), 36)
  assert.strictEqual(api.clampColumnWidth('state', 999), 240)
})

check('右键窄/标准/宽三档互不相同且在上下限内', () => {
  for (const key of ['size', 'fps', 'state']) {
    const narrow = api.presetColumnWidth(key, 'narrow')
    const normal = api.presetColumnWidth(key, 'normal')
    const wide = api.presetColumnWidth(key, 'wide')
    assert(narrow < normal && normal < wide, key)
    assert.strictEqual(api.presetColumnWidth(key, 'bogus'), normal)
  }
})

check('名字列 0=自适应，负向拖动钳到 176 而不是弹回自适应', () => {
  assert.strictEqual(api.clampNameWidth(null, 800), 0)
  assert.strictEqual(api.clampNameWidth(0, 800), 0)
  assert.strictEqual(api.clampNameWidth(-50, 800), api.CT_NAME_MIN)
  assert.strictEqual(api.clampNameWidth(100, 800), api.CT_NAME_MIN)
  assert.strictEqual(api.clampNameWidth(300, 250), 250)
  assert.strictEqual(api.clampNameWidth(300, 100), api.CT_NAME_MIN)
})

check('归一化：未知列丢弃、缺列补齐、宽度钳制、名字列默认自适应', () => {
  const layout = api.normalizeColumnLayout({
    order: ['state', 'bogus', 'state', 'fps'],
    widths: { size: 999, fps: -1, state: 130, name: 200 }
  })
  assert.strictEqual(JSON.stringify(layout.order), JSON.stringify(['state', 'fps', 'size']))
  assert.strictEqual(layout.widths.size, 180)
  assert.strictEqual(layout.widths.fps, 32)
  assert.strictEqual(layout.widths.state, 130)
  assert.strictEqual(layout.widths.name, 200)
  assert.strictEqual(api.normalizeColumnLayout(null).widths.name, 0)
})

check('save/load 往返经过归一化，坏数据可读回出厂态', () => {
  api.saveColumnLayout({ order: ['fps'], widths: { size: 40, fps: 88, state: 999, name: -3 } })
  const loaded = api.loadColumnLayout()
  assert.strictEqual(JSON.stringify(loaded.order), JSON.stringify(['fps', 'size', 'state']))
  assert.strictEqual(loaded.widths.fps, 88)
  assert.strictEqual(loaded.widths.state, 240)
  assert.strictEqual(loaded.widths.name, api.CT_NAME_MIN)
  saved['compTree.columns'] = '{bad json'
  assert.strictEqual(JSON.stringify(api.loadColumnLayout()), JSON.stringify(api.normalizeColumnLayout(null)))
})

if (failures.length) {
  console.error('comp-tree-columns L1 FAILED (' + failures.length + '):')
  failures.forEach(f => console.error('  - ' + f))
  process.exit(1)
}
console.log('comp-tree-columns L1: ' + passed + ' passed')
