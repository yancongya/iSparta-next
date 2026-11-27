// L1 回归：APNG 保真输出（preserveBitDepth = true，关压缩保留 32-bit）。
// 覆盖——
// 1) isPreserveBitDepth 兜底：缺省/旧配置为 false，只有显式 true 生效；
// 2) apngCompress：保真时无论质量/色深路线都不调用 apngquant/apngopt，直接用 apngasm 母版
//    （apngopt 会按 alpha 形态自动转索引，统一 alpha 必降级 8-bit——旧"仅走 apngopt"结论已废止）；
// 3) sizeGate.enforceSizeLimit：保真时整段跳过（preserved），不重压、不改 quality.checked；
// 4) applyStartPlan：保真时源码级守卫存在（前置质量/色数规划跳过）；
// 5) readPngBitDepth：真机虚拟键抛错不得吞掉真实 IHDR 读取（位深角标不显示的根因）；
// 6) apng2webp：保真时 cwebp 必须走 -lossless -exact（不给 -lossless 即为有损 VP8）；
// 7) estimateOutput：保真时走无损估算分支——不设目标、不标超限、不按 Q 曲线；
// 8) formatCanPreserveBitDepth：GIF 格式硬上限保不住 32-bit，必须与 APNG/WEBP 区分。
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
    assert(!bins.includes('apngopt'), '保真时不得调用 apngopt（它会按 alpha 形态自动转索引，统一 alpha 必降级 8-bit）')
    assert.strictEqual(bins.length, 0, '保真时不得调用任何可能降色的工具，直接用 apngasm 母版')
    passed++
    console.log('ok - apngCompress 质量路线保真：apngquant / apngopt 全跳过，直接用母版')
  }
  {
    const ctx = makeApngCtx()
    const item = makeItem({ preserveBitDepth: true, palette: { mode: 'colors', colors: 16 } })
    await ctx.apngCompress(item, 0, ctx.store, { compressing: 'compressing' })
    const bins = ctx._calls.map((c) => c.bin)
    assert(!bins.includes('apngquant'), '色深路线保真也不得量化')
    assert(!bins.includes('apngopt'), '色深路线保真同样不得过 apngopt')
    assert.strictEqual(bins.length, 0, '色深路线保真不调用任何工具')
    passed++
    console.log('ok - apngCompress 色深路线保真：apngquant / apngopt 全跳过')
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

  // ---------- 5) readPngBitDepth 真机读取（mock 虚拟键失败不得吞掉真实读取）----------
  // 回归 bug：mock 探测与真实读取曾共用一个 try，真机 fs 读 '__bitdepth__:' 畸形路径抛错
  // 后直接 return null，导致桌面/CEP 真机上位深角标（源 X-bit → 产物 Y-bit）永远不显示。
  const bitDepthSrc = stripAll(read('../src/util/pngBitDepth.js'))
  const mkHeader = (bitDepth, colorType) => {
    const b = Buffer.alloc(26)
    b[0] = 0x89; b[1] = 0x50; b[2] = 0x4e; b[3] = 0x47
    b[4] = 0x0d; b[5] = 0x0a; b[6] = 0x1a; b[7] = 0x0a
    b.write('IHDR', 12, 'ascii'); b[24] = bitDepth; b[25] = colorType
    return b
  }
  const loadBitDepth = (readFileSync) => {
    const ctx = { fs: { readFileSync }, Math, Number, isFinite, console }
    vm.createContext(ctx)
    vm.runInContext(bitDepthSrc + '\n;this.readPngBitDepth = readPngBitDepth;', ctx)
    return ctx.readPngBitDepth
  }
  const same = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b))

  const rdReal = loadBitDepth((p) => {
    if (String(p).indexOf('__bitdepth__:') === 0) throw new Error('ENOENT')
    return mkHeader(8, 6)
  })
  same(rdReal('cool_00.png'), { bitDepth: 8, colorType: 6, bits: 32 })
  passed++
  console.log('ok - readPngBitDepth 真机虚拟键抛错仍读到 32-bit RGBA')

  const rdMock = loadBitDepth((p) => {
    if (String(p).indexOf('__bitdepth__:') === 0) return '16|6'
    throw new Error('no real file')
  })
  same(rdMock('mock'), { bitDepth: 16, colorType: 6, bits: 64 })
  passed++
  console.log('ok - readPngBitDepth mock 虚拟键仍优先（不破坏浏览器 mockup）')

  const rdNone = loadBitDepth(() => { throw new Error('ENOENT') })
  assert.strictEqual(rdNone('missing.png'), null)
  passed++
  console.log('ok - readPngBitDepth 两路失败安全返回 null')

  // 反向守卫：抹掉第二层 try 还原旧「共用 try」写法，确认真机场景必返回 null（证明测试有效）
  const oldBitDepthSrc = bitDepthSrc.replace(
    '  } catch (e) {\n    // 真机无虚拟键，忽略，继续走真实文件读取\n  }\n  try {\n    const data',
    '    const data'
  )
  assert.notStrictEqual(oldBitDepthSrc, bitDepthSrc, '反向守卫替换必须命中')
  const ctxOld = {
    fs: { readFileSync: (p) => {
      if (String(p).indexOf('__bitdepth__:') === 0) throw new Error('ENOENT')
      return mkHeader(8, 6)
    } },
    Math, Number, isFinite, console
  }
  vm.createContext(ctxOld)
  vm.runInContext(oldBitDepthSrc + '\n;this.readPngBitDepth = readPngBitDepth;', ctxOld)
  assert.strictEqual(ctxOld.readPngBitDepth('cool_00.png'), null, '旧写法应复现 null')
  passed++
  console.log('ok - 反向守卫：共用 try 旧写法在真机确实返回 null')

  // ---------- 6) apng2webp 保真走 cwebp 无损 ----------
  // 回归 bug：apng2webp 只看 quality.checked 决定传不传 -q，完全不感知 preserveBitDepth，
  // 关压缩后 quality.checked 仍为 true → cwebp -q 72 → 有损 VP8，产物与「保留 32-bit 无损」
  // 的提示自相矛盾。实测 cwebp 0.6.0 不给 -lossless 即为有损；-exact 必须配合 -lossless。
  {
    const webpSrc = stripAll(read('../src/util/processor/apng2webp.js'), 'apng2webp') +
      '\n;this.apng2webp = apng2webp;' +
      '\n' + stripAll(read('../src/util/paletteConfig.js'))
    const calls = []
    const ctx = {
      path: { join: (...a) => path.posix.join(...a), basename: (p) => path.posix.basename(p) },
      fs: {
        readFileSync: () => JSON.stringify({ frames: [{ src: 'f1.png', delay_num: 1, delay_den: 25, x: 0, y: 0, blend_op: 0, dispose_op: 0 }] })
      },
      action: {
        bin: (n) => n,
        exec: (bin, args) => { calls.push({ bin, args: args.slice() }); return Promise.resolve({}) }
      },
      store: { dispatch: () => {} },
      console
    }
    vm.createContext(ctx)
    vm.runInContext(webpSrc, ctx)

    const mkWebpItem = (extra) => ({
      index: 0,
      basic: { tmpDir: TMP, tmpOutputDir: TMP, fileList: ['/in/source.png'] },
      options: Object.assign({
        preserveBitDepth: false,
        palette: { mode: 'quality', colors: 256 },
        quality: { checked: true, value: 72 },
        loop: 0
      }, extra)
    })
    await ctx.apng2webp(mkWebpItem({ preserveBitDepth: true }), ctx.store, { outputing: 'o' })
    const cwebpCall = calls.find((c) => c.bin === 'cwebp')
    assert(cwebpCall, '应调用 cwebp')
    assert(cwebpCall.args.includes('-lossless'), '保真时 cwebp 必须带 -lossless（否则为有损 VP8）')
    assert(cwebpCall.args.includes('-exact'), '保真时 cwebp 必须带 -exact（保留透明像素隐藏 RGB）')
    assert(!cwebpCall.args.includes('-q'), '保真时不得传 -q（有损质量档）')
    passed++
    console.log('ok - apng2webp 保真：cwebp -lossless -exact，且不传 -q')

    calls.length = 0
    await ctx.apng2webp(mkWebpItem({ preserveBitDepth: false }), ctx.store, { outputing: 'o' })
    const lossyCall = calls.find((c) => c.bin === 'cwebp')
    assert(lossyCall.args.includes('-q'), '非保真维持现状：仍按质量档传 -q')
    assert(!lossyCall.args.includes('-lossless'), '非保真不得走无损（改变现状行为）')
    passed++
    console.log('ok - apng2webp 非保真：维持 -q 质量档（现状不变）')
  }

  // ---------- 7) estimateOutput 保真分支 ----------
  // 回归 bug：估算层零 preserveBitDepth 引用 → 关压缩后仍按 Q 曲线出「按 Q72 估算 / 超目标」，
  // 而 sizeGate 体积闸此时整段失效 → 后端闸门已失效、前端仍在报警（口径不一致）。
  {
    const qeSrc = stripAll(read('../src/util/qualityEstimate.js')) +
      '\n;this.qe = { estimateOutput };' +
      '\n' + stripAll(read('../src/util/sizePlanner.js')) +
      '\n' + stripAll(read('../src/util/paletteConfig.js'))
    const ctx = { Math, Number, isFinite, console, Object, Array, String }
    vm.createContext(ctx)
    // qualityEstimate 的外部依赖：effectiveQualityStart（sizeLimitConfig）与
    // normalizeSizeLimit（sizeGate）。保真分支不走它们，但非保真对照分支会调用，
    // 必须注入真实实现，否则对照断言测不到东西。
    vm.runInContext(
      stripAll(read('../src/util/sizeLimitConfig.js')) + '\n;this.effectiveQualityStart = effectiveQualityStart;',
      ctx
    )
    vm.runInContext(
      stripAll(read('../src/util/processor/sizeGate.js')) + '\n;this.normalizeSizeLimit = normalizeSizeLimit;',
      ctx
    )
    vm.runInContext(qeSrc, ctx)
    const estimateOutput = ctx.qe.estimateOutput

    const srcBytes = 1024 * 1024
    const preserveOpts = {
      preserveBitDepth: true,
      sizeLimit: { enabled: true, maxMB: 0.8, maxBytes: 800 * 1024 },
      outputFormat: ['APNG', 'WEBP', 'GIF'],
      quality: { checked: true, value: 72 },
      palette: { mode: 'quality', colors: 256 }
    }
    const p = estimateOutput(preserveOpts, srcBytes, false)
    assert(p, '保真估算应有结果')
    assert.strictEqual(p.mode, 'preserve', '保真必须走独立 mode')
    assert.strictEqual(p.hasTarget, false, '保真时体积闸失效，不得再有目标')
    assert.strictEqual(p.over, false, '保真时不得标超目标（闸门已失效）')
    assert(p.details.every((d) => d.over === false), '保真时逐格式都不得标超目标')
    assert(p.details.length === 3, '保真仍应逐格式给出明细')
    // 体积按无损系数，不得套 Q 曲线（Q72 曲线会把 1MB 估成约 0.8MB，与实测 0.81/0.56/0.25 不符）
    const byFmt = {}
    p.details.forEach((d) => { byFmt[d.format] = d.bytes })
    assert(Math.abs(byFmt.APNG / srcBytes - 0.81) < 0.01, 'APNG 保真系数应为 0.81')
    assert(Math.abs(byFmt.WEBP / srcBytes - 0.56) < 0.01, 'WEBP 保真系数应为 0.56')
    assert(Math.abs(byFmt.GIF / srcBytes - 0.25) < 0.01, 'GIF 保真系数应为 0.25')
    passed++
    console.log('ok - estimateOutput 保真：独立 mode、无目标、不标超限、按无损系数估算')

    // 非保真维持现状：仍有目标、有 Q 档
    const q = estimateOutput(Object.assign({}, preserveOpts, { preserveBitDepth: false }), srcBytes, false)
    assert.strictEqual(q.mode, 'quality', '非保真维持 quality 路线')
    assert.strictEqual(q.hasTarget, true, '非保真维持目标显示')
    assert.strictEqual(q.quality, 72, '非保真维持 Q 档')
    passed++
    console.log('ok - estimateOutput 非保真：维持 Q 路线与目标显示（现状不变）')
  }

  // ---------- 8) formatCanPreserveBitDepth ----------
  {
    const bdSrc = stripAll(read('../src/util/pngBitDepth.js'))
    const ctx = { fs: { readFileSync: () => { throw new Error('x') } }, Math, Number, isFinite, console }
    vm.createContext(ctx)
    vm.runInContext(bdSrc + '\n;this.can = formatCanPreserveBitDepth;', ctx)
    const can = ctx.can
    assert.strictEqual(can('APNG'), true, 'APNG 可承载 32-bit RGBA')
    assert.strictEqual(can('WEBP'), true, 'WEBP(VP8L) 可承载 RGBA')
    assert.strictEqual(can('GIF'), false, 'GIF 格式硬上限 256 色索引，保不住 32-bit')
    passed++
    console.log('ok - formatCanPreserveBitDepth：GIF 与 APNG/WEBP 正确区分')
  }

  console.log(`\npreserve-bitdepth: ${passed} checks passed`)
  if (process.exitCode) { process.exit(1) }
}

run().catch((e) => { console.error(e); process.exit(1) })
