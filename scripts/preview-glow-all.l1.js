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
ok('radial-gradient 色斑（主核改纯色 blob 让形变可见，色斑 orb2/3 仍渐变虚化染温）',
  (raw.match(/radial-gradient\(ellipse/g) || []).length >= 2)
ok('blur 28px（大光云柔化边缘 + 压 capturePage 透明窗采样条纹伪影；28 是形变可见与柔化的平衡点）', /\.glow-field\{[^}]*filter:blur\(28px\)/.test(raw))
ok('glow-hue 关键帧 blur 与静态值一致 28px（否则动画会把 28 覆盖回旧值）',
  (hueRaw => hueRaw && (hueRaw.match(/blur\(28px\)/g) || []).length >= 2)(
    (raw.match(/@keyframes glow-hue\{[\s\S]*?\n\}/) || [''])[0]))
ok('暗色光云跟随主题色（淡黄绿主核 + accent 荧光黄绿 + cool 青，非 mimocode 暖棕）',
  /--is-glow-1:226,244,186;--is-glow-2:200,245,66;--is-glow-3:107,215,255/.test(raw))
ok('亮色光云跟随主题色（暖白主核 + 砖橙 + violet 紫，非 mimocode 暖棕米白）',
  /--is-glow-1:248,238,228;--is-glow-2:234,120,60;--is-glow-3:183,155,255/.test(raw))
ok('keyframes 漂移', ['glow-drift1', 'glow-drift2', 'glow-drift3'].every(k => raw.indexOf('@keyframes ' + k) > -1))

// 2b. 动态渐变：形状（位移/缩放/旋转）+ 颜色（色温循环 + 斑块透明度呼吸）都要真的在动
ok('色温循环 keyframes glow-hue 存在', raw.indexOf('@keyframes glow-hue') > -1)
ok('glow-field 挂 glow-hue 动画', /\.glow-field\{[^}]*animation:glow-hue/.test(raw))
const hueBlock = (raw.match(/@keyframes glow-hue\{[\s\S]*?\n\}/) || [''])[0]
ok('色温循环含 hue-rotate', /hue-rotate\(-?\d+deg\)/.test(hueBlock))
ok('色温循环含 saturate 呼吸（两档不同）', (() => {
  const vals = (hueBlock.match(/saturate\((\d+)%\)/g) || []).map(x => parseInt(x.match(/\d+/)[0], 10))
  return vals.length >= 2 && vals[0] !== vals[1]
})())
ok('主核不 rotate（旋转会把 blob 推出内收区、某些相位触边被裁；形变改靠 border-radius + 位移）',
  (m => m && !/rotate\(-?\d+deg\)/.test(m[0]))(
    (raw.match(/@keyframes glow-drift1\{[\s\S]*?\n\}/) || [])[0]))
ok('色斑漂移含 border-radius 形变（主核之外色斑也参与 blob 变形，非单纯位移）',
  ['glow-drift2','glow-drift3'].every(k => {
    const m = raw.match(new RegExp('@keyframes ' + k + '\\{[\\s\\S]*?\\n\\}'))
    return m && (m[0].match(/border-radius:/g) || []).length >= 3
  }))
ok('shape 漂移含透明度呼吸（颜色进出）',
  ['glow-drift1','glow-drift2','glow-drift3'].every(k => {
    const m = raw.match(new RegExp('@keyframes ' + k + '\\{[\\s\\S]*?\\}(?![\\s\\S]*?@keyframes ' + k + ')'))
    return m && /opacity:/.test(m[0])
  }))
ok('shape 漂移去 alternate（0→33→66→100 闭环）',
  ['glow-drift1','glow-drift2','glow-drift3'].every(k => !new RegExp('animation:' + k + '[^;]*alternate').test(raw)))
// blob 变形：轮廓本身在变（8 值 border-radius），不只是整块椭圆平移/缩放
const driftBlocks = ['glow-drift1','glow-drift2','glow-drift3'].map(k =>
  (raw.match(new RegExp('@keyframes ' + k + '\\{[\\s\\S]*?\\n\\}')) || [''])[0])
ok('三枚光斑关键帧都含 border-radius 变形（8 值 blob）',
  driftBlocks.every(blk => (blk.match(/border-radius:\d+% \d+% \d+% \d+% \/ \d+% \d+% \d+% \d+%/g) || []).length >= 3))
ok('每枚光斑的 blob 形状在各相位互不相同（真的变形，非固定椭圆）',
  driftBlocks.every(blk => {
    const vals = (blk.match(/border-radius:([^;]+)/g) || []).map(x => x.replace(/^border-radius:/, ''))
    return new Set(vals).size >= 3
  }))
ok('orb 的 will-change 含 border-radius（变形走合成层）', /\.glow-field \.orb\{[^}]*will-change:transform,border-radius/.test(raw))
ok('主核纯色 blob（径向渐变的椭圆等值线恒为椭圆、削透明角无形变；纯色才能让 border-radius 变形穿过 blur 可见）',
  /\.glow-field \.orb1\{[^}]*background:rgba\(var\(--is-glow-1\),\.94\)/.test(raw))
ok('色斑径向渐变到 100% 全透明（色斑只做主题色温层次、自身羽化收边）',
  (raw.match(/rgba\(var\(--is-glow-[23]\),0\) 100%\)/g) || []).length >= 2)
ok('blob 变形大幅（3[0-9]%↔6[0-9]%：小幅 40%↔60% 穿过 blur 后肉眼无感，用户要形变可见）',
  driftBlocks.every(blk => {
    const percents = (blk.match(/border-radius:[^;]+/g) || []).join(' ').match(/\d+%/g) || []
    return percents.length && percents.every(p => { const n = parseInt(p, 10); return n >= 30 && n <= 70 })
  }))
ok('光斑周期提速（7/9/11s，旧版 13/16/19s 太慢看着像静态）',
  ['glow-drift1 7s','glow-drift2 9s','glow-drift3 11s'].every(s => new RegExp('animation:' + s).test(raw)))
ok('关闭动效同时停光晕场与光斑', /\.no-motion \.glow-field,\.no-motion \.glow-field \.orb\{animation:none!important\}/.test(raw))

// 3. 亮度分档 + 边缘羽化（光斑自身渐变透明 + 收进面板，不用静态椭圆遮罩）
ok('默认降档 token', /\.glow-field\{[^}]*opacity:var\(--is-glow-dim,\.?\d+\)/.test(raw))
ok('glow-full 满亮', /\.frame\.glow-full \.glow-field\{opacity:1\}/.test(raw))
ok('无静态椭圆遮罩（radial-gradient 遮罩会把轮廓锁成固定椭圆、吃掉形变）',
  !/mask-image:radial-gradient/.test(raw) && !/-webkit-mask-image:radial-gradient/.test(raw))
ok('四边「线性」遮罩只锁边缘 alpha、不锁中央形状（与椭圆遮罩本质不同，形变可见）',
  /-webkit-mask-image:linear-gradient\(to right[^;]*\),linear-gradient\(to bottom/.test(raw) &&
  /mask-composite:intersect/.test(raw))
ok('光晕画布 inset:0 铺满 frame（clean 模式=整窗；负 inset 会越窗被裁）',
  /\.glow-field\{[^}]*position:absolute;inset:0;z-index:0/.test(raw))
ok('主光核内收（72%×76% + left/top 12~14%：留形变/位移余量，四边 alpha 恒 0）',
  /\.glow-field \.orb1\{[^}]*width:72%;height:76%;left:14%;top:12%/.test(raw))
ok('主核纯色主题色 blob（非径向渐变椭圆，让 border-radius 变形真正改变轮廓）',
  /\.glow-field \.orb1\{[^}]*background:rgba\(var\(--is-glow-1\),\.94\)/.test(raw))
ok('主核 blob 变形幅度 34%↔66%（跨过 blur 仍肉眼可见，实测相位差 19.4）',
  /@keyframes glow-drift1\{[\s\S]*?border-radius:34% 66%/.test(raw))
ok('右上强调色 / 左下辅色的主题色温偏移，且内收不贴边（防位移触边被裁）',
  /\.glow-field \.orb2\{[^}]*right:16%;top:14%/.test(raw) &&
  /\.glow-field \.orb3\{[^}]*left:16%;bottom:14%/.test(raw))
ok('frame overflow:visible（不再把光团上下切出水平硬边）',
  /\.frame\{[^}]*overflow:visible/.test(raw))
ok('stage overflow:hidden（扩出的 absolute 画布不撑滚动条）',
  /\.stage\{[^}]*overflow:hidden/.test(raw))

// 4. render 切档
ok('render 按当前步切 glow-full',
  /classList\.toggle\('glow-full',\s*cur === 0\)/.test(raw))

// 5. 层级
ok('step 内容 z-index 高于光晕', /\.step\{position:absolute;inset:0;z-index:1\}/.test(raw))
ok('欢迎步裁滚动条', /\.step\[data-i="0"\]\{[^}]*overflow:hidden/.test(raw))
ok('光晕 absolute 底层 z-index:0', /\.glow-field\{[^}]*position:absolute;inset:0;z-index:0/.test(raw))

// 6. alpha 通道视觉：面板全透明无边界（mimocode 真透明窗）+ 舞台棋盘格 + 顶/底栏无条带
ok('面板全透明（无卡片底色）', /\.frame\{[^}]*background:transparent/.test(raw))
ok('面板无圆角（去掉四周边界，靠光晕羽化）', /\.frame\{[^}]*border-radius:0;/.test(raw))
ok('欢迎副标题加深+亮色描边（亮色主题基线砖橙系，非 mimocode 深棕）', /\.step\[data-i="0"\] \.sub\{[^}]*color:#2a201a[^}]*text-shadow/.test(raw))

// 6b. 欢迎页文字/logo/按钮跟随主题色（用户 11-26 拍板：不用 mimocode 深棕）：
//     亮色主题走 accent 砖橙，暗色主题走荧光黄绿；光云是亮色，承载底用深墨绿保证对比。
ok('亮色基线 welcome-cta 按钮走 brick-orange（非深棕 #3b2f27）',
  /\.step\[data-i="0"\] \.welcome-cta\{[^}]*background:#c2410c;color:#fffaf5/.test(raw))
ok('亮色基线 -next 后缀走 brick-orange（非 #7a5236）',
  /\.step\[data-i="0"\] \.brand-name em\{color:#c2410c\}/.test(raw))
ok('亮色基线局部变量 accent=brick-orange（logo 圆点/箭头走主题色）',
  /\.step\[data-i="0"\]\{[^}]*--is-accent:#c2410c;--is-on-accent:#fffaf5/.test(raw))
ok('暗色覆盖块存在（.theme-dark 前缀，特异性高于亮色基线）',
  /\.theme-dark \.step\[data-i="0"\]\{[^}]*--is-text:#1c2a0e/.test(raw))
ok('暗色主题局部变量 accent=荧光黄绿（logo 小圆点走主题色）',
  /\.theme-dark \.step\[data-i="0"\]\{[^}]*--is-accent:#c8f542;--is-on-accent:#0c0f0e/.test(raw))
ok('暗色标题/副标题亮色护底 text-shadow（浅黄绿护底，非暖白）',
  /\.theme-dark \.step\[data-i="0"\] \.brand-name,\s*\.theme-dark \.step\[data-i="0"\] \.sub\{[^}]*text-shadow:0 1px 1px rgba\(238,248,200/.test(raw))
ok('暗色副标题转深墨绿（非浅色/非深棕）', /\.theme-dark \.step\[data-i="0"\] \.sub\{color:#1f3010/.test(raw))
ok('暗色 logo 主圆深墨绿 + 箭头荧光黄绿（亮绿压亮光会糊，圆用深底）',
  /\.theme-dark \.step\[data-i="0"\] \.demo--brand \.d-pop3 path:first-child\{fill:#1c2a0e\}/.test(raw) &&
  /\.theme-dark \.step\[data-i="0"\] \.demo--brand \.d-pop3 path:last-child\{fill:#c8f542\}/.test(raw))
ok('暗色 welcome-cta 深墨绿底 + 荧光黄绿字（非深棕）',
  /\.theme-dark \.step\[data-i="0"\] \.welcome-cta\{background:#1c2a0e;color:#c8f542/.test(raw))
ok('暗色卡片改暖白磨砂玻璃（非死黑）',
  /\.theme-dark \.step\[data-i="0"\] \.card\{[^}]*background:rgba\(255,255,255,\.68\)/.test(raw))
ok('暗色卡片标题/描述转深墨绿',
  /\.theme-dark \.step\[data-i="0"\] \.card \.t\{color:#1c2a0e\}/.test(raw) &&
  /\.theme-dark \.step\[data-i="0"\] \.card \.d\{color:rgba\(28,42,14/.test(raw))
ok('暗色 -next 后缀转深橄榄绿（非深暖棕 #a86a3c）', /\.theme-dark \.step\[data-i="0"\] \.brand-name em\{color:#4a6b12\}/.test(raw))
ok('欢迎页所有棕色硬编码清零（mimocode 残留 #3b2f27/#8a5a38/#a86a3c/#2b2520/#7a5236/#2b221c）',
  !/#3b2f27|#8a5a38|#a86a3c|#2b2520|#7a5236|#2b221c|#2b2622|#544a42|#73675d|#3d332b|#fff8ee/.test(raw))
ok('面板恒透明：无 .frame.glow-full 背景规则（alpha 透明面板不可加实色/渐变底）',
  !/\.frame\.glow-full\{[^}]*background/.test(raw))
ok('面板注释明令禁止给 glow-full 加 background（防回归成不透明方板）',
  /切忌给 \.frame\.glow-full 加 background/.test(raw))
ok('光晕是半透明色块（主核纯色 blob + 色斑径向渐变 + 四边线性遮罩），四边自然淡出无硬边',
  /\.glow-field\{[^}]*mask-image:linear-gradient/.test(raw) &&
  (raw.match(/rgba\(var\(--is-glow-[23]\),0\) 100%\)/g) || []).length >= 2)
ok('舞台棋盘格模拟透明底', /\.stage\{[\s\S]{0,400}conic-gradient\(from 90deg/.test(raw))
ok('舞台铺满窗口高度', /\.stage\{[\s\S]{0,300}height:100%/.test(raw))
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

// 9. 分场景契约（用户 11-26 拍板）：alpha 只在欢迎步；进入后切不透明方框面板
ok('render 按 cur>0 切 solid（非欢迎步不透明方框）',
  /classList\.toggle\('solid',\s*cur > 0\)/.test(raw))
ok('.frame.solid 不透明方框面板（实色底 + 边框 + 圆角 + 阴影）',
  /\.frame\.solid\{[^}]*background:var\(--is-panel\)[^}]*border:1px solid var\(--is-border-strong\)[^}]*border-radius:var\(--is-r-lg\)[^}]*box-shadow:var\(--is-shadow-lg\)/.test(raw))
ok('solid 步骤光晕关闭', /\.frame\.solid \.glow-field\{display:none\}/.test(raw))
ok('欢迎步隐藏三张卡（mimocode 极简：字标+引导语+主按钮）',
  /\.step\[data-i="0"\] \.cards\{display:none\}/.test(raw))
ok('欢迎步单一主按钮 welcome-cta 存在', /class="welcome-cta" id="btnStart"/.test(raw))
ok('欢迎步隐藏进度点与底部导航（干净一屏）',
  /\.frame\.glow-full \.dots,\.frame\.glow-full \.foot\{display:none\}/.test(raw))
ok('btnStart 点击进第 2 步（go(1)）',
  /btnStart\.addEventListener\('click',\s*function \(\) \{ go\(1\) \}\)/.test(raw))
ok('欢迎字标放大到 40px（mimocode 大字标）',
  /\.step\[data-i="0"\] \.brand-name\{font-size:40px/.test(raw))

// 9b. solid 指导面板动态渐变（用户 11-26 拍板：指导面板配色改欢迎页同款动态渐变）
ok('solid-glow DOM 存在（glow-field 之后、screen 之前）',
  (() => { const a = raw.indexOf('class="solid-glow"'), b = raw.indexOf('class="glow-field"'), c = raw.indexOf('class="screen"'); return a > -1 && a > b && a < c })())
ok('solid-glow 两枚色斑 s-orb1/s-orb2',
  /<i class="s-orb s-orb1"><\/i><i class="s-orb s-orb2"><\/i>/.test(raw))
ok('solid-glow 默认 display:none（欢迎步不显示，不干扰 alpha 光云）',
  /\.solid-glow\{[^}]*display:none/.test(raw))
ok('仅 .frame.solid 显示动态渐变', /\.frame\.solid \.solid-glow\{display:block\}/.test(raw))
ok('solid 渐变复用欢迎页同款 --is-glow-2/3 token（配色一致：暗色黄绿+青 / 亮色砖橙+紫）',
  /\.solid-glow \.s-orb1\{[\s\S]*?rgba\(var\(--is-glow-2\)/.test(raw) &&
  /\.solid-glow \.s-orb2\{[\s\S]*?rgba\(var\(--is-glow-3\)/.test(raw))
ok('solid 渐变压淡（整体 op token + 色斑 alpha≤.34，保证面板内容可读）',
  /\.solid-glow\{[^}]*opacity:var\(--is-solid-glow-op,\.?\d+\)/.test(raw) &&
  (raw.match(/rgba\(var\(--is-glow-[23]\),\.3\d?\)/g) || []).length >= 2)
ok('两套主题各有 solid-glow 亮度档（暗色高于亮色，浅底压更低防脏）',
  /--is-solid-glow-op:\.58/.test(raw) && /--is-solid-glow-op:\.44/.test(raw))
ok('solid 渐变叠在不透明 panel 底之上（z-index:0，screen z1 在其上）',
  /\.solid-glow\{[^}]*position:absolute;inset:0;z-index:0/.test(raw) &&
  /\.screen\{isolation:isolate;position:relative;z-index:1\}/.test(raw))
ok('solid 色斑 blob 形变（8 值 border-radius）+ 独立 keyframes（不干扰欢迎页动画）',
  ['solid-drift1', 'solid-drift2'].every(k => raw.indexOf('@keyframes ' + k) > -1) &&
  (raw.match(/\.solid-glow \.s-orb[12]\{[^}]*animation:solid-drift[12]/g) || []).length >= 2)
ok('solid 色温循环 solid-hue（blur 44 与静态一致 + saturate/hue-rotate 游移）', (() => {
  const m = raw.match(/@keyframes solid-hue\{[\s\S]*?\n\}/)
  return m && m[0].indexOf('hue-rotate') > -1 && (m[0].match(/blur\(44px\)/g) || []).length >= 2
})())
ok('solid 渐变 blur 44（大柔化，压住色斑边界不成硬块）', /\.solid-glow\{[^}]*filter:blur\(44px\)/.test(raw))
ok('关闭动效/reduce 同时停 solid 渐变',
  /\.no-motion \.solid-glow,\.no-motion \.solid-glow \.s-orb\{animation:none!important\}/.test(raw) &&
  /@media \(prefers-reduced-motion:reduce\)\{\.solid-glow,\.solid-glow \.s-orb\{animation:none!important\}\}/.test(raw))

// 10. 欢迎页首次进场编排（用户 11-26 拍板：logo 进来 → 光云渐显 → 按钮出现）
ok('光云渐显挂 .glow-reveal 包裹层（不挂 .glow-field，避免被真机钉相位重置 fade）',
  /<div class="glow-reveal" aria-hidden="true">\s*<div class="glow-field"/.test(raw) &&
  /\.glow-reveal\{animation:intro-glow/.test(raw))
ok('光云渐显 fade 关键帧 from opacity:0 → to opacity:1',
  /@keyframes intro-glow\{from\{opacity:0\}to\{opacity:1\}\}/.test(raw))
// 时序：logo 大显示 0 → 停留到 0.9s → 光云 0.9（与缩放位移同步）→ 字标 1.6 → 副标题 1.75 → 按钮 2
// （logo 出现→停留→一边缩放位移一边出背景→文本按钮，用户 11-26 细化拍板）
const introDelay = sel => {
  const m = raw.match(new RegExp('\\.step\\[data-i="0"\\] ' + sel + '\\{animation:[^}]*?([\\d.]+)s backwards\\}'))
  return m ? parseFloat(m[1]) : -1
}
const glowDelay = (() => { const m = raw.match(/\.glow-reveal\{animation:intro-glow [\d.]+s var\(--is-ease-std\) ([\d.]+)s backwards\}/); return m ? parseFloat(m[1]) : -1 })()
ok('进场延迟序：logo(0) < 光云(0.9) < 字标(1.6) < 副标题(1.75) < 按钮(2)',
  introDelay('\\.demo--brand') === 0 &&
  introDelay('\\.demo--brand') < glowDelay && glowDelay < introDelay('\\.brand-name') &&
  introDelay('\\.brand-name') < introDelay('\\.sub') &&
  introDelay('\\.sub') < introDelay('\\.welcome-cta'))
ok('光云 delay 0.9s 对齐 logo 缩放位移起点（1.8s×50%，实现「一边缩放一边出背景」）',
  Math.abs(glowDelay - 0.9) < 0.01 &&
  /\.step\[data-i="0"\] \.demo--brand\{animation:intro-logo 1\.8s/.test(raw))
ok('全部进场动画用 backwards（播完不锁 transform，按钮 hover 不失效；禁 both/forwards）',
  (raw.match(/animation:intro-(logo|rise|cta|glow)[^}]*backwards\}/g) || []).length >= 5 &&
  !/animation:intro-(logo|rise|cta|glow)[^}]*(both|forwards)/.test(raw))
ok('四个进场关键帧齐全（logo/rise/cta/glow），rise/cta 从位移+缩放入场',
  ['intro-logo', 'intro-rise', 'intro-cta', 'intro-glow'].every(k => raw.indexOf('@keyframes ' + k) > -1) &&
  /@keyframes intro-rise\{from\{opacity:0;transform:translateY\(\d+px\) scale\(\.9\d?\)\}/.test(raw))
ok('logo 居中大显示 → 缩放位移归位（先 scale 2.6+translateY 大显示，再 scale 1+归位）',
  (m => m && /scale\(2\.6\)/.test(m) && /translateY\(90px\) scale\(2\.6\)/.test(m) &&
    /100%\s*\{opacity:1;transform:translateY\(0\) scale\(1\)\}/.test(m))(
      (raw.match(/@keyframes intro-logo\{[\s\S]*?\n\}/) || [])[0]))
ok('logo 大显示后停留一会（17% 淡入完成 + 50% 保持大状态，两帧同值 = 停留 0.6s）', (() => {
  const m = (raw.match(/@keyframes intro-logo\{[\s\S]*?\n\}/) || [''])[0]
  const holds = (m.match(/(?:17|50)%\s*\{opacity:1;transform:translateY\(90px\) scale\(2\.6\)\}/g) || [])
  return holds.length === 2
})())
ok('关闭动效/reduce 让进场元素直接可见（取消 backwards 隐藏起始态）',
  /\.no-motion \.glow-reveal,[\s\S]*?\.welcome-cta\{animation:none!important;opacity:1!important;transform:none!important\}/.test(raw) &&
  /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.welcome-cta\{animation:none!important;opacity:1!important;transform:none!important\}/.test(raw))

// 11. logo 动态品牌图形（用户 11-27：品牌统一为「状态循环 SVG」自带动画；
//     早先手写圆球轨道 d-orbit-intro 已被替换，此组锁新契约，勿再断言圆球 DOM）
ok('欢迎页 logo 用动态状态循环 SVG（自带 <animate>，非静态轨道圆球）',
  /<svg class="demo demo--brand"[^>]*>[\s\S]*?<image class="anim d-pop3" href="isparta-next-media-state-cycle-loop\.svg"/.test(raw))
ok('动态 logo SVG 资源存在且自带 SMIL 动画（animate 节点）', (() => {
  const p = path.join(__dirname, '..', 'scripts', 'dev', 'guide-preview', 'isparta-next-media-state-cycle-loop.svg')
  if (!fs.existsSync(p)) return false
  const svg = fs.readFileSync(p, 'utf8')
  return (svg.match(/<animate\b/g) || []).length >= 10
})())
ok('logo 进场缩放位移仍与光云同期（0.9s 起、1.8s 走完）',
  /\.step\[data-i="0"\] \.demo--brand\{animation:intro-logo 1\.8s/.test(raw) &&
  Math.abs(glowDelay - 0.9) < 0.01)
ok('常速旋转从 9s 加快到 2.4s', /\.d-orbit-brand\{[^}]*animation:k-spin 2\.4s linear infinite/.test(raw))
ok('no-motion / reduce 同时取消圆球两层旋转',
  /\.no-motion \.d-orbit-brand,\.no-motion \.d-orbit-intro\{animation:none!important;transform:none!important\}/.test(raw) &&
  /@media \(prefers-reduced-motion:reduce\)\{[\s\S]*?\.d-orbit-brand,\.d-orbit-intro\{animation:none!important;transform:none!important\}/.test(raw))

// 弹窗测试契约（用户 11-26「控制台能否测试触发已有的各种弹窗」→ 选 What's New + 检查更新）
const dlgRaw = (raw.match(/var DLG = \{[\s\S]*?\n  \}/) || [''])[0]
ok('控制台弹窗测试分组 + 两个入口（own / upd）',
  raw.indexOf('id="dlgList"') > -1 && raw.indexOf('data-d="own"') > -1 &&
  raw.indexOf('data-d="upd"') > -1 && raw.indexOf('data-dt="lblDialog"') > -1)
ok('弹窗层默认 hidden、z 高于面板内容、clean 模式强制隐藏（不污染 alpha 验证）',
  /class="pv-layer pv-own" id="dlgOwn" hidden/.test(raw) &&
  /class="pv-layer pv-upd" id="dlgUpd" hidden/.test(raw) &&
  /\.pv-layer\{position:absolute;inset:0;z-index:50/.test(raw) &&
  /\.pv-layer\[hidden\]\{display:none!important\}/.test(raw) &&
  /\.clean \.pv-layer\{display:none!important\}/.test(raw))
ok('CEP 运行时两弹窗铺满（max-width:none + 6px，对齐 .own--cep / upd-dialog）',
  /\.frame\[data-runtime="cep"\] \.pv-layer\{padding:6px\}/.test(raw) &&
  /\.frame\[data-runtime="cep"\] \.pv-own-card,\.frame\[data-runtime="cep"\] \.pv-upd-panel\{max-width:none\}/.test(raw))
ok('打开弹窗冻结 frame 宽度过渡（避免 CEP 切换中间态看着没铺满）',
  /\.frame\.pv-open\{transition:none\}/.test(raw) &&
  /frame\.classList\.add\('pv-open'\)/.test(raw) &&
  /frame\.classList\.remove\('pv-open'\)/.test(raw))
ok("What's New 显示真实更新日志要点 6 条（ownH1..H6，对齐 briefLines 上限）",
  (raw.match(/data-dt="ownH\d"/g) || []).length === 6 &&
  ['ownH4', 'ownH5', 'ownH6'].every(k => dlgRaw.indexOf(k + ':') > -1))
ok('检查更新默认要点 6 条 + 展开分组 5 行 + 展开/收起按钮（noteBrief / noteItems）',
  (raw.match(/data-dt="updI\d"/g) || []).length === 6 &&
  (raw.match(/data-dt="updF\d"/g) || []).length === 5 &&
  raw.indexOf('id="updToggle"') > -1 &&
  dlgRaw.indexOf('updExpand:') > -1 && dlgRaw.indexOf('updCollapse:') > -1)
ok('展开后滚动区渐隐（scroll-fade 同口径），末行不被硬裁',
  /\.pv-upd-list\.is-expanded\{[^}]*mask-image:linear-gradient/.test(raw) &&
  /updList\.classList\.toggle\('is-expanded'/.test(raw))
ok('日志文案取真实 v3.9.0 release notes（版本对照 + 【新增】分组 + APNG 条目）',
  dlgRaw.indexOf('v3.9.0') > -1 && dlgRaw.indexOf('【新增】') > -1 && dlgRaw.indexOf('APNG') > -1)
ok('弹窗三语字典齐全（zh-CN / zh-TW / en，与预览台 I18N 同 key）', (() => {
  const keys = ['lblDialog', 'dlgOwn', 'dlgUpd', 'ownTitle', 'ownSub', 'ownH1', 'ownH2', 'ownH3', 'ownH4', 'ownH5', 'ownH6', 'ownStart',
    'updTitle', 'updSub', 'updI1', 'updI2', 'updI3', 'updI4', 'updI5', 'updI6',
    'updF1', 'updF2', 'updF3', 'updF4', 'updF5', 'updExpand', 'updCollapse', 'updFoot', 'updSkip', 'updLater', 'updDownload']
  return ['zh-CN', 'zh-TW', 'en'].every(pk => {
    const m = dlgRaw.match(new RegExp("'" + pk + "': \\{[\\s\\S]*?\\n    \\}"))
    return m && keys.every(k => m[0].indexOf(k + ':') > -1)
  })
})())
ok('弹窗开关：按钮/遮罩/ESC 关闭，打开先收设置层',
  /function openDialog \(k\)/.test(raw) && /function closeDialog \(\)/.test(raw) &&
  raw.indexOf('closePop()') > -1 && raw.indexOf("e.key === 'Escape'") > -1 &&
  raw.indexOf('e.target === layer') > -1 && raw.indexOf('[data-close]') > -1)
ok('弹窗文案随语言切换刷新，展开态显示「收起」',
  raw.indexOf('renderDialogI18n()') > -1 &&
  raw.indexOf("querySelectorAll('[data-dt]')") > -1 &&
  raw.indexOf("'updCollapse' : el.dataset.dt") > -1)
ok('弹窗进场 backwards + no-motion/reduce 直接可见',
  raw.indexOf('@keyframes pv-fade') > -1 && raw.indexOf('@keyframes pv-card') > -1 &&
  /\.pv-layer:not\(\[hidden\]\)\{animation:pv-fade[^}]*backwards\}/.test(raw) &&
  raw.indexOf('.no-motion .pv-layer:not([hidden])') > -1)

console.log('preview-glow-all.l1.js OK (' + n + ' checks)')
