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
 * 经验模型：体积 ≈ sourceBytes × (floor + (1-floor) × (q/100)^k)，k 随格式不同（量化敏感度不同）。
 * - floor（0-0.9，缺省 0）：降质收益下限。量化只减调色板，像素数据 + 熵编码占大头，
 *   低质量端体积并不会按幂曲线无限缩水（索引/平面源实测输出 ≈ 源的 0.8~1.0）。
 *   角标展示传 0.5 折中值压低低端虚高偏差；首压规划仍用缺省 0（乐观曲线 + sizeGate
 *   重试兜底更稳，规划曲线变保守会让「只降不升」的起始质量被不必要地压低）。
 * 仅用于排序/反推量级，不追求精确；sizeGate 事后按真实大小兜底。
 */
export function estimateBytes (sourceBytes, q, format, floor) {
  const src = finite(sourceBytes, 0)
  if (src <= 0) { return 0 }
  const quality = clamp(finite(q, DEFAULT_QUALITY), 1, 100)
  const f = clamp(finite(floor, 0), 0, 0.9)
  // pngquant / cwebp 的质量-体积曲线指数（越大＝降质量省得越多）
  const k = format === 'WEBP' ? 1.35 : format === 'GIF' ? 1.15 : 1.6
  return src * (f + (1 - f) * Math.pow(quality / 100, k))
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

// ---------- 色深路线（palette.mode === 'colors'）----------
// 与 paletteConfig.PALETTE_COLOR_PRESETS 同源的档位表。这里本地再声明一份是为了
// 保持 sizePlanner 零依赖可被 vm 沙箱逐源拼接测试（paletteConfig 由测试脚本一并注入）。
var COLOR_PRESETS = [2, 4, 8, 16, 32, 64, 128, 256]

/**
 * 估算「色数 c 下，格式 format 的输出体积」。
 * 经验模型：量化后走索引位宽，bytes ≈ sourceBytes × (floor + (1-floor) × (log2(c)/8)^kc)。
 * kc：GIF 天生索引色受益直接取 0.5，APNG/PNG 走 PLTE+zlib 取 0.7。
 * floor 同 estimateBytes 的「降质收益下限」语义（角标 0.5 / 规划缺省 0）：
 * 少色只减调色板，像素数据仍在，2 色也不会缩到源的个位数百分比。
 * 仅用于量级预估（首压规划 / 角标），sizeGate 事后按真实大小兜底。
 */
export function estimateColorsBytes (sourceBytes, colors, format, floor) {
  const src = finite(sourceBytes, 0)
  if (src <= 0) { return 0 }
  const c = clamp(Math.round(Number(colors) || 256), 2, 256)
  const f = clamp(finite(floor, 0), 0, 0.9)
  const bpp = Math.max(1, Math.log2(c)) / 8
  const kc = format === 'GIF' ? 0.5 : 0.7
  return src * (f + (1 - f) * Math.pow(bpp, kc))
}

/**
 * 由「目标体积」反推保守的起始色数档位（色深路线，对称 planStartingQuality）。
 * 返回 { plannedColors, feasible }：
 * - plannedColors：建议起始色数（档位值，只降不升由调用方保证）
 * - feasible：目标是否可达（最低档仍超限时为 false）
 */
export function planStartingColors (input) {
  const o = input || {}
  const maxBytes = finite(o.maxBytes, 0)
  const sourceBytes = finite(o.sourceBytes, 0)
  const format = o.format || 'APNG'
  const baseline = clamp(Math.round(finite(o.baselineColors, 256)), 2, 256)
  const safety = clamp(finite(o.safety, 0.9), 0.5, 1)
  // 规划下限：过低色数观感崩坏，且 sizeGate 还有逐档重试空间
  const floor = clamp(Math.round(finite(o.floorColors, 16)), 2, baseline)

  if (!(maxBytes > 0) || !(sourceBytes > 0)) {
    return { plannedColors: baseline, feasible: true, reason: 'no-input' }
  }

  // 从不高于基线的最高档往下找第一个满足目标的档位；预算上限 × safety 保守
  let planned = floor
  let feasible = false
  for (let i = COLOR_PRESETS.length - 1; i >= 0; i--) {
    const c = COLOR_PRESETS[i]
    if (c > baseline) { continue }
    if (estimateColorsBytes(sourceBytes, c, format) <= maxBytes * safety) {
      planned = Math.max(c, floor)
      feasible = true
      break
    }
  }
  // 最低档仍超限：仍返回 floor，交由 sizeGate 事后如实判超限
  return { plannedColors: feasible ? planned : floor, feasible: feasible, reason: 'planned' }
}
