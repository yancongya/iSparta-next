/**
 * CEP 合成树列布局的唯一真相源。
 *
 * 只有三列可配置：尺寸 / 帧率 / 运行状态。它们的宽度与顺序持久化在 storage 的
 * `compTree.columns`（与 globalSetting 同一套文件存储，CEP 真机 / 浏览器 mock 同构）。
 *
 * 表头只保留「点击排序 + 拖右缘改宽」两种手势，列顺序走表头右键菜单。
 * 拖分隔线时宽度变化必须由**紧邻右侧列**反向吸收（数值列组总宽不变），这样名字列
 * 不会被 flex 反向吃掉、被拖的那根分隔线才会跟着指针走；最后一列右缘是面板边、
 * 没有右邻可挤，不给把手，宽度改走右键菜单的「窄 / 标准 / 宽」档位。
 * 名字 + 输出格式这列（表头那只搜索框）没有顺序概念，同样可以拖右缘：不拖时
 * 宽度 = 0，表示「自适应吃满」；拖窄之后多出的空间留在它与数值列组之间，
 * 再拖宽可以原路吃回来，右键「恢复自适应」直接清回 0。
 */
/* global window */
import { storage as envStorage } from './node-env'

const STORAGE_KEY = 'compTree.columns'

export const CT_COLUMNS = [
  // 下限按「还能读出内容」的最小值给：尺寸列 36px 够放「1920…」的省略形式，
  // 帧率列 32px 够放两位数，状态列 56px 够放图标 + 两三个字。
  // 下限设得离默认宽度太近时，指针走 40px 列只动 16px，手感像「压不动」。
  // narrow / wide 是右键菜单的离散档位（最后一列右缘没有把手，靠它改宽度）
  { key: 'size', labelKey: 'compColSize', sortKey: 'width', width: 64, min: 36, max: 180, narrow: 44, wide: 100 },
  { key: 'fps', labelKey: 'compColFps', sortKey: 'fps', width: 64, min: 32, max: 180, narrow: 40, wide: 96 },
  { key: 'state', labelKey: 'compColState', sortKey: '', width: 112, min: 56, max: 240, narrow: 72, wide: 176 }
]

const BY_KEY = {}
CT_COLUMNS.forEach(function (col) { BY_KEY[col.key] = col })

export const CT_DEFAULT_ORDER = CT_COLUMNS.map(function (col) { return col.key })

/**
 * 名字列（表头搜索框那一列）的宽度：0 = 自适应剩余空间。
 * 它不在 CT_COLUMNS 里，因为「列顺序 / 排序」对它没有意义，只有宽度。
 * 下限 176 = 图标 16 + 间隔 6 + A/G/W 三个按钮约 66 + 内边距 8 + 名字还剩三四个字；
 * 再窄下去名称就只剩一个字，行内看不出是哪个合成了。
 */
export const CT_NAME_KEY = 'name'
export const CT_NAME_MIN = 176
/** 兜底上限：正常拖动时按「容器宽度 - 其它列」实时算上限，这个值只在读存储时防炸 */
export const CT_NAME_MAX = 1200

export function clampNameWidth (value, max) {
  // 只有「真的没有值」或恰好 0 才等于自适应；负数（拖动推过头）要钳到下限，
  // 否则一路左拖会被误判成「清空宽度」，列突然弹回吃满，手感像失灵。
  if (value === null || value === undefined || value === '') return 0
  const n = Number(value)
  if (!isFinite(n)) return 0
  if (n === 0) return 0
  const cap = Number(max) > 0 ? Math.min(CT_NAME_MAX, Number(max)) : CT_NAME_MAX
  const hi = Math.max(CT_NAME_MIN, cap)
  return Math.max(CT_NAME_MIN, Math.min(hi, Math.round(n)))
}

export function columnOf (key) {
  return BY_KEY[key] || null
}

/** 右键菜单的「窄 / 标准 / 宽」三档；档位值必须落在 [min, max] 内 */
export function presetColumnWidth (key, preset) {
  const col = BY_KEY[key]
  if (!col) return 0
  if (preset === 'narrow') return col.narrow
  if (preset === 'wide') return col.wide
  return col.width
}

/** 列宽钳制：非法值回退到出厂宽度，避免读坏数据把界面压成 0 */
export function clampColumnWidth (key, value) {
  const col = BY_KEY[key]
  if (!col) return 0
  const n = Number(value)
  // null / undefined / '' / 0 / NaN 都是「没有有效宽度」，回退出厂值；
  // 否则 Number(null)===0 会被钳到 min，首次进入（无存储记录）时列宽全变最窄。
  if (!value || !isFinite(n)) return col.width
  return Math.max(col.min, Math.min(col.max, Math.round(n)))
}

/** 顺序 + 宽度归一化：剔除未知列、补齐缺失列、钳制每个宽度 */
export function normalizeColumnLayout (raw) {
  const order = []
  const seen = {}
  const wanted = (raw && Array.isArray(raw.order)) ? raw.order : []
  wanted.forEach(function (key) {
    if (BY_KEY[key] && !seen[key]) {
      order.push(key)
      seen[key] = true
    }
  })
  CT_DEFAULT_ORDER.forEach(function (key) {
    if (!seen[key]) {
      order.push(key)
      seen[key] = true
    }
  })
  const widths = {}
  CT_DEFAULT_ORDER.forEach(function (key) {
    widths[key] = clampColumnWidth(key, raw && raw.widths && raw.widths[key])
  })
  widths[CT_NAME_KEY] = clampNameWidth(raw && raw.widths && raw.widths[CT_NAME_KEY])
  return { order: order, widths: widths }
}

function readStorage () {
  if (typeof window === 'undefined') return null
  // store/index.js 会把它用到的 storage 挂到 window；CEP 桥与 mock 桥同构
  if (window.storage && typeof window.storage.getItem === 'function') return window.storage
  try { return envStorage } catch (e) { return null }
}

export function loadColumnLayout () {
  try {
    const s = readStorage()
    const raw = s && s.getItem(STORAGE_KEY)
    return raw ? normalizeColumnLayout(JSON.parse(raw)) : normalizeColumnLayout(null)
  } catch (e) {
    return normalizeColumnLayout(null)
  }
}

export function saveColumnLayout (layout) {
  try {
    const s = readStorage()
    if (s) s.setItem(STORAGE_KEY, JSON.stringify(normalizeColumnLayout(layout)))
  } catch (e) { /* 存储不可用时内存态仍有效 */ }
}
