/**
 * v-tip —— 自定义提示气泡
 *
 * 替代原生 title：原生提示样式不可控、延迟固定、也不能带颜色。
 * 用法：v-tip="'要显示的文案'"，或 v-tip="{ text, placement }"
 *
 * 单例复用同一个 DOM 节点，避免每个元素都挂一个浮层。
 */

const NS = 'is-tip'
let host = null
let timer = null

function ensureHost () {
  if (host && document.body.contains(host)) return host
  host = document.createElement('div')
  host.className = NS
  host.setAttribute('role', 'tooltip')
  document.body.appendChild(host)
  return host
}

function normalize (value) {
  if (!value) return null
  if (typeof value === 'string') return { text: value, placement: 'top' }
  return { text: value.text || '', placement: value.placement || 'top' }
}

function place (el, opts) {
  const tip = ensureHost()
  tip.textContent = opts.text
  tip.classList.remove(NS + '--show')
  // 先量尺寸再定位
  const r = el.getBoundingClientRect()
  const tr = tip.getBoundingClientRect()
  const gap = 8
  const pad = 8
  let top
  if (opts.placement === 'bottom' || r.top - tr.height - gap < pad) {
    top = Math.min(r.bottom + gap, window.innerHeight - tr.height - pad)
  } else {
    top = r.top - tr.height - gap
  }
  const left = Math.max(pad, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - pad))
  tip.style.top = Math.round(top) + 'px'
  tip.style.left = Math.round(left) + 'px'
  tip.classList.add(NS + '--show')
}

function hide () {
  if (timer) { clearTimeout(timer); timer = null }
  if (host) host.classList.remove(NS + '--show')
}

function show (el, binding) {
  const opts = normalize(binding.value)
  if (!opts || !opts.text) return
  hide()
  // 短延迟：掠过多个控件时不至于满屏闪提示
  timer = setTimeout(function () {
    timer = null
    place(el, opts)
  }, 260)
}

export default {
  bind (el, binding) {
    el._tip = {
      enter: () => show(el, binding),
      leave: hide
    }
    el.addEventListener('mouseenter', el._tip.enter)
    el.addEventListener('mouseleave', el._tip.leave)
    el.addEventListener('focusin', el._tip.enter)
    el.addEventListener('focusout', el._tip.leave)
  },
  componentUpdated (el, binding) {
    // 文案变化时若正显示则重算位置
    if (host && host.classList.contains(NS + '--show')) hide()
  },
  unbind (el) {
    if (!el._tip) return
    el.removeEventListener('mouseenter', el._tip.enter)
    el.removeEventListener('mouseleave', el._tip.leave)
    el.removeEventListener('focusin', el._tip.enter)
    el.removeEventListener('focusout', el._tip.leave)
    delete el._tip
    hide()
  }
}

export { hide as hideTip }
