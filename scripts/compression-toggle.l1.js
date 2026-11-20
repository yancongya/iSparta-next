// L1 回归：压缩总开关两个 bug（issue #3 反馈 01/02）。
// 覆盖——
//  BUG 01「关掉压缩后总开关再也点不开」：
//    - setting.scss 的 .is-compression-off 不得含 pointer-events（否则罩住整行、真实鼠标点不开）；
//    - setting.vue 的 .compression-settings__row 整行容器不得带 is-compression-off；
//    - 总开关 checkbox 紧跟在 .compression-settings__value 内，且该 value 容器不带禁用类；
//    - 从属控件（segmented / num input）仍带 :disabled + 置灰类，禁用语义不丢。
//  BUG 02「关压缩后新导入的 32-bit 序列仍出 8-bit」：
//    - applyGlobalCompressionPatch：缺省/非法兜底、不改入参、只写压缩字段、保留其它默认；
//    - 关压缩 patch 经 globalSetting 派生（ITEMS_ADD 的 _.extend 等价）后 preserveBitDepth=true；
//    - compressionEnabled setter 源码含 dispatch('syncGlobalCompression', ...)（配置生命周期被接通）。
// 不启动浏览器/二进制；纯函数用 vm 沙箱直载（范式同 palette-compress.l1.js）。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8')
const stripAll = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ')
  .replace(/^export default /gm, '')
  .replace(/^export /gm, '')

let passed = 0
function t (name, fn) {
  fn()
  passed++
  console.log('ok -', name)
}

// ---------- 纯函数：globalPrefs.applyGlobalCompressionPatch ----------
const gpSrc = stripAll(read('../src/util/globalPrefs.js')) +
  '\n;globalThis.gp = { applyGlobalCompressionPatch }'
const gpCtx = { Object, Array, console }
vm.createContext(gpCtx)
vm.runInContext(gpSrc, gpCtx, { filename: 'globalPrefs.vm.js' })
const { applyGlobalCompressionPatch } = gpCtx.gp

t('缺省/非法 globalSetting 兜底成 {options:{}}，不抛错', () => {
  for (const bad of [undefined, null, 0, 'x', [], NaN]) {
    const r = applyGlobalCompressionPatch(bad, { preserveBitDepth: true })
    assert(r && typeof r === 'object' && !Array.isArray(r))
    assert(r.options && typeof r.options === 'object')
    assert.strictEqual(r.options.preserveBitDepth, true)
  }
})

t('纯函数不改入参（新对象、新 options、新 quality）', () => {
  const gs = { options: { frameRate: 30, quality: { checked: true, value: 80 } }, other: 1 }
  const before = JSON.stringify(gs)
  const r = applyGlobalCompressionPatch(gs, { preserveBitDepth: true, quality: { checked: false } })
  assert.strictEqual(JSON.stringify(gs), before, '入参不得被修改')
  assert.notStrictEqual(r, gs)
  assert.notStrictEqual(r.options, gs.options)
  assert.notStrictEqual(r.options.quality, gs.options.quality)
})

t('只写 boolean 的 preserveBitDepth；undefined/null/字符串一律忽略', () => {
  const base = { options: { preserveBitDepth: false } }
  assert.strictEqual(applyGlobalCompressionPatch(base, { preserveBitDepth: undefined }).options.preserveBitDepth, false)
  assert.strictEqual(applyGlobalCompressionPatch(base, { preserveBitDepth: null }).options.preserveBitDepth, false)
  assert.strictEqual(applyGlobalCompressionPatch(base, { preserveBitDepth: 'true' }).options.preserveBitDepth, false)
  assert.strictEqual(applyGlobalCompressionPatch(base, { preserveBitDepth: true }).options.preserveBitDepth, true)
})

t('同步 quality.checked 但保留 value 与其它默认（零破坏）', () => {
  const gs = { options: { frameRate: 25, loop: true, quality: { checked: true, value: 42 }, palette: { mode: 'colors', colors: 16 } } }
  const r = applyGlobalCompressionPatch(gs, { preserveBitDepth: false, quality: { checked: true } })
  assert.deepStrictEqual(r.options.frameRate, 25)
  assert.strictEqual(r.options.loop, true)
  assert.strictEqual(r.options.quality.value, 42, 'quality.value 不被覆盖')
  assert.strictEqual(r.options.quality.checked, true)
  assert.strictEqual(r.options.palette.mode, 'colors')
  assert.strictEqual(applyGlobalCompressionPatch(gs, { preserveBitDepth: true }).options.quality.value, 42, '未传 quality 时整块保留')
})

t('quality 非 boolean checked 不写；quality 缺字段时补出对象', () => {
  const gs = { options: {} }
  const r = applyGlobalCompressionPatch(gs, { preserveBitDepth: true, quality: { checked: 'false' } })
  assert.strictEqual(r.options.quality, undefined, '非 boolean 不得伪造 quality 对象')
  const r2 = applyGlobalCompressionPatch(gs, { preserveBitDepth: true, quality: { checked: false } })
  assert.strictEqual(r2.options.quality.checked, false)
})

t('用户旅程核心：关压缩写 globalSetting → 新任务派生拿到 preserveBitDepth=true', () => {
  // 模拟 store：关压缩时 setter 派发的 patch
  const patch = { preserveBitDepth: true, quality: { checked: false } }
  const stored = JSON.stringify(applyGlobalCompressionPatch(JSON.parse(JSON.stringify({ options: { frameRate: 30, quality: { checked: true, value: 80 } } })), patch))
  // 模拟 ITEMS_ADD：var tempState = JSON.parse(...); _.extend(tempState, data)
  const newTaskOptions = JSON.parse(stored).options
  assert.strictEqual(newTaskOptions.preserveBitDepth, true, '新任务必须继承关压缩')
  assert.strictEqual(newTaskOptions.frameRate, 30, '其它默认不被串改')
  // 反向断言：默认（未同步）仍是 false —— 覆盖旧 bug 存在的条件
  const oldDefault = { options: { preserveBitDepth: false } }
  assert.strictEqual(oldDefault.options.preserveBitDepth, false)
})

// ---------- BUG 01 源码守卫 ----------
const scss = read('../src/components/setting/setting.scss')
const vue = read('../src/components/setting/setting.vue')

t('setting.scss：.is-compression-off 块内不含 pointer-events（禁用只靠控件 :disabled）', () => {
  const m = scss.match(/\.is-compression-off\s*\{([\s\S]*?)\}/)
  assert(m, '未找到 .is-compression-off 规则块')
  assert(!/pointer-events\s*:/.test(m[1]), 'pointer-events 会罩住总开关，必须移除')
  assert(/opacity\s*:/.test(m[1]) && /filter\s*:/.test(m[1]), '视觉置灰仍需保留')
})

t('setting.vue：整行容器不带 is-compression-off；总开关 value 容器也不带', () => {
  const rowMatch = vue.match(/<div class="compression-settings__row"[^>]*>/)
  assert(rowMatch, '未找到 compression-settings__row 容器')
  assert(!/is-compression-off/.test(rowMatch[0]), '整行容器不得带禁用类（原 bug 根因）')
  const valueMatch = vue.match(/<div class="compression-settings__value"[^>]*>/)
  assert(valueMatch)
  assert(!/is-compression-off/.test(valueMatch[0]), 'value 容器含总开关，不得带禁用类')
})

t('setting.vue：总开关 checkbox 仍在 value 内；从属控件保留 :disabled + 置灰类', () => {
  const valueBlock = vue.slice(vue.indexOf('class="compression-settings__value"'), vue.indexOf('class="compression-settings__value"') + 900)
  assert(/v-model="compressionEnabled"/.test(valueBlock), '总开关 checkbox 必须在 value 容器内')
  assert(/<is-checkbox v-model="compressionEnabled"/.test(valueBlock))
  // 从属控件禁用语义仍在
  assert(/:disabled="!compressionEnabled"/.test(valueBlock), '质量/色数控件需 :disabled')
  assert(/'is-compression-off': !compressionEnabled/.test(valueBlock), '从属控件需置灰类')
})

// ---------- BUG 02 生命周期守卫 ----------
t('setting.vue：压缩总开关 setter 接通 syncGlobalCompression 派发', () => {
  const i = vue.indexOf('compressionEnabled: {')
  assert(i >= 0)
  const block = vue.slice(i, i + 700)
  assert(/writeOptions\(patch\)/.test(block), '仍需写当前任务')
  assert(/dispatch\(\s*['"]syncGlobalCompression['"]/.test(block), '必须同步 globalSetting')
  assert(/preserveBitDepth:\s*!value/.test(block))
})

t('store：syncGlobalCompression action 落盘 globalSetting 且用纯函数', () => {
  const store = read('../src/store/index.js')
  assert(/syncGlobalCompression\s*\(context, patch\)/.test(store), '缺少 action')
  assert(/applyGlobalCompressionPatch\(raw, patch\)/.test(store), 'action 必须走纯函数')
  assert(/storage\.setItem\(\s*['"]globalSetting['"]/.test(store), 'action 必须写回 globalSetting')
})

console.log(`\ncompression-toggle: ${passed} checks passed`)
