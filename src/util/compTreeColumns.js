/**
 * CEP 合成树列布局的唯一真相源。
 *
 * 名字 + 输出格式是同一个 pinned 首列（表头就是搜索栏），勾选列与齿轮列是
 * 固定控制列 —— 这三者**不参与列顺序重排**。但 pinned 首列的**宽度可以拖**
 * （右侧有和普通列一样的把手）：未设置宽度时 `flex:1 1 0` 自动吃掉剩余空间，
 * 拖过之后存显式宽度（`name`），双击把手恢复自适应。
 *
 * 可配置列只有 size / fps / state。列宽、顺序与 pinned 列显式宽度持久化到
 * storage 的 `compTree.columns`（与 globalSetting 同一套文件存储，CEP 真机 / 浏览器 mock 同构）。
 */
/* global window */
import { storage as envStorage } from './node-env'

const STORAGE_KEY = 'compTree.columns'

/** pinned 首列（名字 + 输出格式）：不可重排，但可拖宽度，null = 自适应剩余空间 */
export const CT_PINNED_KEY = 'name'
export const CT_PINNED_MIN = 180
export const CT_PINNED_MAX = 2000

export const CT_COLUMNS = [
  // 下限按「还能读出内容」的最小值给：尺寸列 36px 够放「1920…」的省略形式，
  // 帧率列 32px 够放两位数，状态列 56px 够放图标 + 两三个字。
  // 之前 48 / 48 / 84 的下限太宽，拖窄时指针走了 40px 列只动 16px，
  // 手感像「压不动」，只剩「拖宽」有反应。
  { key: 'size', labelKey: 'compColSize', sortKey: 'width', width: 64, min: 36, max: 180 },
  { key: 'fps', labelKey: 'compColFps', sortKey: 'fps', width: 64, min: 32, max: 180 },
  { key: 'state', labelKey: 'compColState', sortKey: '', width: 112, min: 56, max: 240 }
]

const BY_KEY = {}
CT_COLUMNS.forEach(function (col) { BY_KEY[col.key] = col })

export const CT_DEFAULT_ORDER = CT_COLUMNS.map(function (col) { return col.key })

export function columnOf (key) {
  return BY_KEY[key] || null
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

/**
 * pinned 首列宽度钳制。`null` 表示自适应（不存宽度），数值钳到 [MIN, max]；
 * max 由调用方按「当前可视宽度 - 其它列」算，窗口变窄时不得超过可用空间。
 */
export function clampPinnedWidth (value, max) {
  if (value === null || value === undefined || value === '' || value === false) return null
  const n = Number(value)
  if (!isFinite(n) || n <= 0) return null
  const hi = Math.min(CT_PINNED_MAX, Math.max(CT_PINNED_MIN, Math.round(Number(max) || CT_PINNED_MAX)))
  return Math.max(CT_PINNED_MIN, Math.min(hi, Math.round(n)))
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
  return { order: order, widths: widths, name: clampPinnedWidth(raw && raw.name) }
}

/** 把 fromKey 插到 targetKey 的前/后；无效目标时回到出厂顺序 */
export function moveColumn (order, fromKey, targetKey, side) {
  if (!BY_KEY[fromKey] || fromKey === targetKey) {
    return normalizeColumnLayout({ order: order }).order
  }
  const next = normalizeColumnLayout({ order: order }).order
  const from = next.indexOf(fromKey)
  if (from < 0) return next
  next.splice(from, 1)
  let at = next.indexOf(targetKey)
  if (at < 0) at = side === 'after' ? next.length : 0
  else if (side === 'after') at += 1
  next.splice(at, 0, fromKey)
  return next
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
