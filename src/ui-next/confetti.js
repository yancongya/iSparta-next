/**
 * 完成彩带（animejs 实现，零新增依赖）
 *
 * 用法：import confetti from '../confetti'; confetti.celebrate()
 * 从屏幕下方左右两个喷口喷出彩纸，上抛后飘出屏外。全程 ~1.6s，粒子 DOM 自清理。
 * 尊重 prefers-reduced-motion（直接 no-op）；连续调用会合并（进行中直接忽略）。
 */

import anime from 'animejs'

var REDUCED = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// 与 tokens.css 主题色对应（固定 RGB，避免读 CSS 变量的时机问题）
var COLORS = [
  'rgb(200, 245, 66)', // accent
  'rgb(61, 220, 151)', // ok
  'rgb(255, 107, 53)', // hot
  'rgb(107, 215, 255)', // cool
  'rgb(183, 155, 255)', // violet
  'rgb(255, 200, 87)' // warn
]

var layer = null
var playing = false

function ensureLayer () {
  if (layer && layer.isConnected) return layer
  layer = document.createElement('div')
  layer.setAttribute('aria-hidden', 'true')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:3000'
  document.body.appendChild(layer)
  return layer
}

function celebrate () {
  if (REDUCED || playing) return
  playing = true
  var host = ensureLayer()
  host.innerHTML = ''
  var w = window.innerWidth
  var h = window.innerHeight

  // 左右两个喷口
  var origins = [
    { x: w * 0.18, y: h * 0.92 },
    { x: w * 0.82, y: h * 0.92 }
  ]

  var N = 90
  var remaining = N
  var all = []

  for (var i = 0; i < N; i++) {
    var el = document.createElement('i')
    var size = 5 + Math.round(Math.random() * 5)
    var round = Math.random() < 0.35
    el.style.cssText = 'position:absolute;display:block;left:0;top:0;opacity:0;will-change:transform,opacity' +
      ';width:' + size + 'px;height:' + (round ? size : size * 0.45) + 'px' +
      ';border-radius:' + (round ? '50%' : '1px') +
      ';background:' + COLORS[(Math.random() * COLORS.length) | 0]
    host.appendChild(el)

    var o = origins[i % 2]
    var up = -(h * (0.45 + Math.random() * 0.35)) // 上抛高度
    var outward = (o.x < w / 2 ? 1 : -1) * (20 + Math.random() * w * 0.3) // 向外水平距离
    var delay = (i % 2) * 80 + Math.random() * 200

    all.push(anime({
      targets: el,
      keyframes: [
        // 第一段：喷出上抛
        {
          opacity: [0, 1],
          translateX: [o.x, o.x + outward * 0.7],
          translateY: [o.y, o.y + up],
          rotate: [0, Math.random() * 360 - 180],
          duration: 520,
          easing: 'easeOutCubic'
        },
        // 第二段：飘落出屏
        {
          translateX: o.x + outward,
          translateY: h + 40,
          rotate: '+=200',
          opacity: [1, 1, 0],
          duration: 900,
          easing: 'easeInQuad'
        }
      ],
      delay: delay,
      complete: function () {
        remaining--
        if (remaining <= 0) {
          host.innerHTML = ''
          playing = false
        }
      }
    }))
  }

  // 兜底自清理（防异常残留导致 playing 卡死）
  window.setTimeout(function () {
    if (playing && host.innerHTML) {
      all.forEach(function (a) { a.pause() })
      host.innerHTML = ''
      playing = false
    }
  }, 2600)
}

export default { celebrate: celebrate }
