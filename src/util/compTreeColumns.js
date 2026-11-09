/**
 * CEP 合成树列布局的唯一真相源。
 *
 * 名字 + 输出格式是同一个 pinned 首列（表头就是搜索栏），勾选列与齿轮列是
 * 固定控制列 —— 这三者都不参与列宽配置与列顺序重排。名字列宽度由
 * flex: 1 1 0 自动吃掉剩余空间，其他列变宽时它自然收窄，无需单独存宽度。
 *
 * 可配置列只有 size / fps / state。列宽与顺序持久化到 storage 的
 * `compTree.columns`（与 globalSetting 同一套文件存储，CEP 真机 / 浏览器 mock 同构）。
 */
/* global window */
import { storage as envStorage } from './node-env'

const STORAGE_KEY = 'compTree.columns'

export const CT_COLUMNS = [
  { key: 'size', labelKey: 'compColSize', sortKey: 'width', width: 64, min: 48, max: 180 },
  { key: 'fps', labelKey: 'compColFps', sortKey: 'fps', width: 64, min: 48, max: 180 },
  // 状态列有三段内容（图标 / 文案 / 产物大小），下限按不挤掉状态文案来定
  { key: 'state', labelKey: 'compColState', sortKey: '', width: 112, min: 84, max: 240 }
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
  if (!isFinite(n)) return col.width
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
  return { order: order, widths: widths }
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
