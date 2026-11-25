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
 * 需要在界面里挂一次 <is-notice-host>（见 Home.vue）承载短提示；
 * confirm 询问是独立的模态弹窗 <is-confirm-dialog>，不进 toast 队列（见文件末尾 confirmState）。
 */

import Vue from 'vue'
import appLog from './log'

const state = Vue.observable({ items: [] })

const ICONS = {
  info: 'info',
  // 用已注册图标名（原 check-circle / x-circle 未在 icons.js 注册，图标位一直是空白）
  success: 'check',
  warning: 'alert',
  error: 'close'
  // confirm 不再走 toast：它是独立模态弹窗，图标由弹窗自己渲染
}

// toast 是「一行长条」短提示：过长的错误堆栈/路径会撑爆胶囊布局，源头统一截断。
// 询问确认走模态弹窗、文本不截断，不受此上限约束。
const MAX_TEXT = 180
function clampText (value, limit) {
  const s = String(value == null ? '' : value)
  return s.length > limit ? s.slice(0, limit) + '…' : s
}

const DEFAULT_DURATION = {
  info: 3200,
  success: 3200,
  // 告警/错误文案多为两行（标题 + 原因），原来 4.6s / 6s 偏短，
  // 用户来不及读完就消失（issue #2）。延长到 8s / 10s；悬停仍可冻结倒计时。
  warning: 8000,
  error: 10000
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
    title: clampText(opts.title || '', 80),
    text: clampText(opts.text || opts.message || '', MAX_TEXT),
    // 0 表示不自动关闭
    duration: opts.duration === undefined ? (DEFAULT_DURATION[type] || 0) : opts.duration,
    closable: opts.closable !== false,
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
  // 延迟必须取 entry.remaining（剩余时长），不是 item.remaining。
  // toast 对象上没有 remaining 字段，误用会得到 undefined → setTimeout 按 0ms 处理，
  // 导致每一条 toast 在 push 后下一个事件循环就被 close，肉眼永远看不到（延续多版的根因）。
  entry.handle = setTimeout(() => close(item.id), entry.remaining)
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

  /**
   * Promise 化的询问确认，替代 window.confirm。
   * 走独立的模态弹窗（<is-confirm-dialog> 读 confirmState），不进 toast 队列——
   * 阻断确认需要遮罩 + 居中面板 + 完整多行路径，长条 toast 承载不了。
   * 同一时刻只允许一个询问：新 confirm 覆盖旧的（旧 Promise 以 false 收尾，安全方向）。
   *
   * 三按钮形态（用于「破坏性操作」类问题，如覆盖源文件）：
   *   cancelText  → 取消，resolve(false)
   *   altText     → 破坏性备选（弹窗里渲染成 danger 描边），resolve(altValue)
   *   confirmText → 推荐主操作，resolve(true)
   * 只给 confirmText/cancelText 时退化为经典的是/否两按钮。
   */
  confirm (options) {
    const opts = typeof options === 'string' ? { title: options } : (options || {})
    // 若上一个 confirm 还没答，先以「取消」收尾，避免悬挂 Promise
    if (confirmState.resolve) confirmState.resolve(false)
    return new Promise((resolve) => {
      confirmState.resolve = resolve
      confirmState.title = opts.title || ''
      confirmState.text = opts.text || opts.message || ''
      confirmState.confirmText = opts.confirmText || ''
      confirmState.cancelText = opts.cancelText || ''
      confirmState.altText = opts.altText || ''
      confirmState.altValue = opts.altValue === undefined ? true : opts.altValue
      confirmState.visible = true
    })
  },

  close
}

/**
 * 询问弹窗的响应式状态（Vue.observable 在 main 里已随模块初始化）。
 * 独立导出供 <is-confirm-dialog> 渲染；答案通过 confirmState.resolve 回填 Promise。
 */
export const confirmState = Vue.observable({
  visible: false,
  title: '',
  text: '',
  confirmText: '',
  cancelText: '',
  // 破坏性备选按钮（可选）：altText 有值才渲染，点了 resolve(altValue)
  altText: '',
  altValue: true,
  resolve: null
})

/** 弹窗按钮/关闭回调：统一走这里，保证 Promise 只 settle 一次 */
export function answerConfirm (value) {
  const resolve = confirmState.resolve
  if (!resolve) return
  confirmState.resolve = null
  confirmState.visible = false
  // 不做 Boolean 归一：备选按钮要回传自己的标识（如 'overwrite'），
  // 调用方按标识区分「直接覆盖」与「加后缀另存」两种不同后果。
  resolve(value === undefined ? false : value)
}

export default notice
export { notice, clear }
