#!/usr/bin/env node
/* 引导预览台：全局光晕铺满所有步骤 + 亮度分档 + 选项按钮内收 的静态守卫。
   纯读文件、不执行页面 JS，锁住以下契约：
   1. 光晕节点在 .frame 层（共享一份），铺满含顶/底栏的整个透明窗口
   2. 三枚 orb 齐全，radial-gradient + blur + keyframes 漂移都在
   3. .glow-field 默认降档（--is-glow-dim），.frame.glow-full 时满亮
   4. render() 里按 cur===0 切 frame 的 glow-full
   5. 顶栏/内容/底栏 z-index 高于光晕、欢迎步 overflow:hidden 裁滚动条
   6. 面板半透明（color-mix）+ 舞台棋盘格模拟 alpha；底栏透明无边框
   7. 无边框：frame 去 border/shadow、titlebar absolute、红绿灯/title 隐藏
*/
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const FILE = path.join(__dirname, '..', 'scripts', 'dev', 'guide-preview', 'index.html')
const raw = fs.readFileSync(FILE, 'utf8')

let n = 0
function ok (label, cond) {
  assert.ok(cond, 'FAIL: ' + label)
  n++
}

// 1. 光晕节点在 .frame 内、.screen 之前（共享层，铺满整个窗口）
const frameOpen = raw.indexOf('<div class="frame glow-full"')
const screenOpen = raw.indexOf('<div class="screen">')
const firstStep = raw.indexOf('<section class="step on" data-i="0">')
const glowDom = raw.indexOf('<div class="glow-field"')
ok('frame 初始带 glow-full', frameOpen > -1)
ok('光晕 DOM 在 frame 内、screen 之前', glowDom > frameOpen && glowDom < screenOpen)
ok('光晕 DOM 在欢迎步之前（非 step 内）', glowDom < firstStep)
const welcomeEnd = raw.indexOf('</section>', firstStep)
ok('欢迎步内不再有独立 glow-field', raw.indexOf('glow-field', firstStep) === -1 ||
   raw.indexOf('glow-field', firstStep) > welcomeEnd)

// 2. 三枚 orb + 渐变 + blur + 动画
ok('三枚 orb', /<i class="orb orb1"><\/i><i class="orb orb2"><\/i><i class="orb orb3"><\/i>/.test(raw))
ok('radial-gradient 光斑', (raw.match(/radial-gradient\(ellipse/g) || []).length >= 3)
ok('blur 收边', /\.glow-field\{[^}]*filter:blur\(34px\)/.test(raw))
ok('keyframes 漂移', ['glow-drift1', 'glow-drift2', 'glow-drift3'].every(k => raw.indexOf('@keyframes ' + k) > -1))

// 3. 亮度分档 + 边缘羽化（防光晕被 overflow:hidden 切成硬直线）
ok('默认降档 token', /\.glow-field\{[^}]*opacity:var\(--is-glow-dim,\.?\d+\)/.test(raw))
ok('glow-full 满亮', /\.frame\.glow-full \.glow-field\{opacity:1\}/.test(raw))
ok('光晕边缘羽化遮罩（椭圆渐隐到透明，消除硬裁切）',
  /\.glow-field\{[^}]*mask-image:radial-gradient\(ellipse 72% 72% at 50% 50%,#000 38%,transparent 48%\)/.test(raw))
ok('遮罩带 webkit 前缀', /-webkit-mask-image:radial-gradient\(ellipse 72%/.test(raw))
ok('transparent 落点 48% < 面板边缘 49.6%（否则边缘残留亮度成硬线）',
  /#000 38%,transparent 48%/.test(raw))

// 4. render 切档
ok('render 按当前步切 glow-full',
  /classList\.toggle\('glow-full',\s*cur === 0\)/.test(raw))

// 5. 层级
ok('step 内容 z-index 高于光晕', /\.step\{position:absolute;inset:0;z-index:1\}/.test(raw))
ok('欢迎步裁滚动条', /\.step\[data-i="0"\]\{[^}]*overflow:hidden/.test(raw))
ok('光晕 absolute 底层 z-index:0', /\.glow-field\{[^}]*position:absolute;inset:-20%;z-index:0/.test(raw))

// 6. alpha 通道视觉：面板半透明 + 舞台棋盘格 + 顶/底栏无条带
ok('面板半透明 color-mix', /\.frame\{[^}]*background:color-mix\(in srgb,var\(--is-elevated\) 78%,transparent\)/.test(raw))
ok('舞台棋盘格模拟透明底', /\.stage\{[\s\S]{0,220}conic-gradient\(from 90deg/.test(raw))
ok('棋盘格令牌两套主题齐全', (raw.match(/--is-checker:/g) || []).length === 2)
ok('棋盘格用主题令牌而非硬编码', /conic-gradient\(from 90deg[\s\S]{0,120}var\(--is-checker\)/.test(raw))
ok('底栏透明无上边框', /\.foot\{[\s\S]{0,180}border-top:0;background:transparent/.test(raw))
ok('顶栏进度点在光晕之上', /\.dots\{position:relative;z-index:1/.test(raw))
ok('底栏在光晕之上', /\.foot\{\s*position:relative;z-index:1/.test(raw))
ok('内容层在光晕之上', /\.screen\{isolation:isolate;position:relative;z-index:1\}/.test(raw))

// 7. 设置按钮内收
ok('标题栏 top/right 内收 20px',
  /\.titlebar\{[^}]*top:var\(--is-s-5\);right:var\(--is-s-5\)/.test(raw))

// 8. 无边框
ok('frame 去描边/投影', /\.frame\{[^}]*border:0;[^}]*box-shadow:none/.test(raw))
ok('titlebar absolute 浮层', /\.titlebar\{[^}]*position:absolute/.test(raw))
ok('红绿灯与标题隐藏', /\.tl,\.tb-name\{display:none\}/.test(raw))

console.log('preview-glow-all.l1.js OK (' + n + ' checks)')
