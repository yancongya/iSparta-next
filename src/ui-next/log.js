/**
 * 全局运行日志（渲染层）
 * - 桌面兼容：info/success/warn/error(msg, detail) 不变
 * - 对齐 cep-playground log-core：可选 category、query、subscribe、exportText
 * - 禁止改 IsLogPanel UI；本文件只做兼容层
 * - CEP：localStorage 关面板会丢 → 经 node-env storage 落文件
 */

import Vue from 'vue'

const MAX = 400
const LS_KEY = 'iSparta-logs'
const LEVELS = ['debug', 'info', 'ok', 'warn', 'error']

function getStorage () {
  try {
    return require('../util/node-env').storage
  } catch (e) {
    return null
  }
}

const state = Vue.observable({
  entries: [],
  unread: 0,
  seq: 0
})

const listeners = []

function emit () {
  const snap = state.entries.slice()
  for (let i = 0; i < listeners.length; i++) {
    try { listeners[i](snap) } catch (e) { /* listener error must not break log */ }
  }
}

function persist () {
  try {
    const st = getStorage()
    if (st && st.setItem) {
      st.setItem(LS_KEY, JSON.stringify(state.entries.slice(-MAX)))
    }
  } catch (e) { /* storage failure must not break host action */ }
}

function restore () {
  try {
    const st = getStorage()
    if (!st || !st.getItem) return
    const raw = st.getItem(LS_KEY)
    if (!raw) return
    const arr = JSON.parse(raw)
    if (arr && arr.length) {
      state.entries = arr.slice(-MAX)
      state.seq = Number(state.entries[state.entries.length - 1].id) || arr.length
    }
  } catch (e) { /* corrupt storage recovery: start empty */ }
}

restore()

function now () {
  var d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0')
}

function safeDetail (value) {
  if (value == null) return ''
  if (value instanceof Error) {
    return value.name + ': ' + value.message + (value.stack ? '\n' + value.stack : '')
  }
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch (e) {
    return String(value)
  }
}

/**
 * @param {string} level
 * @param {string} msg
 * @param {string} [detail]
 * @param {string} [category]  log-core 分类（bridge/import/fs…）；桌面旧调用可省略
 */
function push (level, msg, detail, category) {
  state.seq += 1
  state.entries.push({
    id: state.seq,
    t: now(),
    ts: Date.now(),
    level: level,
    category: category || 'General',
    msg: String(msg == null ? '' : msg),
    detail: safeDetail(detail)
  })
  if (state.entries.length > MAX) {
    state.entries.splice(0, state.entries.length - MAX)
  }
  if (level === 'warn' || level === 'error') { state.unread += 1 }
  persist()
  emit()
}

/** log-core 风格：core.info('bridge', 'msg', detail) */
function coreAdd (level, category, message, detail) {
  return push(level, message, detail, category)
}

const log = {
  state: state,

  // —— 桌面兼容（勿改调用方）——
  info: function (msg, detail, category) { push('info', msg, detail, category) },
  success: function (msg, detail, category) { push('ok', msg, detail, category) },
  warn: function (msg, detail, category) { push('warn', msg, detail, category) },
  error: function (msg, detail, category) { push('error', msg, detail, category) },
  debug: function (msg, detail, category) { push('debug', msg, detail, category) },

  markRead: function () { state.unread = 0 },
  clear: function () {
    state.entries.splice(0, state.entries.length)
    state.unread = 0
    persist()
    emit()
  },
  toText: function () {
    return state.entries.map(function (e) {
      return '[' + e.t + '] [' + String(e.level).toUpperCase() + '] [' + (e.category || 'General') + '] ' +
        e.msg + (e.detail ? ' — ' + e.detail : '')
    }).join('\n')
  },

  // —— log-core 兼容（注入，不改 UI）——
  core: {
    info: function (category, message, detail) { return coreAdd('info', category, message, detail) },
    warn: function (category, message, detail) { return coreAdd('warn', category, message, detail) },
    error: function (category, message, detail) { return coreAdd('error', category, message, detail) },
    debug: function (category, message, detail) { return coreAdd('debug', category, message, detail) },
    getItems: function () { return state.entries.slice() },
    /** filter: { text, levels: ['warn','error'], categories: ['bridge'] } */
    query: function (filter) {
      var f = filter || {}
      var text = String(f.text || '').toLowerCase()
      var levels = f.levels || []
      var cats = f.categories || []
      return state.entries.filter(function (item) {
        if (levels.length && levels.indexOf(item.level) < 0) return false
        if (cats.length && cats.indexOf(item.category) < 0) return false
        if (!text) return true
        return (item.category + ' ' + item.msg + ' ' + item.detail).toLowerCase().indexOf(text) >= 0
      })
    },
    subscribe: function (listener) {
      listeners.push(listener)
      listener(state.entries.slice())
      return function () {
        var i = listeners.indexOf(listener)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
    exportText: function () { return log.toText() },
    LEVELS: LEVELS
  }
}

// 启动痕迹（便于 CEP 排查「日志空白 / 按钮无响应」）
push('info', 'log ready', (typeof location !== 'undefined' ? String(location.href) : ''), 'bridge')

export default log
