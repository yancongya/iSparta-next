// L1 回归：IsInput 的 IME(中文输入法)组合守卫。
// 背景：输出名等 computed setter 会「读时补后缀 / 写时剥后缀」。IME 逐拼音键触发
// input 时若每次都 emit，中间态被固化 → 后缀级联重复(fencer_apngce_apngce…)。
// 守卫：
//  1) 模板 input 上绑定 compositionstart/compositionend；
//  2) onInput 组合期间不 emit，compositionend 后 emit 一次最终值；
//  3) 沙箱模拟完整 IME 序列，断言只 emit 最终值、不 emit 任何中间态。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8')
const src = read('src/ui-next/components/ui/IsInput.vue')
let passed = 0
function t (name, fn) { fn(); passed++; console.log('ok -', name) }

t('模板绑定 compositionstart/compositionend', () => {
  assert(/@compositionstart="onCompositionStart"/.test(src))
  assert(/@compositionend="onCompositionEnd"/.test(src))
})
t('data 有 composing 标志', () => {
  assert(/composing:\s*false/.test(src))
})

// 抽取 methods 块，沙箱执行验证 emit 行为
const mStart = src.indexOf('  methods: {')
const mEnd = src.indexOf('\n  }\n}', mStart)
assert(mStart >= 0 && mEnd > mStart, 'methods 块存在')
const methodsSrc = src.slice(src.indexOf('{', mStart) + 1, mEnd)

function makeInput () {
  const emitted = []
  const ctx = vm.createContext({
    console,
    $emit: (ev, v) => emitted.push({ ev, v }),
    cast: (raw) => raw,
    e: { target: { value: '' } }
  })
  // 注入 methods 到全局，this 用 ctx 自身
  vm.runInContext('Object.assign(this, {' + methodsSrc + '})', ctx, { filename: 'ismethods.vm.js' })
  ctx.composing = false
  return { ctx, emitted }
}

t('普通英文输入：每个 input 都 emit', () => {
  const { ctx, emitted } = makeInput()
  ctx.e.target.value = 'a'; ctx.onInput(ctx.e)
  ctx.e.target.value = 'ab'; ctx.onInput(ctx.e)
  assert.strictEqual(emitted.filter(x => x.ev === 'input').length, 2)
  assert.strictEqual(emitted[1].v, 'ab')
})

t('IME 组合序列：逐字 input 全被吞，compositionend 只补发一次最终值', () => {
  const { ctx, emitted } = makeInput()
  ctx.onCompositionStart()
  // 模拟中文「动画」的拼音逐键 + 预编辑串
  for (const v of ['fencer_apngd', 'fencer_apngdo', 'fencer_apngdong', 'fencer_apng动画']) {
    ctx.e.target.value = v
    ctx.onInput(ctx.e)
  }
  assert.strictEqual(emitted.length, 0, '组合期间不得 emit 任何中间态')
  ctx.e.target.value = 'fencer动画_apng'
  ctx.onCompositionEnd(ctx.e)
  const inputs = emitted.filter(x => x.ev === 'input')
  assert.strictEqual(inputs.length, 1, '组合结束只补发一次')
  assert.strictEqual(inputs[0].v, 'fencer动画_apng')
  assert.strictEqual(ctx.composing, false)
})

t('compositionend 后回到普通输入模式', () => {
  const { ctx, emitted } = makeInput()
  ctx.onCompositionStart(); ctx.onCompositionEnd(ctx.e)
  const before = emitted.length
  ctx.e.target.value = 'x'; ctx.onInput(ctx.e)
  assert.strictEqual(emitted.length, before + 1)
})

console.log('ime-input L1 OK (' + passed + ' checks)')
