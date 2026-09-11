/**
 * 主题管理器（ui-next）
 *
 * 与旧实现的区别：
 *   1. 统一从这里读写，Home.vue 不再各自持有 theme 状态
 *   2. 支持 'system' 三态：未显式选择时跟随系统 prefers-color-scheme
 *   3. init() 必须在 Vue 挂载前调用，消除首帧主题闪烁
 *   4. 走 node-env 的 storage 桥（preload 未提供 removeItem，故用哨兵值表达「跟随系统」）
 *
 * 存储键沿用 uiTheme，保证老用户已有选择不丢失。
 */

import { storage } from '../util/node-env'

const KEY = 'uiTheme'
const EVENT = 'is:theme-change'
const DARK_CLASS = 'is-theme-dark'
const LIGHT_CLASS = 'is-theme-light'

let current = 'dark'   // 解析后的实际主题
let mode = 'system'    // 用户选择：'light' | 'dark' | 'system'

function read () {
  try {
    const raw = storage.getItem(KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  } catch (e) { /* 桥未就绪时静默降级 */ }
  return 'system'
}

function write (value) {
  try {
    storage.setItem(KEY, value)
  } catch (e) { /* ignore */ }
}

function systemTheme () {
  try {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch (e) {
    return 'dark'
  }
}

function resolve (m) {
  return m === 'system' ? systemTheme() : m
}

/** 把主题类同时挂到 html 与 body，兼容 append-to-body 的浮层 */
function paint (theme) {
  const add = theme === 'light' ? LIGHT_CLASS : DARK_CLASS
  const remove = theme === 'light' ? DARK_CLASS : LIGHT_CLASS
  const html = document.documentElement
  const body = document.body
  if (html) {
    html.classList.remove(DARK_CLASS, LIGHT_CLASS)
    html.classList.add(add)
    html.style.colorScheme = theme
  }
  if (body) {
    body.classList.remove(DARK_CLASS, LIGHT_CLASS)
    body.classList.add(add)
  }
  current = theme
}

function emit () {
  const detail = { theme: current, mode: mode }
  window.dispatchEvent(new CustomEvent(EVENT, { detail }))
  listeners.slice().forEach(function (cb) {
    try { cb(detail) } catch (e) { console.error(e) }
  })
}

const listeners = []

const ThemeManager = {
  /** 尽早调用：解析并应用主题，同时开始监听系统偏好 */
  init () {
    mode = read()
    current = resolve(mode)
    paint(current)
    watchSystem()
    return current
  },

  get () { return current },
  getMode () { return mode },
  isDark () { return current === 'dark' },
  isFollowingSystem () { return mode === 'system' },

  /** 显式设定 light / dark */
  set (theme) {
    if (theme !== 'light' && theme !== 'dark') return current
    mode = theme
    write(mode)
    paint(theme)
    emit()
    return current
  },

  toggle () {
    return this.set(current === 'dark' ? 'light' : 'dark')
  },

  /** 回到跟随系统 */
  followSystem () {
    mode = 'system'
    write(mode)
    paint(resolve(mode))
    emit()
  },

  onChange (cb) {
    listeners.push(cb)
    return function () {
      const i = listeners.indexOf(cb)
      if (i > -1) listeners.splice(i, 1)
    }
  }
}

function watchSystem () {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = function () {
      if (mode !== 'system') return
      paint(resolve(mode))
      emit()
    }
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler)
    } else if (typeof mq.addListener === 'function') {
      mq.addListener(handler)
    }
  } catch (e) { /* matchMedia 不可用时忽略 */ }
}

export default ThemeManager
export { ThemeManager, EVENT as THEME_EVENT }
