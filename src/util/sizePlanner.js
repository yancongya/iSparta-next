// 目标大小前置规划：在首压之前，把「目标体积」翻译成一个保守的起始质量。
// 定位：仅为起始建议，不替换 sizeGate 的事后重试（两者并存更稳，见 docs/TODO-toolchain-and-sizing.md）。
// 纯函数，无 IO，便于单测；只依赖调用方传入的标量。

const DEFAULT_QUALITY = 80

function clamp (n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

function finite (n, fallback) {
  const v = Number(n)
  return isFinite(v) ? v : fallback
}

/**
 * 估算「质量 q（0-100）下，格式 format 的输出体积」。
 * 经验模型：体积 ≈ sourceBytes × (q/100)^k，k 随格式不同（量化敏感度不同）。
 * 仅用于排序/反推量级，不追求精确；sizeGate 事后按真实大小兜底。
 */
export function estimateBytes (sourceBytes, q, format) {
  const src = finite(sourceBytes, 0)
  if (src <= 0) { return 0 }
  const quality = clamp(finite(q, DEFAULT_QUALITY), 1, 100)
  // pngquant / cwebp 的质量-体积曲线指数（越大＝降质量省得越多）
  const k = format === 'WEBP' ? 1.35 : format === 'GIF' ? 1.15 : 1.6
  return src * Math.pow(quality / 100, k)
}

/**
 * 由目标体积反推起始质量（保守：结果再乘 SAFETY，宁可偏低让 sizeGate 兜底）。
 * 返回 { plannedQuality, suggestions, feasible }：
 * - plannedQuality：建议起始质量（整数 1-100），调用方决定如何应用
 * - suggestions：每格式的反推明细，供 UI「实时预估」展示
 * - feasible：目标是否可达（Q=1 仍超限时为 false）
 */
export function planStartingQuality (input) {
  const o = input || {}
  const maxBytes = finite(o.maxBytes, 0)
  const sourceBytes = finite(o.sourceBytes, 0)
  const formats = Array.isArray(o.formats) && o.formats.length ? o.formats : ['APNG']
  const baseline = clamp(finite(o.baselineQuality, DEFAULT_QUALITY), 1, 100)
  const safety = clamp(finite(o.safety, 0.9), 0.5, 1)
  // 规划下限：过低质量观感差，且 sizeGate 还有重试空间，不必一步压到极限
  const floor = clamp(finite(o.floorQuality, 20), 1, baseline)

  if (!(maxBytes > 0) || !(sourceBytes > 0)) {
    return { plannedQuality: baseline, suggestions: [], feasible: true, reason: 'no-input' }
  }

  const suggestions = formats.map(function (format) {
    // 反推 q：maxBytes = source × (q/100)^k  =>  q = 100 × (max/source)^(1/k)
    const k = format === 'WEBP' ? 1.35 : format === 'GIF' ? 1.15 : 1.6
    const raw = 100 * Math.pow(Math.max(maxBytes, 1) / sourceBytes, 1 / k)
    const conservative = raw * safety
    const q = Math.round(clamp(conservative, floor, 100))
    const feasible = estimateBytes(sourceBytes, 1, format) <= maxBytes
    return { format, rawQuality: Math.round(raw), quality: q, feasible }
  })

  // 多格式取最低建议（最保守），保证每个格式都有机会达标
  const minQ = suggestions.reduce(function (m, s) { return Math.min(m, s.quality) }, 100)
  const allFeasible = suggestions.every(function (s) { return s.feasible })
  const plannedQuality = clamp(Math.min(minQ, baseline), floor, 100)
  return { plannedQuality, suggestions, feasible: allFeasible, reason: 'planned' }
}
