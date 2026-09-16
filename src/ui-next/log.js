/**
 * 全局运行日志（渲染层）
 *
 * 与 notice 的区别：notice 是「此刻要打断用户」的一次性气泡，log 是「事后要回看」的
 * 完整轨迹。两者互补：notice 的 warning/error 会镜像进这里，避免用户没看见就消失了。
 *
 * 环形缓冲：只保留最近 MAX 条。转换一次可能产生几十条阈值重试，不限制会无界增长，
 * 而 Vue.observable 的数组越长，面板重渲染与内存占用越糟。
 */

import Vue from 'vue'

const MAX = 400

const state = Vue.observable({
  entries: [],
  // 面板未打开时累计的新条目，用于工具条按钮上的小红点
  unread: 0,
  seq: 0
})

function now () {
  var d = new Date()
  return String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0')
}

function push (level, msg, detail) {
  state.seq += 1
  state.entries.push({ id: state.seq, t: now(), level: level, msg: String(msg == null ? '' : msg), detail: detail ? String(detail) : '' })
  if (state.entries.length > MAX) {
    state.entries.splice(0, state.entries.length - MAX)
  }
  if (level === 'warn' || level === 'error') { state.unread += 1 }
}

export default {
  state: state,
  info: function (msg, detail) { push('info', msg, detail) },
  success: function (msg, detail) { push('ok', msg, detail) },
  warn: function (msg, detail) { push('warn', msg, detail) },
  error: function (msg, detail) { push('error', msg, detail) },
  /** 面板打开时调用：清未读计数 */
  markRead: function () { state.unread = 0 },
  clear: function () {
    state.entries.splice(0, state.entries.length)
    state.unread = 0
  },
  /** 导出为纯文本，便于贴到 Issue 里排查 */
  toText: function () {
    return state.entries.map(function (e) {
      return '[' + e.t + '] [' + e.level.toUpperCase() + '] ' + e.msg + (e.detail ? ' — ' + e.detail : '')
    }).join('\n')
  }
}
