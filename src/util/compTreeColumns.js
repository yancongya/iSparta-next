/**
 * CEP 合成树列布局的唯一真相源。
 *
 * 只有三列可配置：尺寸 / 帧率 / 运行状态。它们的宽度与顺序持久化在 storage 的
 * `compTree.columns`（与 globalSetting 同一套文件存储，CEP 真机 / 浏览器 mock 同构）。
 *
 * 交互刻意做减法：表头只保留「点击排序 + 拖右缘改宽」两种手势，列顺序走表头
 * 右键菜单（左移 / 右移）。名字 + 输出格式这列是表头那只搜索框，宽度永远
 * 自适应剩余空间，不存宽度、也不可拖 —— 少一份状态就少一类「拖起来不对劲」。
 */
/* global window */
import { storage as envStorage } from './node-env'

const STORAGE_KEY = 'compTree.columns'

export const CT_COLUMNS = [
  // 下限按「还能读出内容」的最小值给：尺寸列 36px 够放「1920…」的省略形式，
  // 帧率列 32px 够放两位数，状态列 56px 够放图标 + 两三个字。
  // 下限设得离默认宽度太近时，指针走 40px 列只动 16px，手感像「压不动」。
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
