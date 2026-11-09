/**
 * 输出格式的唯一真相源。
 *
 * 默认值本来就存在 globalSetting.options.outputFormat：桌面新任务（store
 * ITEMS_ADD）、拖拽导入（components/drag/file.js）、CEP 合成任务
 * （cep/comp-source.js toCompItem）都克隆它，所以这里不另建存储键，
 * 只提供「常量 / 归一化 / 读默认值 / 失效缓存」四个入口。
 *
 * 缓存是必要的：合成树每个格式图标都会问一次默认值，逐次 JSON.parse
 * globalSetting 会在几十行合成时反复解析同一份配置。设置面板保存后
 * 调用 invalidateDefaultOutputFormats() 即可让下一帧读到新值。
 */
/* global window */
import { storage as envStorage } from './node-env'

export const OUTPUT_FORMATS = ['APNG', 'GIF', 'WEBP']

/** 固定 APNG → GIF → WEBP 顺序、剔除非法值；全空回退出厂默认 */
export function normalizeOutputFormats (value) {
  if (!Array.isArray(value)) return OUTPUT_FORMATS.slice()
  const next = OUTPUT_FORMATS.filter(function (key) {
    return value.indexOf(key) >= 0
  })
  // 全不选会让新任务永远无法开始（canStart 要求至少一种格式）
  return next.length ? next : OUTPUT_FORMATS.slice()
}

function readStorage () {
  if (typeof window === 'undefined') return null
  // store/index.js 会把它用到的 storage 挂到 window；独立设置窗也走同一实例
  if (window.storage && typeof window.storage.getItem === 'function') return window.storage
  try { return envStorage } catch (e) { return null }
}

let cachedDefault = null

/** 当前全局默认勾选的输出格式（返回副本，调用方可安全改动） */
export function defaultOutputFormats () {
  if (cachedDefault) return cachedDefault.slice()
  try {
    const s = readStorage()
    const raw = s && s.getItem('globalSetting')
    if (raw) {
      const gs = JSON.parse(raw)
      cachedDefault = normalizeOutputFormats(gs && gs.options && gs.options.outputFormat)
    } else {
      cachedDefault = OUTPUT_FORMATS.slice()
    }
  } catch (e) {
    cachedDefault = OUTPUT_FORMATS.slice()
  }
  return cachedDefault.slice()
}

/** 默认设置保存后调用：清掉缓存，让合成树图标初值跟上新默认 */
export function invalidateDefaultOutputFormats () {
  cachedDefault = null
}
