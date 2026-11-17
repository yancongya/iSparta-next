// 色深压缩路线配置：与 sizeLimitConfig 同一定位——纯函数、无 IO，桌面与 CEP 共用。
// 路线语义：
// - quality（默认）：pngquant --quality min-max 动态策略，行为与历史版本完全一致
// - colors：固定调色板档位，pngquant --colors N（libimagequant max_colors，2-256）
// 两条路线互斥：任何下游不得同时下发 --quality 与 --colors。
//
// options.palette 可能缺省（旧持久化配置 / 旧任务副本 / CEP 旧数据），
// 所有读取必须经 normalizePalette 兜底——缺省一律解读为 quality 路线，保证旧数据零破坏。

/** 色深档位（产品决策：仅档位，不提供自由输入，降低误配面） */
export const PALETTE_COLOR_PRESETS = [2, 4, 8, 16, 32, 64, 128, 256]

/**
 * 归一化 palette 配置。
 * @param {object} options 任务的 options（可空）
 * @returns {{mode:'quality'|'colors', colors:number}} mode 只会是这两个值；
 *          colors 吸附到最近档位、钳在 2-256
 */
export function normalizePalette (options) {
  const p = options && options.palette
  const mode = (p && p.mode === 'colors') ? 'colors' : 'quality'
  // p 为 null/undefined 时 Number(null)===0 会被 isFinite 放行，必须显式排除
  let colors = (p && p.colors !== null && p.colors !== undefined) ? Number(p.colors) : NaN
  if (!isFinite(colors)) { colors = 256 }
  colors = Math.min(256, Math.max(2, Math.round(colors)))
  let nearest = PALETTE_COLOR_PRESETS[0]
  for (let i = 0; i < PALETTE_COLOR_PRESETS.length; i++) {
    if (Math.abs(PALETTE_COLOR_PRESETS[i] - colors) < Math.abs(nearest - colors)) {
      nearest = PALETTE_COLOR_PRESETS[i]
    }
  }
  return { mode: mode, colors: nearest }
}

/** 色深路线是否生效（转换链路据此决定传 --colors 还是 --quality） */
export function isColorsMode (options) {
  return normalizePalette(options).mode === 'colors'
}

/**
 * 色深重试：超限时按档位逐级下调（对称 quality 路线的 automaticRetryQuality）。
 * 从当前档位向更小档位取第 attempt 步；到底后维持最小档位继续重试（最终由判超限兜底）。
 * @param {number} colors 当前色数（先经档位吸附）
 * @param {number} maxTries 总重试次数上限
 * @param {number} attempt 第几次重试（1 起）
 * @returns {number} 本轮重试应使用的色数
 */
export function automaticRetryColors (colors, maxTries, attempt) {
  const cur = normalizePalette({ palette: { mode: 'colors', colors: colors } }).colors
  const idx = PALETTE_COLOR_PRESETS.indexOf(cur)
  const a = Math.max(1, Math.floor(Number(attempt) || 1))
  // 重试序列：cur → 每步跳一档向下；低于最小档后停在 2（继续重试由 sizeGate 判定仍超限而收尾）
  const steps = Math.min(a, Math.max(1, idx))
  return PALETTE_COLOR_PRESETS[idx - steps] || PALETTE_COLOR_PRESETS[0]
}

/**
 * 色深路线的有效重试次数上限：低于当前档位的档数（到 2 为止），再与用户配置取小。
 * 对称 quality 路线 automaticRetryCount 的「有效次数」语义。
 */
export function automaticRetryColorsCount (colors, configuredMaxTries) {
  const cur = normalizePalette({ palette: { mode: 'colors', colors: colors } }).colors
  const idx = PALETTE_COLOR_PRESETS.indexOf(cur)
  const steps = Math.max(0, idx)
  const configured = (isFinite(configuredMaxTries) && configuredMaxTries >= 0) ? Math.floor(configuredMaxTries) : 10
  return Math.min(configured, steps)
}
