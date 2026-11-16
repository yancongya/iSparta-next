/**
 * v-tip —— 自定义提示气泡
 *
 * 替代原生 title：原生提示样式不可控、延迟固定、也不能带颜色。
 * 用法：v-tip="'要显示的文案'"，或 v-tip="{ text, placement }"
 *
 * 单例复用同一个 DOM 节点，避免每个元素都挂一个浮层。
 */

const NS = 'is-tip'
const SHOW_DELAY = 140 // 显示延迟：原来 260ms 偏慢，掠过时几乎看不到（issue #2）
const HIDE_GRACE = 200 // 隐藏宽限期：移开后给一点时间读完，快速掠过也不会满屏闪
let host = null
let timer = null      // 显示延迟计时器
let hideTimer = null  // 隐藏宽限计时器

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
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  if (host) host.classList.remove(NS + '--show')
}

// 移开后延迟隐藏，宽限期内重新悬停会取消（见 show 里的 hide()）
function scheduleHide () {
  if (timer) { clearTimeout(timer); timer = null }
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  hideTimer = setTimeout(function () {
    hideTimer = null
    if (host) host.classList.remove(NS + '--show')
  }, HIDE_GRACE)
}

function show (el, binding) {
  const opts = normalize(binding.value)
  if (!opts || !opts.text) return
  // 清掉待隐藏：宽限期内移回同一控件不闪断
  hide()
  // 短延迟：掠过多个控件时不至于满屏闪提示
  timer = setTimeout(function () {
    timer = null
    place(el, opts)
  }, SHOW_DELAY)
}

export default {
  bind (el, binding) {
    el._tip = {
      // 存引用而非闭包捕获初次 binding：文案会随任务状态/产物大小变化
      binding: binding,
      enter: () => show(el, el._tip.binding),
      leave: scheduleHide,
      text: normalize(binding.value)
    }
    el.addEventListener('mouseenter', el._tip.enter)
    el.addEventListener('mouseleave', el._tip.leave)
    el.addEventListener('focusin', el._tip.enter)
    el.addEventListener('focusout', el._tip.leave)
  },
  componentUpdated (el, binding) {
    if (!el._tip) return
    const next = normalize(binding.value)
    const prev = el._tip.text
    el._tip.binding = binding
    el._tip.text = next
    // 只在文案真的变了、且气泡正显示时才重算。
    // 原来任何组件刷新都无条件 hide()，导致悬停读一半提示突然消失（issue #2）。
    const changed = (prev && prev.text) !== (next && next.text)
    if (changed && host && host.classList.contains(NS + '--show')) {
      show(el, binding)
    }
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
