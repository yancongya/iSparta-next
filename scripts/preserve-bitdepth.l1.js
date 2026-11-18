// L1 回归：APNG 保真输出（preserveBitDepth = true，关压缩保留 32-bit）。
// 覆盖——
// 1) isPreserveBitDepth 兜底：缺省/旧配置为 false，只有显式 true 生效；
// 2) apngCompress：保真时无论质量/色深路线都跳过 apngquant，仅走 apngopt 无损；
// 3) sizeGate.enforceSizeLimit：保真时整段跳过（preserved），不重压、不改 quality.checked；
// 4) applyStartPlan：保真时源码级守卫存在（前置质量/色数规划跳过）。
// 不启动真实工具链；mock 记录 action.exec 命令行（范式同 palette-compress.l1.js）。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8')
const stripAll = (src, defaultName) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ')
  .replace(/^export default function \(/gm, 'function ' + (defaultName || 'apngCompress') + ' (')
  .replace(/^export default /gm, '')
  .replace(/^export /gm, '')

// ---------- 1) paletteConfig.isPreserveBitDepth ----------
const paletteSrc = stripAll(read('../src/util/paletteConfig.js')) +
  '\nglobalThis.pal = { isPreserveBitDepth, normalizePalette }'
const palCtx = { Math, Number, isFinite, console }
vm.createContext(palCtx)
vm.runInContext(paletteSrc, palCtx, { filename: 'paletteConfig.vm.js' })
const { isPreserveBitDepth } = palCtx.pal

let passed = 0
function t (name, fn) {
  fn()
  passed++
  console.log('ok -', name)
}

t('isPreserveBitDepth 缺省/旧配置一律 false，仅显式 true 生效', () => {
  assert.strictEqual(isPreserveBitDepth(undefined), false)
  assert.strictEqual(isPreserveBitDepth(null), false)
  assert.strictEqual(isPreserveBitDepth({}), false)
  assert.strictEqual(isPreserveBitDepth({ preserveBitDepth: false }), false)
  assert.strictEqual(isPreserveBitDepth({ preserveBitDepth: 1 }), false, '非布尔 true 不得生效')
  assert.strictEqual(isPreserveBitDepth({ preserveBitDepth: 'true' }), false)
  assert.strictEqual(isPreserveBitDepth({ preserveBitDepth: true }), true)
})

// ---------- 2) apngCompress 保真分支 ----------
const TMP = '/tmp/isparta-preserve'
const OUT = path.posix.join(TMP, 'out.png')
const QUANT = path.posix.join(TMP, 'out-quant.png')

function makeApngCtx () {
  const calls = []
  const exec = (bin, args) => {
    calls.push({ bin, args: args.slice() })
    return Promise.resolve({ command: bin })
  }
  const apngSrc = stripAll(read('../src/util/processor/apngCompress.js')) +
    '\n;this.apngCompress = apngCompress;' +
    '\n' + stripAll(read('../src/util/paletteConfig.js'))
  const ctx = {
    path: { join: (...a) => path.posix.join(...a) },
    fs: {
      ensureDirSync: () => {},
      copySync: () => {},
      existsSync: (p) => p === OUT
    },
    action: { bin: (n) => n, exec },
    appLog: { warn: () => {} },
    store: { dispatch: () => {} },
    console,
    _calls: calls
  }
  vm.createContext(ctx)
  vm.runInContext(apngSrc, ctx)
  return ctx
}

function makeItem (extra) {
  return {
    index: 0,
    basic: { tmpDir: TMP, tmpOutputDir: TMP, fileList: ['/in/source.png'] },
    options: Object.assign({
      preserveBitDepth: false,
      palette: { mode: 'quality', colors: 256 },
      quality: { checked: true, value: 80 },
      floyd: { checked: true, value: 0.35 }
    }, extra)
  }
}

async function run () {
  {
    const ctx = makeApngCtx()
    await ctx.apngCompress(makeItem({ preserveBitDepth: true }), 0, ctx.store, { compressing: 'compressing' })
    const bins = ctx._calls.map((c) => c.bin)
    assert(!bins.includes('apngquant'), '保真时不得调用 apngquant（量化必出 8-bit）')
    assert(bins.includes('apngopt'), '保真时必须走 apngopt 无损')
    passed++
    console.log('ok - apngCompress 质量路线保真：跳过 apngquant，仅 apngopt')
  }
  {
    const ctx = makeApngCtx()
    const item = makeItem({ preserveBitDepth: true, palette: { mode: 'colors', colors: 16 } })
    await ctx.apngCompress(item, 0, ctx.store, { compressing: 'compressing' })
    const bins = ctx._calls.map((c) => c.bin)
    assert(!bins.includes('apngquant'), '色深路线保真也不得量化')
    assert(bins.includes('apngopt'), '色深路线保真走 apngopt')
    passed++
    console.log('ok - apngCompress 色深路线保真：同样跳过量化')
  }
  {
    const ctx = makeApngCtx()
    await ctx.apngCompress(makeItem({ preserveBitDepth: false }), 0, ctx.store, { compressing: 'compressing' })
    assert(ctx._calls.some((c) => c.bin === 'apngquant'), '非保真仍应走 apngquant（现状不变）')
    passed++
    console.log('ok - 非保真维持现状：仍走 apngquant')
  }

  // ---------- 3) sizeGate 保真跳过 ----------
  const sizeGateSrc = stripAll(read('../src/util/processor/sizeGate.js')) +
    '\n globalThis.sg = { enforceSizeLimit, normalizeSizeLimit }'
  const sgCtx = {
    Math, Number, isFinite, console, Promise, Object, String, Array,
    fs: { statSize: () => -1, existsSync: () => false, readdirSync: () => [] },
    path: { dirname: () => '', basename: () => '', join: (...a) => a.join('/') },
    apngCompress: () => Promise.resolve(), apng2gif: () => Promise.resolve(), apng2webp: () => Promise.resolve(),
    TYPE: { PNG: 'APNG', GIF: 'GIF', WEBP: 'WEBP' },
    appLog: { warn: () => {}, info: () => {} },
    i18n: { t: (s) => s },
    automaticRetryCount: () => 10, automaticRetryQuality: () => 80, effectiveQualityStart: () => 80,
    planStartingQuality: () => ({}), planStartingColors: () => ({}), estimateColorsBytes: () => 0,
    automaticRetryColors: () => 2, automaticRetryColorsCount: () => 0
  }
  // paletteConfig 全文注入（含 isPreserveBitDepth / normalizePalette）
  const pcSrc = stripAll(read('../src/util/paletteConfig.js'))
  vm.createContext(sgCtx)
  vm.runInContext(pcSrc + '\n;this.normalizePalette = normalizePalette;', sgCtx)
  const normalizePaletteForSg = sgCtx.normalizePalette
  // sizeGate 沙箱里再次声明 normalizePalette（源全文），遮蔽上面的同名属性，行为一致
  vm.runInContext(sizeGateSrc, sgCtx)
  sgCtx.normalizePalette = normalizePaletteForSg

  const preserveItem = makeItem({ preserveBitDepth: true })
  const res = await sgCtx.sg.enforceSizeLimit(preserveItem, sgCtx.store || { dispatch: () => {} }, {})
  assert.strictEqual(res.enforced, false)
  assert.strictEqual(res.preserved, true, '保真时体积闸应标记 preserved')
  assert.strictEqual(preserveItem.options.quality.checked, true, '保真跳过体积闸不得篡改 quality.checked')
  passed++
  console.log('ok - sizeGate 保真：整段跳过（preserved），不重压不改质量')

  // ---------- 4) applyStartPlan 源码守卫 ----------
  const procSrc = read('../src/util/processor/index.js')
  assert(/isPreserveBitDepth\(opts\)/.test(procSrc), 'applyStartPlan 必须有保真跳过守卫')
  passed++
  console.log('ok - applyStartPlan 保真跳过守卫存在')

  console.log(`\npreserve-bitdepth: ${passed} checks passed`)
  if (process.exitCode) { process.exit(1) }
}

run().catch((e) => { console.error(e); process.exit(1) })
