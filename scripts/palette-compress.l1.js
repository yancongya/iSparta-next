// L1 回归：色深压缩路线（palette.mode === 'colors'）。
// 覆盖四块——
// 1) paletteConfig：缺省兜底 / 档位吸附 / 重试序列 / 重试次数；
// 2) sizePlanner：estimateColorsBytes 单调性 + planStartingColors 选档与下限；
// 3) apngCompress：色深路线传位置色数、绝不传 --quality；质量路线绝不传色数；
//    内存不足 fallback 两条路线都保持；
// 4) apng2gif：色深路线挂 gifsicle --colors N 并回写 out.gif；质量路线/旧配置不调；
//    gifsicle 失败或产物缺失时保留 apng2gif 原产物、不抛错。
// 不启动真实工具链；mock 记录 action.exec 命令行（范式同 apng-quality-chain.l1.js）。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8')
// paletteConfig 有 export const + export function；sizePlanner/apngCompress/apng2gif 只有 function
const stripAll = (src, defaultName) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ')
  .replace(/^export default function \(/gm, 'function ' + (defaultName || 'apngCompress') + ' (')
  .replace(/^export default /gm, '')
  .replace(/^export /gm, '')

const TMP = '/tmp/isparta-palette'
const OUT = path.posix.join(TMP, 'out.png')
const QUANT = path.posix.join(TMP, 'out-quant.png')

let quantExists = true
let quantThrow = null
const calls = []
const exec = (bin, args) => {
  calls.push({ bin, args: args.slice() })
  if (bin === 'apngquant' && quantThrow) {
    const e = quantThrow
    quantThrow = null
    return Promise.reject(e)
  }
  return Promise.resolve({ command: bin })
}

// ---------- 1) paletteConfig ----------
const paletteSrc = stripAll(read('../src/util/paletteConfig.js')) +
  '\nglobalThis.pal = { normalizePalette, isColorsMode, PALETTE_COLOR_PRESETS, automaticRetryColors, automaticRetryColorsCount }'
const palCtx = { Math, Number, isFinite, console }
vm.createContext(palCtx)
vm.runInContext(paletteSrc, palCtx, { filename: 'paletteConfig.vm.js' })
const { normalizePalette, isColorsMode, automaticRetryColors, automaticRetryColorsCount } = palCtx.pal

let passed = 0
function t (name, fn) {
  fn()
  passed++
  console.log('ok -', name)
}

t('normalizePalette 缺省/旧配置兜底为 quality + 256', () => {
  const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), JSON.stringify(a) + ' vs ' + JSON.stringify(b))
  eq(normalizePalette(undefined), { mode: 'quality', colors: 256 })
  eq(normalizePalette({}), { mode: 'quality', colors: 256 })
  eq(normalizePalette({ quality: { checked: true, value: 80 } }), { mode: 'quality', colors: 256 })
  eq(normalizePalette({ palette: null }), { mode: 'quality', colors: 256 })
})
t('normalizePalette colors 模式 + 非法色数吸附档位', () => {
  assert.strictEqual(normalizePalette({ palette: { mode: 'colors', colors: 64 } }).mode, 'colors')
  assert.strictEqual(normalizePalette({ palette: { mode: 'colors', colors: 64 } }).colors, 64)
  assert.strictEqual(normalizePalette({ palette: { mode: 'colors', colors: 50 } }).colors, 64, '50 吸附到 64')
  assert.strictEqual(normalizePalette({ palette: { mode: 'colors', colors: 999 } }).colors, 256, '越界钳 256')
  assert.strictEqual(normalizePalette({ palette: { mode: 'colors', colors: 'abc' } }).colors, 256, 'NaN 兜底')
  assert.strictEqual(normalizePalette({ palette: null }).colors, 256, 'palette null 兜底（Number(null)=0 陷阱）')
})
t('isColorsMode 与 normalizePalette 同口径', () => {
  assert.strictEqual(isColorsMode({ palette: { mode: 'colors', colors: 16 } }), true)
  assert.strictEqual(isColorsMode({}), false)
})
t('automaticRetryColors 逐档向下且到底停 2', () => {
  assert.strictEqual(automaticRetryColors(256, 10, 1), 128)
  assert.strictEqual(automaticRetryColors(256, 10, 3), 32)
  assert.strictEqual(automaticRetryColors(16, 10, 1), 8)
  assert.strictEqual(automaticRetryColors(2, 10, 1), 2, '最低档不再下降')
})
t('automaticRetryColorsCount 受档数与配置双重约束', () => {
  assert.strictEqual(automaticRetryColorsCount(256, 10), 7, '256 到 2 共 7 步')
  assert.strictEqual(automaticRetryColorsCount(256, 3), 3, '配置优先')
  assert.strictEqual(automaticRetryColorsCount(2, 10), 0, '已在最低档')
})

// ---------- 2) sizePlanner（色数模型）----------
const plannerSrc = stripAll(read('../src/util/sizePlanner.js')) +
  '\nglobalThis.plan = { estimateColorsBytes, planStartingColors }'
const planCtx = { Math, Number, isFinite, console }
vm.createContext(planCtx)
vm.runInContext(plannerSrc, planCtx, { filename: 'sizePlanner.vm.js' })
const { estimateColorsBytes, planStartingColors } = planCtx.plan

t('estimateColorsBytes 单调递减且 256 色≈源', () => {
  const src = 10 * 1024 * 1024
  const prev = estimateColorsBytes(src, 256, 'APNG') + 1
  ;[128, 64, 32, 16, 8, 4, 2].forEach((c) => {
    const b = estimateColorsBytes(src, c, 'APNG')
    assert(b < prev && b > 0, 'not monotonic at ' + c)
    prev_val = b
    var prev_val // eslint-noop
  })
  assert.strictEqual(estimateColorsBytes(src, 256, 'APNG'), src)
  assert.strictEqual(estimateColorsBytes(0, 16, 'APNG'), 0)
})
t('planStartingColors 选最高达标档 / 不可达落 floor', () => {
  const src = 10 * 1024 * 1024
  // 目标很宽（含 0.9 safety 余量）：256 档即达标 → 不降档
  const easy = planStartingColors({ maxBytes: src * 1.2, sourceBytes: src, format: 'APNG', baselineColors: 256 })
  assert.strictEqual(easy.plannedColors, 256)
  assert.strictEqual(easy.feasible, true)
  // 目标很紧：连 2 色都超 → 落 floor 且 feasible=false
  const hard = planStartingColors({ maxBytes: 1, sourceBytes: src, format: 'APNG', baselineColors: 256, floorColors: 16 })
  assert.strictEqual(hard.feasible, false)
  assert.strictEqual(hard.plannedColors, 16)
  // 目标居中：落在某个中间档（比 128 小、比 2 大）
  const mid = planStartingColors({ maxBytes: src * 0.55, sourceBytes: src, format: 'APNG', baselineColors: 256 })
  assert(mid.plannedColors < 128 && mid.plannedColors >= 16, 'mid planned ' + mid.plannedColors)
})
t('planStartingColors 缺输入原样返回基线', () => {
  const r = planStartingColors({ maxBytes: 0, sourceBytes: 0, baselineColors: 64 })
  assert.strictEqual(r.plannedColors, 64)
  assert.strictEqual(r.feasible, true)
})

// ---------- 3) apngCompress 双路线 ----------
const apngSrc = stripAll(read('../src/util/processor/apngCompress.js')) +
  '\n;this.apngCompress = apngCompress;' +
  '\n' + stripAll(read('../src/util/paletteConfig.js'))

function makeCtx () {
  calls.length = 0
  quantExists = true
  quantThrow = null
  const dispatched = []
  const ctx = {
    path: { join: (...a) => path.posix.join(...a) },
    fs: {
      ensureDirSync: () => {},
      copySync: () => {},
      existsSync: (p) => p === QUANT ? quantExists : (p === OUT)
    },
    action: { bin: (n) => n, exec },
    appLog: { warn: () => {} },
    store: { dispatch: (e) => dispatched.push(e) },
    console
  }
  ctx.locale = { compressing: 'compressing' }
  vm.createContext(ctx)
  vm.runInContext(apngSrc, ctx)
  return ctx
}

function makeItem (opts) {
  return {
    index: 1,
    basic: { tmpDir: TMP, tmpOutputDir: TMP, fileList: [OUT + '-source'] },
    options: Object.assign({
      quality: { checked: true, value: 80 },
      floyd: { checked: true, value: 0.35 }
    }, opts || {})
  }
}

async function assertChain (name, fn) {
  try {
    await fn()
    passed++
    console.log('ok -', name)
  } catch (e) {
    console.error('FAIL -', name + ': ' + (e && e.message || e))
    process.exitCode = 1
  }
}

async function run () {
  await assertChain('色深路线：位置色数在输入文件前，且绝不传 --quality', async () => {
    const ctx = makeCtx()
    const item = makeItem({ palette: { mode: 'colors', colors: 64 } })
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const q = calls.find((c) => c.bin === 'apngquant')
    assert(q, 'apngquant not invoked')
    assert(!q.args.some((a) => String(a).indexOf('--quality') === 0), 'quality must not leak: ' + q.args)
    assert.strictEqual(q.args[0], 64, 'color count must be first positional: ' + q.args)
    assert(q.args.includes('--output'), 'output flag missing')
    const o = calls.find((c) => c.bin === 'apngopt')
    assert.strictEqual(o.args[0], QUANT, 'colors route must also chain into apngopt')
    assert.strictEqual(item.basic.fileList[0], OUT)
  })

  await assertChain('色深路线 C256 也执行量化（用户选色深即选减色）', async () => {
    const ctx = makeCtx()
    const item = makeItem({ palette: { mode: 'colors', colors: 256 }, quality: { checked: false, value: 80 } })
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const q = calls.find((c) => c.bin === 'apngquant')
    assert(q, 'C256 must still quantize')
    assert.strictEqual(q.args[0], 256)
  })

  await assertChain('质量路线：--quality 照旧且绝不传色数', async () => {
    const ctx = makeCtx()
    const item = makeItem({ quality: { checked: true, value: 50 } })
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const q = calls.find((c) => c.bin === 'apngquant')
    assert(q.args.includes('--quality=0-50'), 'quality missing')
    assert(!q.args.some((a) => typeof a === 'number'), 'no positional color count allowed: ' + q.args)
  })

  await assertChain('质量路线关闭压缩：不跑 apngquant（现状不变）', async () => {
    const ctx = makeCtx()
    const item = makeItem({ quality: { checked: false, value: 80 } })
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    assert(!calls.some((c) => c.bin === 'apngquant'))
    const o = calls.find((c) => c.bin === 'apngopt')
    assert.strictEqual(o.args[0], OUT)
  })

  await assertChain('色深路线 OOM fallback：退回无损 apngopt 且不误用残留量化文件', async () => {
    const ctx = makeCtx()
    const item = makeItem({ palette: { mode: 'colors', colors: 16 } })
    quantExists = true
    quantThrow = { err: 'libpng failed: memory allocation' }
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    assert.strictEqual(item.basic.apngQuantSkipped, true)
    const o = calls.find((c) => c.bin === 'apngopt')
    assert.strictEqual(o.args[0], OUT)
    assert.strictEqual(item.basic.fileList[0], OUT)
  })

  await assertChain('无 palette 字段（旧副本）：走质量路线原行为', async () => {
    const ctx = makeCtx()
    const item = makeItem({ quality: { checked: true, value: 80 } })
    delete item.options.palette
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const q = calls.find((c) => c.bin === 'apngquant')
    assert(q, 'legacy item must still quantize via quality route')
    assert(q.args.includes('--quality=0-80'))
    assert(!q.args.some((a) => typeof a === 'number'))
  })

  // ---------- 4) apng2gif GIF 色深链路（gifsicle）----------
  const GIF_OUT = path.posix.join(TMP, 'out.gif')
  const GIF_QUANT = path.posix.join(TMP, 'out-gif-quant.gif')
  let gifsicleThrow = null
  let gifQuantExists = true
  const gifCopies = []
  const gifSrc = stripAll(read('../src/util/processor/apng2gif.js'), 'apng2gif') +
    '\n;this.apng2gif = apng2gif;' +
    '\n' + stripAll(read('../src/util/paletteConfig.js'))

  function makeGifCtx () {
    calls.length = 0
    gifsicleThrow = null
    gifQuantExists = true
    gifCopies.length = 0
    const ctx = {
      path: {
        join: (...a) => path.posix.join(...a),
        basename: (p) => String(p).split('/').pop(),
        dirname: (p) => path.posix.dirname(p)
      },
      fs: {
        ensureDirSync: () => {},
        copySync: (a, b) => gifCopies.push([a, b]),
        existsSync: (p) => (String(p) === GIF_QUANT ? gifQuantExists : true)
      },
      action: {
        bin: (n) => n,
        exec: (bin, args) => {
          calls.push({ bin, args: args.slice() })
          if (bin === 'gifsicle' && gifsicleThrow) {
            const e = gifsicleThrow
            gifsicleThrow = null
            return Promise.reject(e)
          }
          return Promise.resolve({ command: bin })
        }
      },
      appLog: { warn: () => {} },
      store: { dispatch: () => {} },
      console
    }
    ctx.locale = { outputing: 'outputing' }
    vm.createContext(ctx)
    vm.runInContext(gifSrc, ctx)
    return ctx
  }

  function makeGifItem (opts) {
    return {
      index: 1,
      basic: { tmpDir: TMP, tmpOutputDir: TMP, fileList: [path.posix.join(TMP, 'src.png')] },
      options: Object.assign({ quality: { checked: true, value: 80 } }, opts || {})
    }
  }

  await assertChain('GIF 色深路线：gifsicle --colors N 且产物回写 out.gif', async () => {
    const ctx = makeGifCtx()
    const item = makeGifItem({ palette: { mode: 'colors', colors: 64 } })
    await ctx.apng2gif(item, ctx.store, ctx.locale)
    const g = calls.find((c) => c.bin === 'gifsicle')
    assert(g, 'gifsicle not invoked')
    // vm realm 数组原型与主 realm 不同，deepStrictEqual 会误报：统一 JSON 比较
    assert.strictEqual(JSON.stringify(g.args), JSON.stringify(['--colors', '64', GIF_OUT, '--output', GIF_QUANT]), 'args: ' + JSON.stringify(g.args))
    assert(!g.args.some((a) => String(a).indexOf('--quality') === 0), 'quality must not leak')
    assert(gifCopies.some((p) => p[0] === GIF_QUANT && p[1] === GIF_OUT), 'quant must overwrite out.gif')
    const a = calls.find((c) => c.bin === 'apng2gif')
    assert.strictEqual(JSON.stringify(a.args), JSON.stringify(['out-gif.png', 'out.gif']), 'apng2gif args unchanged: ' + JSON.stringify(a.args))
  })

  await assertChain('GIF 质量路线 / 旧配置：不调 gifsicle（现状不变）', async () => {
    const ctx = makeGifCtx()
    await ctx.apng2gif(makeGifItem(), ctx.store, ctx.locale)
    assert(calls.some((c) => c.bin === 'apng2gif'), 'apng2gif must run')
    assert(!calls.some((c) => c.bin === 'gifsicle'), 'quality route must not invoke gifsicle')
    const ctx2 = makeGifCtx()
    const legacy = makeGifItem()
    delete legacy.options.palette
    await ctx2.apng2gif(legacy, ctx2.store, ctx2.locale)
    assert(!calls.some((c) => c.bin === 'gifsicle'), 'legacy item must not invoke gifsicle')
  })

  await assertChain('GIF 色深 + gifsicle 失败：保留原产物不抛错', async () => {
    const ctx = makeGifCtx()
    const item = makeGifItem({ palette: { mode: 'colors', colors: 16 } })
    gifsicleThrow = { err: 'gifsicle crashed' }
    await ctx.apng2gif(item, ctx.store, ctx.locale)
    assert(!gifCopies.some((p) => p[0] === GIF_QUANT), 'must not copy missing quant over out.gif')
  })

  await assertChain('GIF 色深 + gifsicle 产物缺失：不覆盖原产物', async () => {
    const ctx = makeGifCtx()
    const item = makeGifItem({ palette: { mode: 'colors', colors: 16 } })
    gifQuantExists = false
    await ctx.apng2gif(item, ctx.store, ctx.locale)
    assert(calls.some((c) => c.bin === 'gifsicle'), 'gifsicle must be attempted')
    assert(!gifCopies.some((p) => p[0] === GIF_QUANT), 'missing quant must not overwrite out.gif')
  })

  console.log(`\npalette-compress: ${passed} checks passed`)
  if (process.exitCode) { process.exit(1) }
}

run()
