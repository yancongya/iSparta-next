// L1 回归：输出名「重置为原始名字」按钮。
// 覆盖——
//  1) 纯函数：rawNameOf(compName || basenameNoExt(inputPath)) → buildInitialOutputName
//     在桌面单文件 / 序列帧目录 / CEP 合成 / 中文名 / outputSuffix 各场景都还原导入时初始名；
//  2) store：ITEMS_CLEAR_NAME_OVERRIDES_AT 把指定项持久/一次性改名清空、不误伤它项；
//  3) 静态契约：单选+多选两行都挂了 reset 按钮(refresh 图标)、三语文案齐、import 齐、store action 接通。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const moduleBody = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/gm, '')
  .replace(/^export /gm, '')

let passed = 0
function t (name, fn) { fn(); passed++; console.log('ok -', name) }

// ---------- 1) 纯函数沙箱 ----------
const ctx = vm.createContext({ String, Object, Array })
for (const f of ['src/util/tokenizeName.js', 'src/util/pathUtil.js']) {
  vm.runInContext(moduleBody(read(f)), ctx, { filename: f })
}
const rawNameOf = (basic) => {
  if (basic.compName) return String(basic.compName)
  if (basic.inputPath) return ctx.basenameNoExt(String(basic.inputPath))
  return ''
}
const originalOf = (item) => ctx.buildInitialOutputName(rawNameOf(item.basic), item.options || {})

t('桌面单文件：inputPath 去扩展名还原初始名', () => {
  assert.strictEqual(originalOf({ basic: { inputPath: 'F:\\iSparta\\test\\real-apng\\fencer' }, options: { outputSuffix: '' } }), 'fencer')
})
t('桌面单文件带后缀 outputSuffix', () => {
  assert.strictEqual(originalOf({ basic: { inputPath: '/tmp/cool.png' }, options: { outputSuffix: 'x' } }), 'cool_x')
})
t('序列帧目录名含点：basenameNoExt 只去末段扩展、不误伤目录', () => {
  // inputPath 末段是帧目录名；这里测「工作目录里带点」的稳健性（纯字符串，不越界用 node path）
  assert.strictEqual(originalOf({ basic: { inputPath: 'D:\\frames\\v1.2' }, options: {} }), 'v1')
})
t('CEP 合成优先用 compName，忽略 inputPath', () => {
  assert.strictEqual(originalOf({ basic: { compName: '开场动画', inputPath: 'x' }, options: {} }), '开场动画')
})
t('中文名与去空格：与导入时 buildInitialOutputName 同口径', () => {
  assert.strictEqual(originalOf({ basic: { compName: '我的 动画' }, options: {} }), '我的动画')
})

// ---------- 2) store mutation 沙箱 ----------
const storeSrc = read('src/store/index.js')
const mutStart = storeSrc.indexOf('  [types.ITEMS_CLEAR_NAME_OVERRIDES_AT](state, payload) {')
const mutEnd = storeSrc.indexOf('\n  },', mutStart)
assert(mutStart >= 0 && mutEnd > mutStart, 'mutation 源码存在')
const mutBody = storeSrc.slice(storeSrc.indexOf('{', mutStart) + 1, mutEnd)
const VueStub = { set: (o, k, v) => { o[k] = v } }
let persisted = 0
const mutCtx = vm.createContext({ Vue: VueStub, persistItems: () => { persisted++ } })
vm.runInContext('this.mut = function(state, payload){' + mutBody + '}', mutCtx, { filename: 'mutation.vm.js' })

t('清指定项 override/transient，不误伤其它项', () => {
  const items = [
    { basic: { outputNameOverride: { APNG: 'x' }, transientNameOverride: { GIF: 'y' } } },
    { basic: { outputNameOverride: { APNG: 'keep' }, transientNameOverride: { WEBP: 'z' } } }
  ]
  mutCtx.mut({ items }, { index: 0 })
  assert.strictEqual(Object.keys(items[0].basic.outputNameOverride).length, 0)
  assert.strictEqual(Object.keys(items[0].basic.transientNameOverride).length, 0)
  assert.strictEqual(items[1].basic.outputNameOverride.APNG, 'keep')
  assert.strictEqual(persisted, 1)
})
t('无 basic 的任务安全跳过', () => {
  mutCtx.mut({ items: [null, { options: {} }] }, { index: 0 })
  mutCtx.mut({ items: [null, { options: {} }] }, { index: 1 })
})

// ---------- 3) 静态契约 ----------
const setting = read('src/components/setting/setting.vue')
t('单选/多选两行都挂了重置按钮且用 refresh 图标', () => {
  const resets = setting.match(/name-row__reset/g) || []
  assert.strictEqual(resets.length, 2, '两处按钮 class')
  assert((setting.match(/name="refresh"/g) || []).length >= 2, '两处 refresh 图标')
})
t('两个按钮各自绑定 resetName / resetMultiName', () => {
  assert(/@click\.stop="resetMultiName\(i\)"/.test(setting))
  assert(/@click\.stop="resetName"/.test(setting))
})
t('方法齐备：源名解析 + 重置写回 + 清 override', () => {
  for (const m of ['sourceBaseOf', 'originalNameOf', 'applyResetName', 'resetName', 'resetMultiName']) {
    assert(new RegExp(m + '\\s*\\(').test(setting), '方法 ' + m)
  }
  assert(/dispatch\('clearNameOverridesAt'/.test(setting))
})
t('import 齐：buildInitialOutputName 与 basenameNoExt', () => {
  const imports = setting.split('\n').filter(l => l.trim().startsWith('import')).join('\n')
  assert(/buildInitialOutputName[^;]*tokenizeName/.test(imports))
  assert(/basenameNoExt[^;]*pathUtil/.test(imports))
})
t('store：mutation-type / mutation / action 三处接通', () => {
  assert(/ITEMS_CLEAR_NAME_OVERRIDES_AT/.test(read('src/store/mutation-types.js')))
  assert(/\[types\.ITEMS_CLEAR_NAME_OVERRIDES_AT\]/.test(storeSrc))
  assert(/clearNameOverridesAt\(context, payload\)/.test(storeSrc))
})
t('三语 resetOutputName 文案齐', () => {
  for (const [f, want] of [['zh-cn', '重置为原始名字'], ['zh-tw', '重設為原始名稱'], ['en-us', 'Reset to original name']]) {
    const src = read('src/locales/' + f + '.js')
    assert(new RegExp('"resetOutputName"\\s*:\\s*"' + want + '"').test(src), f + ' 文案')
  }
})
t('样式：name-row__reset 修饰类存在', () => {
  assert(/&\.name-row__reset/.test(read('src/components/setting/setting.scss')))
})

console.log('reset-output-name L1 OK (' + passed + ' checks)')
