/**
 * v-tip —— 自定义提示气泡
 *
 * 替代原生 title：原生提示样式不可控、延迟固定、也不能带颜色。
 * 用法：
 *   1) 纯文本：v-tip="'要显示的文案'"，或 v-tip="{ text, placement }"
 *   2) 结构化富气泡：v-tip="{ blocks: [...], placement }"
 *      blocks 为 block 描述数组（见 renderBlocks 支持的类型）。所有文本经
 *      textContent 写入、只按白名单建 DOM，调用方无需也不允许拼 HTML——从根上
 *      杜绝文件名/路径里的 <>& 注入。纯文本写法 40+ 处老调用保持零改动。
 *
 * 单例复用同一个 DOM 节点，避免每个元素都挂一个浮层。
 */

const NS = 'is-tip'
const SHOW_DELAY = 140 // 显示延迟：原来 260ms 偏慢，掠过时几乎看不到（issue #2）
const HIDE_GRACE = 200 // 隐藏宽限期：移开后给一点时间读完，快速掠过也不会满屏闪
let host = null
let timer = null      // 显示延迟计时器
let hideTimer = null  // 隐藏宽限计时器

// 语义色白名单：数据是外部传入的纯字符串，只有这里列出的值才允许变成 class，杜绝样式注入。
const TONES = ['accent', 'cool', 'ok', 'warn', 'bad']
function toneClass (tone) {
  return TONES.indexOf(tone) >= 0 ? ' is-tone-' + tone : ''
}

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
  if (typeof value === 'string') return { text: value, placement: 'top', blocks: null, sig: value }
  const blocks = Array.isArray(value.blocks) ? value.blocks : null
  return {
    text: value.text || '',
    placement: value.placement || 'top',
    blocks: blocks,
    // 富气泡的 blocks 每次渲染都是新对象，用内容序列化做稳定签名，避免误判「没变」或「一直变」
    sig: blocks ? JSON.stringify(blocks) : (value.text || '')
  }
}

/**
 * 按白名单把 blocks 渲染成 DOM。block 类型：
 *   { type:'head',   label, value, badge? }          主值区（大数值 + 标签 + 可选胶囊）
 *   { type:'gauge',  ratio, caption?, captionRight? } 对比条（ratio>1 超目标，红线满格；否则按比例填充）
 *   { type:'metrics',items:[{label,value}] }          指标卡（源/目标等）
 *   { type:'sub',    text }                          次级说明行（三级灰，无底色）
 *   { type:'basis',  text, tone?:'info' }           估算依据说明条（带前导图标的弱底色块）
 *   { type:'fmtlist',items:[{format,value,over,overText}] } 格式明细列表（格式胶囊 + 右对齐值 + 超目标标红）
 *   { type:'hint',   text }                          交互提示行（带 ↻ 图标的脚注）
 *   { type:'note',   text, tone?:'info'|'warn' }     说明行（info 蓝 / warn 黄底）
 *   { type:'foot',   text }                          免责声明（三级灰小字）
 *   { type:'kvlist', items:[{label,value,mono?}] }   键值对列表（标签列固定宽 + 值，值可等宽/换行）
 *   { type:'filelist', items:[{name,size,depthText}] } 文件列表（文件名 + 实测色深 + 大小，长名省略号）
 *   { type:'stderr', text }                          多行原文块（等宽字体 + 红底，保留全文换行）
 * 所有字符串一律 textContent 写入，绝不 innerHTML。
 */
function renderBlocks (tip, blocks) {
  tip.textContent = ''
  tip.classList.add(NS + '--rich')
  blocks.forEach(function (b) {
    if (!b || !b.type) return
    if (b.type === 'head') {
      var head = document.createElement('div')
      head.className = 'is-tip-r__head' + toneClass(b.tone)
      var label = document.createElement('div')
      label.className = 'is-tip-r__label'
      label.textContent = b.label || ''
      head.appendChild(label)
      var row = document.createElement('div')
      row.className = 'is-tip-r__headrow'
      var val = document.createElement('span')
      val.className = 'is-tip-r__value'
      val.textContent = b.value || ''
      row.appendChild(val)
      if (b.badge) {
        var badge = document.createElement('span')
        badge.className = 'is-tip-r__badge'
        badge.textContent = b.badge
        row.appendChild(badge)
      }
      head.appendChild(row)
      tip.appendChild(head)
    } else if (b.type === 'gauge') {
      var wrap = document.createElement('div')
      wrap.className = 'is-tip-r__gauge'
      var track = document.createElement('div')
      track.className = 'is-tip-r__track'
      var over = Number(b.ratio) > 1
      var fill = document.createElement('div')
      fill.className = 'is-tip-r__fill' + (over ? ' is-over' : '')
      var pct = Math.max(2, Math.min(100, over ? 100 : Number(b.ratio) * 100))
      fill.style.width = pct + '%'
      track.appendChild(fill)
      if (over) {
        var mark = document.createElement('div')
        mark.className = 'is-tip-r__mark'
        mark.style.left = Math.min(96, 100 / Number(b.ratio)) + '%'
        track.appendChild(mark)
      }
      wrap.appendChild(track)
      if (b.caption || b.captionRight) {
        var cap = document.createElement('div')
        cap.className = 'is-tip-r__gaugecap'
        var capL = document.createElement('span')
        capL.textContent = b.caption || ''
        cap.appendChild(capL)
        if (b.captionRight) {
          var capR = document.createElement('span')
          capR.className = over ? 'is-over' : ''
          capR.textContent = b.captionRight
          cap.appendChild(capR)
        }
        wrap.appendChild(cap)
      }
      tip.appendChild(wrap)
    } else if (b.type === 'metrics' && Array.isArray(b.items)) {
      var grid = document.createElement('div')
      grid.className = 'is-tip-r__metrics'
      b.items.forEach(function (it) {
        var cell = document.createElement('div')
        cell.className = 'is-tip-r__metric'
        var k = document.createElement('div')
        k.className = 'is-tip-r__mkey'
        k.textContent = it.label || ''
        var v = document.createElement('div')
        v.className = 'is-tip-r__mval'
        v.textContent = it.value || ''
        cell.appendChild(k)
        cell.appendChild(v)
        grid.appendChild(cell)
      })
      tip.appendChild(grid)
    } else if (b.type === 'sub') {
      var sub = document.createElement('div')
      sub.className = 'is-tip-r__sub' + toneClass(b.tone)
      sub.textContent = b.text || ''
      tip.appendChild(sub)
    } else if (b.type === 'basis') {
      var basis = document.createElement('div')
      // 注意：这里不能用全局 .is-info（那是「信息图标」组件，带 inline-flex + width:16px），
      // 会覆盖 basis 的 display:flex 并把容器压成 16px 导致文字竖排。用 tip 专属类名。
      basis.className = 'is-tip-r__basis' + (b.tone === 'info' ? ' is-tip-basis-info' : '')
      var bIcon = document.createElement('span')
      bIcon.className = 'is-tip-r__basis-ic'
      bIcon.textContent = 'i'
      basis.appendChild(bIcon)
      var bText = document.createElement('span')
      bText.textContent = b.text || ''
      basis.appendChild(bText)
      tip.appendChild(basis)
    } else if (b.type === 'fmtlist' && Array.isArray(b.items)) {
      var list = document.createElement('div')
      list.className = 'is-tip-r__fmtlist'
      b.items.forEach(function (it) {
        var row = document.createElement('div')
        row.className = 'is-tip-r__fmtrow' + (it.over ? ' is-over' : '')
        var cap = document.createElement('span')
        cap.className = 'is-tip-r__fmtcap'
        cap.textContent = it.format || ''
        row.appendChild(cap)
        var val = document.createElement('span')
        val.className = 'is-tip-r__fmtval'
        val.textContent = it.value || ''
        row.appendChild(val)
        if (it.overText) {
          var over = document.createElement('span')
          over.className = 'is-tip-r__fmtover'
          over.textContent = it.overText
          row.appendChild(over)
        }
        list.appendChild(row)
      })
      tip.appendChild(list)
    } else if (b.type === 'hint') {
      var hint = document.createElement('div')
      hint.className = 'is-tip-r__hint'
      var hIcon = document.createElement('span')
      hIcon.className = 'is-tip-r__hint-ic'
      hIcon.textContent = '↻'
      hint.appendChild(hIcon)
      var hText = document.createElement('span')
      hText.textContent = b.text || ''
      hint.appendChild(hText)
      tip.appendChild(hint)
    } else if (b.type === 'note') {
      var note = document.createElement('div')
      note.className = 'is-tip-r__note' + (b.tone === 'warn' ? ' is-warn' : '')
      note.textContent = b.text || ''
      tip.appendChild(note)
    } else if (b.type === 'foot') {
      var foot = document.createElement('div')
      foot.className = 'is-tip-r__foot'
      foot.textContent = b.text || ''
      tip.appendChild(foot)
    } else if (b.type === 'kvlist' && Array.isArray(b.items)) {
      var kv = document.createElement('div')
      kv.className = 'is-tip-r__kvlist'
      b.items.forEach(function (it) {
        var row = document.createElement('div')
        row.className = 'is-tip-r__kvrow' + toneClass(it.tone)
        var k = document.createElement('span')
        k.className = 'is-tip-r__kvkey'
        k.textContent = (it.label || '') + (it.label ? '：' : '')
        row.appendChild(k)
        var v = document.createElement('span')
        v.className = 'is-tip-r__kvval' + (it.mono ? ' is-mono' : '')
        v.textContent = it.value || ''
        row.appendChild(v)
        kv.appendChild(row)
      })
      tip.appendChild(kv)
    } else if (b.type === 'filelist' && Array.isArray(b.items)) {
      var fl = document.createElement('div')
      fl.className = 'is-tip-r__filelist'
      b.items.forEach(function (it) {
        var row = document.createElement('div')
        row.className = 'is-tip-r__filerow' + toneClass(it.tone)
        var n = document.createElement('span')
        n.className = 'is-tip-r__filename'
        n.textContent = it.name || ''
        n.title = it.name || '' // 悬停可见完整名（气泡内已省略）
        row.appendChild(n)
        // 实测色深列：为空则整列不渲染（读不到色深的产物不占位）
        if (it.depthText) {
          var dp = document.createElement('span')
          dp.className = 'is-tip-r__filedepth'
          dp.textContent = it.depthText
          dp.title = it.depthText
          row.appendChild(dp)
        }
        var s = document.createElement('span')
        s.className = 'is-tip-r__filesize'
        s.textContent = it.size || ''
        row.appendChild(s)
        fl.appendChild(row)
      })
      tip.appendChild(fl)
    } else if (b.type === 'stderr') {
      var err = document.createElement('div')
      err.className = 'is-tip-r__stderr'
      err.textContent = b.text || '' // pre-wrap 保留换行，全文不截断
      tip.appendChild(err)
    }
  })
}

function place (el, opts, point) {
  const tip = ensureHost()
  if (opts.blocks) {
    renderBlocks(tip, opts.blocks)
  } else {
    tip.classList.remove(NS + '--rich')
    tip.textContent = opts.text
  }
  tip.classList.remove(NS + '--show')
  // 先量尺寸再定位
  const r = el.getBoundingClientRect()
  // 富气泡变宽后先收敛到视口可用宽度再量，保证定位与边缘钳制都基于真实宽度
  if (opts.blocks) {
    const avail = Math.max(160, Math.min(window.innerWidth - 16, 280))
    if (tip.getBoundingClientRect().width > avail) tip.style.maxWidth = avail + 'px'
    else tip.style.maxWidth = ''
  } else {
    tip.style.maxWidth = ''
  }
  const tr = tip.getBoundingClientRect()
  const gap = 8
  const pad = 8
  let top
  let left
  if (opts.blocks) {
    // 富气泡（预估角标）：贴近鼠标（用户 11-20 12:53 拍板），但严格钳制在视口内不裁切。
    // 基准点优先取鼠标坐标 point，缺失时回退到触发元素中心（如 componentUpdated 重算）。
    // 水平：以鼠标 x 为中心；垂直：优先鼠标上方，空间不够翻到下方；两轴末端都 clamp。
    const px = point ? point.x : r.left + r.width / 2
    const py = point ? point.y : r.top
    left = px - tr.width / 2
    top = py - tr.height - gap
    if (top < pad) top = py + gap
    left = Math.max(pad, Math.min(left, window.innerWidth - tr.width - pad))
    top = Math.max(pad, Math.min(top, window.innerHeight - tr.height - pad))
  } else {
    // 纯文本 tip：保持 40+ 处老调用行为——居中于触发元素、上方优先、边缘钳制
    if (opts.placement === 'bottom' || r.top - tr.height - gap < pad) {
      top = Math.min(r.bottom + gap, window.innerHeight - tr.height - pad)
    } else {
      top = r.top - tr.height - gap
    }
    left = Math.max(pad, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - pad))
  }
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

function show (el, binding, evt) {
  const opts = normalize(binding.value)
  if (!opts || (!opts.text && !opts.blocks)) return
  // 记住进入时的鼠标坐标，气泡贴近鼠标定位（componentUpdated 重算时沿用最后坐标）
  if (evt && typeof evt.clientX === 'number') {
    el._tip.point = { x: evt.clientX, y: evt.clientY }
  }
  // 清掉待隐藏：宽限期内移回同一控件不闪断
  hide()
  // 短延迟：掠过多个控件时不至于满屏闪提示
  timer = setTimeout(function () {
    timer = null
    place(el, opts, el._tip.point)
  }, SHOW_DELAY)
}

// 归属域：向上找最近的 data-tip-owner 祖先（含自身）。
// 普通 tip 无标记 → 返回自身，维持「各自独立」的原有行为；
// 任务条项显式标记后，内部子 tip 与详情 tip 共属一个归属域，可互相让位而非互相灭掉。
function ownerOf (el) {
  let p = el
  while (p && p !== document.body) {
    if (p.hasAttribute && p.hasAttribute('data-tip-owner')) return p
    p = p.parentElement
  }
  return el
}

// 移出处理（归属判定核心）：
// 单例浮层下，子 tip 的 leave 若一律 hide()，会把同一归属域里的父级详情一起灭掉，
// 于是「hover 任务条看详情」经常被子元素（文件名/路径/帧频/角标…）劫持后消失。
// 修法：移出时若鼠标进入的元素仍属于同一归属域，恢复该域的主 tip（详情），不隐藏；
// 只有真正离开归属域才走隐藏宽限。40+ 处普通 tip 无 data-tip-owner，行为零变化。
function onLeave (el, evt) {
  const from = ownerOf(el)
  const to = evt && evt.relatedTarget ? ownerOf(evt.relatedTarget) : null
  const isOwnerDomain = from && from !== document.body && from.hasAttribute &&
    from.hasAttribute('data-tip-owner')
  if (isOwnerDomain && to === from && from._tip) {
    show(from, from._tip.binding, evt)
    return
  }
  scheduleHide()
}

export default {
  bind (el, binding) {
    el._tip = {
      // 存引用而非闭包捕获初次 binding：文案会随任务状态/产物大小变化
      binding: binding,
      enter: (evt) => show(el, el._tip.binding, evt),
      leave: (evt) => onLeave(el, evt),
      text: normalize(binding.value),
      point: null
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
    // 只在内容真的变了、且气泡正显示时才重算（sig 对纯文本=文案，对富气泡=blocks 序列化）。
    // 原来任何组件刷新都无条件 hide()，导致悬停读一半提示突然消失（issue #2）。
    const changed = (prev && prev.sig) !== (next && next.sig)
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
