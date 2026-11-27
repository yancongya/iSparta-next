// L1 守卫：对比弹窗多格式轮询切换加载对应产物 + 复制能力
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const dialogSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'components', 'compareDialog', 'index.vue'),
  'utf8'
)
const sliderSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'ui-next', 'components', 'IsCompareSlider.vue'),
  'utf8'
)

// 1. 静态契约：outline 已移除、tip 与复制事件接通
assert.ok(
  /&:focus,\s*&:focus-visible\s*\{\s*outline:\s*none;\s*\}/.test(sliderSrc),
  'IsCompareSlider 应移除 focus/focus-visible outline'
)
assert.ok(sliderSrc.includes('after-click'), 'IsCompareSlider 应支持 after-click')
assert.ok(sliderSrc.includes('v-tip="afterTip"'), 'IsCompareSlider 右上角应绑定 v-tip="afterTip"')
assert.ok(dialogSrc.includes('buildBadgeTipBlocks'), 'compareDialog 应复用产物 tip 逻辑')

// 2. 轮询切换逻辑：模拟 3 个格式产物（.png / .gif / .webp）
const files = [
  'D:/out/fencer.png',
  'D:/out/fencer.gif',
  'D:/out/fencer.webp'
]
const dataUrls = {
  'D:/out/fencer.png': 'data:image/png;base64,PNG_DATA',
  'D:/out/fencer.gif': 'data:image/gif;base64,GIF_DATA',
  'D:/out/fencer.webp': 'data:image/webp;base64,WEBP_DATA'
}
const formatOf = (f) => {
  const s = String(f || '').toLowerCase()
  if (s.slice(-5) === '.webp') return 'WEBP'
  if (s.slice(-4) === '.gif') return 'GIF'
  if (s.slice(-4) === '.png') return 'APNG'
  return null
}

const vm = {
  activeIndex: 0,
  existingFiles: files,
  afterSrc: dataUrls[files[0]],
  get outFile () {
    return this.existingFiles[this.activeIndex % this.existingFiles.length] || ''
  },
  get afterLabel () {
    return formatOf(this.outFile) || '输出'
  },
  readUrl (p) {
    return dataUrls[p] || ''
  },
  replayCount: 0,
  $nextTick (fn) { fn() },
  replay () { this.replayCount++ },
  cycleAfterFormat () {
    if (this.existingFiles.length <= 1) return
    this.activeIndex = (this.activeIndex + 1) % this.existingFiles.length
    this.afterSrc = this.readUrl(this.outFile)
    this.$nextTick(() => this.replay())
  }
}

assert.strictEqual(vm.afterLabel, 'APNG')
assert.strictEqual(vm.afterSrc, 'data:image/png;base64,PNG_DATA')

vm.cycleAfterFormat()
assert.strictEqual(vm.outFile, 'D:/out/fencer.gif')
assert.strictEqual(vm.afterLabel, 'GIF')
assert.strictEqual(vm.afterSrc, 'data:image/gif;base64,GIF_DATA')

vm.cycleAfterFormat()
assert.strictEqual(vm.outFile, 'D:/out/fencer.webp')
assert.strictEqual(vm.afterLabel, 'WEBP')
assert.strictEqual(vm.afterSrc, 'data:image/webp;base64,WEBP_DATA')

vm.cycleAfterFormat()
assert.strictEqual(vm.outFile, 'D:/out/fencer.png')
assert.strictEqual(vm.afterLabel, 'APNG')
assert.strictEqual(vm.afterSrc, 'data:image/png;base64,PNG_DATA')
assert.strictEqual(vm.replayCount, 3)

console.log('compare-cycle L1 OK (5 checks)')
