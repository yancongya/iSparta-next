// 预估起始质量：把 sizeLimit 目标体积翻译成一个「建议起始质量 Q」，供任务条 / 合成树
// 的常驻小角标显示。与转换链路共用 sizePlanner，保证「界面看到的 Q」和「首压真正用的 Q」
// 出自同一套模型，不会出现两个数字对不上的情况。
//
// 数据源两种：
// - 真实源字节：桌面动图文件已落盘，fs.statSize 直接拿；
// - 估算源字节：CEP 合成转换前 fileList 为空，只能按 width×height×frames×压缩系数估一个量级，
//   结果标记 estimated=true，UI 必须标注「仅供参考」。
//
// 纯函数（不直接读文件），源字节由调用方传入，便于单测与两视图复用。

import { normalizeSizeLimit } from './processor/sizeGate'
import { effectiveQualityStart } from './sizeLimitConfig'
import { planStartingQuality, planStartingColors, estimateColorsBytes, estimateBytes } from './sizePlanner'
import { normalizePalette } from './paletteConfig'

const MB = 1024 * 1024

// 角标展示曲线的「降质收益下限」（sizePlanner.estimateBytes 的 floor 参数）：
// 8bit 索引 / 平面内容降质后输出仍 ≈ 源大小，(q/100)^k 幂曲线在低端会虚低 2~3 倍，
// 0.5 是索引源（≈0.8~1.0）与 RGBA 源（≈0.4）之间的折中，把误差压进 ±40% 量级。
// 仅角标展示用；首压规划（planStartingQuality / planStartingColors）保持乐观曲线，
// 两者的「Q/C 档」仍同源（规划值），只是体积换更贴近实际的展示口径。
const DISPLAY_FLOOR = 0.5

/**
 * 按合成尺寸与帧数估算未压缩 PNG 序列的量级。
 * 一帧 RGBA 原始字节 = w×h×4；pngquant/APNG 通常压到原始的 20%~35%，取 0.28 作中位。
 * 这个数只用于「量级预估」，不追求准确——sizeGate 事后仍按真实大小兜底。
 */
export function estimateSourceBytes (width, height, frames) {
  const w = Math.max(0, Number(width) || 0)
  const h = Math.max(0, Number(height) || 0)
  const f = Math.max(0, Number(frames) || 0)
  if (!w || !h || !f) return 0
  return w * h * 4 * f * 0.28
}

/**
 * 由「任务 options + 源字节」算预估起始质量。
 * @param {object} options 任务的 options（sizeLimit / outputFormat / quality）
 * @param {number} sourceBytes 源字节；<=0 返回 null
 * @param {boolean} estimated 源字节是否为估算值（影响 UI 文案）
 * @returns {{quality:number, baseline:number, sourceBytes:number, maxBytes:number,
 *            formats:string[], estimated:boolean, feasible:boolean, changed:boolean}|null}
 *          无目标可规划（sizeLimit 未启用）/ 无格式 / 无源字节时返回 null
 */
export function estimateQuality (options, sourceBytes, estimated) {
  const opts = options || {}
  const sl = opts.sizeLimit
  if (!sl || !sl.enabled) return null
  const formats = Array.isArray(opts.outputFormat) ? opts.outputFormat.slice() : []
  if (!formats.length) return null
  const src = Number(sourceBytes)
  if (!(src > 0)) return null

  const q = opts.quality || {}
  const baseline = effectiveQualityStart(q.value, q.checked)
  const limit = normalizeSizeLimit(opts, baseline)
  const plan = planStartingQuality({
    maxBytes: limit.maxBytes,
    sourceBytes: src,
    formats: formats,
    baselineQuality: baseline,
    safety: 0.9,
    floorQuality: 20
  })
  return {
    quality: plan.plannedQuality,
    baseline: baseline,
    sourceBytes: src,
    maxBytes: limit.maxBytes,
    formats: formats,
    estimated: !!estimated,
    feasible: !!plan.feasible,
    changed: plan.plannedQuality < baseline
  }
}

/**
 * 预估产物大小（角标主显示值）：按当前压缩路线估每种格式的输出体积，取最大值作
 * 保守估计——sizeLimit 是「每个文件」的上限，最坏的那个格式才决定是否达标。
 * 目标大小只是「参照系」而不是「显示门槛」：未启用 sizeLimit 时仍按用户当前
 * 质量/色数直接估体积（hasTarget:false、无超限态），角标常驻可见。
 * @returns {{text:string, bytes:number, target:number, quality:number, baseline:number,
 *            sourceBytes:number, over:boolean, estimated:boolean, details:Array,
 *            hasTarget:boolean}|null}
 *          无格式 / 无源字节时返回 null（角标不显示）
 */
export function estimateOutput (options, sourceBytes, estimated) {
  const opts = options || {}
  const sl = opts.sizeLimit
  const hasTarget = !!(sl && sl.enabled)
  const formats = Array.isArray(opts.outputFormat) ? opts.outputFormat.slice() : []
  if (!formats.length) return null
  const src = Number(sourceBytes)
  if (!(src > 0)) return null

  const pal = normalizePalette(opts)
  const baseline = effectiveQualityStart(opts.quality && opts.quality.value, opts.quality && opts.quality.checked)

  // 色深路线：有目标时反推起始色数档位，逐格式按色数模型估体积。
  // 返回结构与质量路线同形（mode:'colors' 供角标文案区分 C/C 档）
  if (pal.mode === 'colors') {
    let colors = pal.colors
    let feasible = true
    let target = 0
    if (hasTarget) {
      const limit = normalizeSizeLimit(opts, baseline)
      target = limit.maxBytes
      const worstFormat = formats.reduce(function (m, f) {
        return estimateColorsBytes(src, pal.colors, f, DISPLAY_FLOOR) > estimateColorsBytes(src, pal.colors, m, DISPLAY_FLOOR) ? f : m
      }, formats[0])
      const plan = planStartingColors({
        maxBytes: limit.maxBytes,
        sourceBytes: src,
        format: worstFormat,
        baselineColors: pal.colors,
        safety: 0.9,
        floorColors: 16
      })
      colors = plan.plannedColors
      feasible = !!plan.feasible
    }
    let maxBytesC = 0
    const detailsC = formats.map(function (format) {
      const bytes = estimateColorsBytes(src, colors, format, DISPLAY_FLOOR)
      if (bytes > maxBytesC) maxBytesC = bytes
      return { format: format, bytes: bytes, over: hasTarget && bytes > target }
    })
    return {
      mode: 'colors',
      colors: colors,
      baseline: pal.colors,
      text: humanSize(maxBytesC),
      bytes: maxBytesC,
      target: target,
      sourceBytes: src,
      over: hasTarget && maxBytesC > target,
      estimated: !!estimated,
      feasible: feasible,
      details: detailsC,
      hasTarget: hasTarget
    }
  }

  // 质量路线：有目标时用「规划后的起始质量」算体积，无目标按用户基线质量直接估。
  // 逐格式估算产物体积，取最大作为「最可能超限」的保守值
  const base = hasTarget ? estimateQuality(options, sourceBytes, estimated) : null
  const q = base ? base.quality : baseline
  const target = base ? base.maxBytes : 0
  let maxBytes = 0
  const details = formats.map(function (format) {
    const bytes = estimateBytes(src, q, format, DISPLAY_FLOOR)
    if (bytes > maxBytes) maxBytes = bytes
    return { format: format, bytes: bytes, over: hasTarget && bytes > target }
  })

  return {
    mode: 'quality',
    text: humanSize(maxBytes),
    bytes: maxBytes,
    target: target,
    quality: q,
    baseline: baseline,
    sourceBytes: src,
    over: hasTarget && maxBytes > target,
    estimated: !!estimated,
    feasible: base ? !!base.feasible : true,
    details: details,
    hasTarget: hasTarget
  }
}

/**
 * 角标单字母前缀：APNG→A / GIF→G / WEBP→W（未知格式取首字母兜底）。
 * 角标按格式显示时空间极小，用单字母而非全名。
 */
export function formatLetter (format) {
  const f = String(format || '').toUpperCase()
  return { APNG: 'A', GIF: 'G', WEBP: 'W' }[f] || f.charAt(0) || '?'
}

/**
 * 紧凑字号（角标专用）：860B / 2.4K / 240K / 10.2M。比 humanSize 短——角标要加格式
 * 字母前缀，且 CEP 状态列宽度敏感，全称「254 KB」会挤爆布局；tooltip 仍用 humanSize 全称。
 * 10K 以下给一位小数：小体积四舍五入到整 K 的显示误差占比太大，会把预估偏差
 * 放大成肉眼可见的对不上（issue #2 反馈的小文件场景）。
 */
export function humanSizeCompact (bytes) {
  const n = Number(bytes)
  if (!(n > 0)) return '—'
  if (n < 1024) return Math.round(n) + 'B'
  if (n < MB) {
    const k = n / 1024
    return (k < 10 ? k.toFixed(1) : Math.round(k)) + 'K'
  }
  return (n / MB).toFixed(1) + 'M'
}

/**
 * 角标当前显示的格式明细：默认取「最坏格式」（bytes 最大、决定是否超限的那个），
 * 与 estimateOutput 的保守口径一致；用户点击轮换后按 selectedIndex 显示，
 * 越界 / 未点过自动回退到最坏格式。
 * @returns {{format:string, bytes:number, over:boolean}|null}
 */
export function pickEstDetail (details, selectedIndex) {
  if (!Array.isArray(details) || !details.length) return null
  let worst = 0
  for (let i = 1; i < details.length; i++) {
    if (details[i].bytes > details[worst].bytes) worst = i
  }
  const idx = (Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < details.length)
    ? selectedIndex
    : worst
  return details[idx]
}

/** 字节数转人类可读（角标 tooltip 用），与 sizeGate.formatMB 同口径；
 *  1MB 以下保留一位小数——小体积取整 KB 会把预估偏差放大（同 humanSizeCompact） */
export function humanSize (bytes) {
  const n = Number(bytes)
  if (!(n > 0)) return '—'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  // 源字节可能很大（长序列），保留两位避免 10.00 与 10.01 看起来一样
  return (n / MB).toFixed(2) + ' MB'
}
