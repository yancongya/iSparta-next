/**
 * 通知系统（ui-next）
 *
 * 取代原生 alert() 与「只在列表角标显示一行小字」的反馈方式。
 * 用法：
 *   import notice from '@/ui-next/notice'
 *   notice.success('生成完成', '共 3 个项目')
 *   notice.error('解析失败', err.message)
 *   const ok = await notice.confirm({ title: '删除全部？', message: '...' })
 *
 * 需要在界面里挂一次 <is-notice-host>（见 Home.vue）。
 */

import Vue from 'vue'
import appLog from './log'

const state = Vue.observable({ items: [] })

const ICONS = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert',
  error: 'x-circle',
  confirm: 'question'
}

const DEFAULT_DURATION = {
  info: 3200,
  success: 3200,
  warning: 4600,
  error: 6000,
  confirm: 0
}

let seq = 0
// id -> { handle, startedAt, remaining }
const timers = {}

function normalizeType (type) {
  if (type === 'danger') return 'error'
  return ICONS[type] ? type : 'info'
}

function push (options) {
  const opts = typeof options === 'string' ? { title: options } : (options || {})
  const type = normalizeType(opts.type || 'info')
  const id = ++seq
  const item = {
    id,
    type,
    icon: opts.icon || ICONS[type],
    title: opts.title || '',
    text: opts.text || opts.message || '',
    // 0 表示不自动关闭
    duration: opts.duration === undefined ? (DEFAULT_DURATION[type] || 0) : opts.duration,
    closable: opts.closable !== false,
    action: opts.action || null,
    // 悬停冻结标记，需在创建时声明才能被 Vue 2 观测
    paused: false
  }
  state.items.push(item)
  schedule(item)
  // 气泡会超时消失，warn / error 额外落一份到全局运行日志，事后可回看与复制
  if (type === 'warning' || type === 'error') {
    appLog[type === 'error' ? 'error' : 'warn'](item.title, item.text)
  }
  return id
}

function schedule (item) {
  if (!item.duration) return
  const entry = { startedAt: Date.now(), remaining: item.duration, handle: null }
  entry.handle = setTimeout(() => close(item.id), item.remaining)
  timers[item.id] = entry
}

/** 悬停冻结倒计时，避免长文案来不及读 */
function pause (id) {
  const entry = timers[id]
  if (!entry || !entry.handle) return
  clearTimeout(entry.handle)
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startedAt))
  entry.handle = null
}

/** 移出后按剩余时间继续 */
function resume (id) {
  const entry = timers[id]
  if (!entry || entry.handle) return
  entry.startedAt = Date.now()
  entry.handle = setTimeout(() => close(id), entry.remaining)
}

function close (id) {
  const entry = timers[id]
  if (entry) {
    if (entry.handle) clearTimeout(entry.handle)
    delete timers[id]
  }
  const i = state.items.findIndex(n => n.id === id)
  if (i > -1) state.items.splice(i, 1)
}

function clear () {
  state.items.slice().forEach(n => close(n.id))
}

const notice = {
  state,

  show: push,

  pause,
  resume,

  info (title, extra) {
    return push(Object.assign({ type: 'info', title }, typeof extra === 'string' ? { text: extra } : extra))
  },
  success (title, extra) {
    return push(Object.assign({ type: 'success', title }, typeof extra === 'string' ? { text: extra } : extra))
  },
  warning (title, extra) {
    return push(Object.assign({ type: 'warning', title }, typeof extra === 'string' ? { text: extra } : extra))
  },
  error (title, extra) {
    return push(Object.assign({ type: 'error', title }, typeof extra === 'string' ? { text: extra } : extra))
  },

  /** 常驻进度通知：返回 update(text) / done() 句柄 */
  progress (title) {
    const id = push({ type: 'info', title, duration: 0, closable: false, icon: 'loader' })
    return {
      id,
      update (text) {
        const item = state.items.find(n => n.id === id)
        if (item) item.text = text || ''
      },
      done (nextType, nextTitle, nextText) {
        close(id)
        if (nextType) push({ type: nextType, title: nextTitle || title, text: nextText || '' })
      }
    }
  },

  /** Promise 化的确认框，替代 window.confirm */
  confirm (options) {
    const opts = typeof options === 'string' ? { title: options } : (options || {})
    return new Promise((resolve) => {
      let settled = false
      const finish = (val) => {
        if (settled) return
        settled = true
        close(id)
        resolve(val)
      }
      const id = push({
        type: 'confirm',
        title: opts.title || '',
        text: opts.text || opts.message || '',
        duration: 0,
        closable: opts.closable !== false,
        action: {
          confirmText: opts.confirmText,
          cancelText: opts.cancelText,
          onConfirm: () => finish(true),
          onCancel: () => finish(false)
        }
      })
    })
  },

  close
}

export default notice
export { notice, clear }
