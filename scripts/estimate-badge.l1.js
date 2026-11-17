// 预估角标（按格式轮换）回归：formatLetter / humanSizeCompact / pickEstDetail / estimateOutput 全链路。
// vm 沙箱加载真实源码（qualityEstimate + sizePlanner + sizeLimitConfig + sizeGate 的 normalizeSizeLimit），
// 保证「界面角标看到的分格式明细」和「sizeGate 用的同一套模型」对得上。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8')
// 去掉 ESM import 行（依赖按顺序手工拼接进同一脚本）、去掉 export 前缀
const strip = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export function /gm, 'function ')
const stripAllConst = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export const /gm, 'const ')
  .replace(/^export function /gm, 'function ')

// 依赖顺序：paletteConfig（压缩路线）→ sizePlanner（纯函数）→ sizeLimitConfig（纯函数）
// → sizeGate（只要 normalizeSizeLimit）→ qualityEstimate（被测主体）
const source = [
  stripAllConst(read('../src/util/paletteConfig.js')),
  strip(read('../src/util/sizePlanner.js')),
  strip(read('../src/util/sizeLimitConfig.js')),
  strip(read('../src/util/processor/sizeGate.js')),
  strip(read('../src/util/qualityEstimate.js')),
  '\nglobalThis.api = { formatLetter, humanSizeCompact, pickEstDetail, estimateOutput, humanSize }'
].join('\n')

const sandbox = {
  Math, Number, String, Array, Object, Boolean, Date, JSON, isFinite, isNaN,
  Promise, parseInt, parseFloat,
  // sizeGate import 行被剥离后，模块体可能引用这些名字；normalizeSizeLimit 路径不会走到，
  // 但加载期不能有未定义的全局
  fs: { existsSync: () => false },
  path,
  TYPE: { APNG: 'APNG', GIF: 'GIF', WEBP: 'WEBP' },
  appLog: { info: () => {}, warn: () => {}, error: () => {} },
  i18n: {},
  apngCompress: () => Promise.resolve(),
  apng2gif: () => Promise.resolve(),
  apng2webp: () => Promise.resolve()
}
vm.createContext(sandbox)
vm.runInContext(source, sandbox, { filename: 'estimate-badge.l1.vm.js' })
const { formatLetter, humanSizeCompact, pickEstDetail, estimateOutput } = sandbox.api

let passed = 0
function t (name, fn) {
  fn()
  passed++
  console.log('ok -', name)
}

// ---------- formatLetter ----------
t('formatLetter 三个已知格式', () => {
  assert.strictEqual(formatLetter('APNG'), 'A')
  assert.strictEqual(formatLetter('GIF'), 'G')
  assert.strictEqual(formatLetter('WEBP'), 'W')
})
t('formatLetter 未知格式取首字母 / 空值兜底', () => {
  assert.strictEqual(formatLetter('qoi'), 'Q')
  assert.strictEqual(formatLetter(''), '?')
  assert.strictEqual(formatLetter(null), '?')
})

// ---------- humanSizeCompact ----------
t('humanSizeCompact 小体积 B / 一位小数 K（小文件显示误差不放大）', () => {
  assert.strictEqual(humanSizeCompact(860), '860B')
  assert.strictEqual(humanSizeCompact(1024), '1.0K')
  assert.strictEqual(humanSizeCompact(5 * 1024), '5.0K')
})
t('humanSizeCompact 10K 以上整 K 四舍五入', () => {
  assert.strictEqual(humanSizeCompact(245760), '240K')
})
t('humanSizeCompact MB 段一位小数', () => {
  assert.strictEqual(humanSizeCompact(10 * 1024 * 1024 + 300 * 1024), '10.3M')
})
t('humanSizeCompact 非正数给占位符', () => {
  assert.strictEqual(humanSizeCompact(0), '—')
  assert.strictEqual(humanSizeCompact(-5), '—')
  assert.strictEqual(humanSizeCompact(NaN), '—')
})

// ---------- pickEstDetail ----------
const DETAILS = [
  { format: 'APNG', bytes: 100, over: false },
  { format: 'GIF', bytes: 512, over: true },
  { format: 'WEBP', bytes: 180, over: false }
]
t('pickEstDetail 默认取最坏格式（bytes 最大）', () => {
  assert.strictEqual(pickEstDetail(DETAILS).format, 'GIF')
  assert.strictEqual(pickEstDetail(DETAILS).over, true)
})
t('pickEstDetail 合法下标按用户选择', () => {
  assert.strictEqual(pickEstDetail(DETAILS, 0).format, 'APNG')
  assert.strictEqual(pickEstDetail(DETAILS, 2).format, 'WEBP')
})
t('pickEstDetail 越界 / 负数 / 非整数回退最坏格式', () => {
  assert.strictEqual(pickEstDetail(DETAILS, 9).format, 'GIF')
  assert.strictEqual(pickEstDetail(DETAILS, -1).format, 'GIF')
  assert.strictEqual(pickEstDetail(DETAILS, null).format, 'GIF')
  assert.strictEqual(pickEstDetail(DETAILS, undefined).format, 'GIF')
})
t('pickEstDetail 空明细返回 null', () => {
  assert.strictEqual(pickEstDetail([]), null)
  assert.strictEqual(pickEstDetail(null), null)
})

// ---------- estimateOutput 全链路（真实模型）----------
function opts (maxKB, formats, quality) {
  return {
    sizeLimit: { enabled: true, maxBytes: maxKB * 1024, unit: 'KB' },
    quality: { value: quality == null ? 80 : quality, checked: true },
    outputFormat: formats
  }
}
t('estimateOutput 三格式逐格式明细齐全且 GIF 体积最大（k 最小）', () => {
  const e = estimateOutput(opts(500, ['APNG', 'GIF', 'WEBP']), 10 * 1024 * 1024, false)
  assert.ok(e, 'sizeLimit 开启时应返回预估')
  assert.strictEqual(e.details.length, 3)
  assert.deepStrictEqual(e.details.map((d) => d.format), ['APNG', 'GIF', 'WEBP'])
  const gif = e.details.find((d) => d.format === 'GIF')
  assert.strictEqual(e.bytes, gif.bytes, '保守值应等于最坏格式体积')
  assert.strictEqual(e.text, sandbox.api.humanSize(gif.bytes))
})
t('estimateOutput over 标记逐格式独立（目标卡在 GIF 与其余格式之间）', () => {
  // 基线 Q=20：规划钳在规划下限 20，两次调用的规划 Q 恒定，才好在目标轴上精确卡位
  const probe = estimateOutput(opts(500, ['APNG', 'GIF', 'WEBP'], 20), 10 * 1024 * 1024, false)
  const gifBytes = probe.details.find((d) => d.format === 'GIF').bytes
  const webpBytes = probe.details.find((d) => d.format === 'WEBP').bytes
  assert.ok(gifBytes - webpBytes > 1024, 'GIF 与 WEBP 模型体积差应大于 1KB')
  const o = opts(500, ['APNG', 'GIF', 'WEBP'], 20)
  o.sizeLimit.maxBytes = gifBytes - 1024
  const e = estimateOutput(o, 10 * 1024 * 1024, false)
  const byFmt = {}
  e.details.forEach((d) => { byFmt[d.format] = d })
  assert.strictEqual(byFmt.GIF.over, true, '目标略低于 GIF 模型体积，GIF 应标记超限')
  assert.strictEqual(byFmt.WEBP.over, false, 'WEBP 体积小于 GIF，不应标记超限')
  assert.strictEqual(byFmt.APNG.over, false, 'APNG 体积最小，不应标记超限')
  assert.strictEqual(e.over, true, '整体 over 取最坏格式')
})
t('estimateOutput 单格式 details 只有一项且可轮换退化（长度 1 不给轮换）', () => {
  const e = estimateOutput(opts(500, ['APNG']), 1024 * 1024, 80)
  assert.strictEqual(e.details.length, 1)
  const picked = pickEstDetail(e.details, 3)
  assert.strictEqual(picked.format, 'APNG')
})
t('estimateOutput sizeLimit 关闭仍给预估（hasTarget:false，无超限态）', () => {
  const o = opts(500, ['APNG', 'GIF'])
  o.sizeLimit.enabled = false
  const src = 1024 * 1024
  const e = estimateOutput(o, src, false)
  assert.ok(e, '目标只是参照系，不是角标显示门槛（issue #2：关掉大小限制角标消失）')
  assert.strictEqual(e.hasTarget, false)
  assert.strictEqual(e.over, false, '无目标不存在超限态')
  assert.strictEqual(e.target, 0)
  assert.strictEqual(e.quality, 80, '无目标按用户基线质量直接估')
  assert.strictEqual(e.sourceBytes, src, '返回源字节供 tooltip 显示')
  e.details.forEach((d) => assert.strictEqual(d.over, false))
  // 展示曲线带 floor=0.5：q=80 落在 (0.5, 1.0)×src，不再被幂曲线压到 0.7 以下
  assert(e.bytes > src * 0.5 && e.bytes < src, 'q=80 体积应在 (0.5,1.0)×src: ' + e.bytes)
})
t('estimateOutput 无格式 / 无源字节仍返回 null', () => {
  const o = opts(500, [])
  o.sizeLimit.enabled = false
  assert.strictEqual(estimateOutput(o, 1024 * 1024, false), null)
  assert.strictEqual(estimateOutput(opts(500, ['APNG']), 0, false), null)
})

// ---------- estimateOutput 色深路线（色数档位）----------
t('estimateOutput 色深路线：mode/baseline/逐格式明细与保守值', () => {
  const o = opts(500, ['APNG', 'GIF', 'WEBP'])
  o.palette = { mode: 'colors', colors: 64 }
  const e = estimateOutput(o, 10 * 1024 * 1024, false)
  assert.strictEqual(e.mode, 'colors')
  assert.strictEqual(e.baseline, 64)
  assert(e.colors <= 64 && e.colors >= 16, 'planned colors 落在档位内: ' + e.colors)
  assert.strictEqual(e.details.length, 3)
  const gif = e.details.find((d) => d.format === 'GIF')
  const webp = e.details.find((d) => d.format === 'WEBP')
  assert(gif.bytes >= webp.bytes, 'GIF 色数量级应不低于 WEBP')
  assert.strictEqual(e.bytes, Math.max.apply(null, e.details.map((d) => d.bytes)), '保守值取最坏格式')
  assert.strictEqual(e.text, sandbox.api.humanSize(e.bytes))
})
t('estimateOutput 色深路线：目标宽松不降档，紧目标自动下调色数', () => {
  const loose = opts(50000, ['APNG'])
  loose.palette = { mode: 'colors', colors: 256 }
  const e1 = estimateOutput(loose, 1024 * 1024, false)
  assert.strictEqual(e1.colors, 256, '目标宽松应保持 256')
  assert.strictEqual(e1.feasible, true)
  const tight = opts(20, ['APNG'])
  tight.palette = { mode: 'colors', colors: 256 }
  const e2 = estimateOutput(tight, 10 * 1024 * 1024, false)
  assert(e2.colors < 256, '紧目标应下调色数: ' + e2.colors)
  assert.strictEqual(e2.baseline, 256, 'baseline 保留用户档位')
})
t('estimateOutput 质量路线（旧配置）：mode quality 且不带 colors 字段（互斥）', () => {
  const e = estimateOutput(opts(500, ['APNG', 'GIF']), 10 * 1024 * 1024, false)
  assert.strictEqual(e.mode, 'quality')
  assert(!('colors' in e), 'quality 路线不得携带 colors')
})

// ---------- 无目标（sizeLimit 关闭）----------
t('estimateOutput 无目标色深路线：C256 体积≈源（索引全档无量化收益）', () => {
  const o = opts(500, ['APNG'])
  o.sizeLimit.enabled = false
  o.palette = { mode: 'colors', colors: 256 }
  const src = 4 * 1024 * 1024
  const e = estimateOutput(o, src, false)
  assert.strictEqual(e.mode, 'colors')
  assert.strictEqual(e.colors, 256, '无目标不降档')
  assert.strictEqual(e.bytes, src, '256 色因子恒为 1')
  assert.strictEqual(e.hasTarget, false)
  assert.strictEqual(e.over, false)
})
t('estimateOutput 无目标色深路线：低色数体积被 floor 托住（不虚低）', () => {
  const o = opts(500, ['APNG'])
  o.sizeLimit.enabled = false
  o.palette = { mode: 'colors', colors: 2 }
  const src = 4 * 1024 * 1024
  const e = estimateOutput(o, src, false)
  assert.strictEqual(e.colors, 2)
  // 2 色 bpp=1/8，kc=0.7 → 幂项 ≈0.24；floor=0.5 托底 → 因子 ≈0.62，不掉到 0.3 以下
  assert(e.bytes > src * 0.5, 'floor 托底后不应低于 0.5×src: ' + e.bytes)
  assert(e.bytes < src, '低色数仍应小于源')
})
t('humanSize 小体积一位小数 KB', () => {
  assert.strictEqual(sandbox.api.humanSize(1536), '1.5 KB')
  assert.strictEqual(sandbox.api.humanSize(10 * 1024), '10.0 KB')
})

console.log('\n' + passed + ' tests passed')
