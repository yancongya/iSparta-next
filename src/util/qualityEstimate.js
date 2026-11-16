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
import { planStartingQuality } from './sizePlanner'

const MB = 1024 * 1024

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
 *          sizeLimit 未启用 / 无格式 / 无源字节时返回 null（角标不显示）
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

/** 字节数转人类可读（角标 tooltip 用），与 sizeGate.formatMB 同口径 */
export function humanSize (bytes) {
  const n = Number(bytes)
  if (!(n > 0)) return '—'
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB'
  // 源字节可能很大（长序列），保留两位避免 10.00 与 10.01 看起来一样
  return (n / MB).toFixed(2) + ' MB'
}
