/**
 * 本地调试日志开关的 UI 反馈（两处开关共用，避免重复造轮子）。
 * 纯逻辑 + DOM 复制：不依赖 vue-i18n，文案通过 translate(key, vars) 注入。
 */

/** 把控制器状态映射成状态文案 key 与 UI 状态 */
export function statusKey (state) {
  const s = (state && state.status) || 'off'
  if (s === 'starting') return 'debugStatusStarting'
  if (s === 'ready') return 'debugStatusReady'
  if (s === 'unavailable') return 'debugStatusUnavailable'
  if (s === 'error') return state.errorCode === 'EADDRINUSE' ? 'debugPortBusy' : 'debugStatusError'
  return 'debugStatusOff'
}

/** hover 文案：状态 + 用途 + 地址（未就绪时用占位） */
export function connectionHint (state, translate) {
  const statusText = translate(statusKey(state))
  const url = (state && state.url) || 'http://127.0.0.1:48764/logs'
  return statusText + '\n' + translate('debugHint', { url: url })
}

/** 切换成功/失败后的连接信息文案（用于自动复制与 toast） */
export function connectionInfo (state, translate) {
  const statusText = translate(statusKey(state))
  const url = (state && state.url) || ''
  return translate('debugToggle') + '：' + statusText + (url ? '\n' + translate('debugHint', { url: url }) : '')
}

/** 复制文本（navigator.clipboard + execCommand 兜底），返回 Promise<boolean> */
export function copyText (text) {
  if (!text) return Promise.resolve(false)
  const fallback = function () {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch (e) { ok = false }
      document.body.removeChild(ta)
      return ok
    } catch (e) { return false }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () { return true }).catch(function () { return fallback() })
  }
  return Promise.resolve(fallback())
}
