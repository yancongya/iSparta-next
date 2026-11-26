#!/usr/bin/env node
/* 真机透明窗验证契约守卫：预览台 clean 模式 + Electron 脚本三件套 + 像素采样断言。
   纯读文件，不执行页面。*/
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const read = p => fs.readFileSync(path.join(__dirname, p), 'utf8')
const html = read('dev/guide-preview/index.html')
const cjs = read('dev/verify-transparent-preview.cjs')

let n = 0
const ok = (label, cond) => { assert.ok(cond, 'FAIL: ' + label); n++ }

// 1. clean 模式 CSS
ok('clean 模式样式块存在', /html\.clean,html\.clean body\{background:transparent!important\}/.test(html))
ok('dev 控制台与 dev 顶栏在 clean 模式隐藏', /\.clean \.ctrl,\.clean \.titlebar\{display:none!important\}/.test(html))
ok('clean 模式去焦点描边（避免真机截图像素采样出现红边泄漏）', /\.clean \*\{outline:none!important\}/.test(html))
ok('面板恒透明：无 .frame.glow-full 背景（alpha 透明面板，光晕是半透明浮层）',
  !/\.frame\.glow-full\{[^}]*background/.test(html))
ok('舞台棋盘格在 clean 模式去掉', /\.clean \.stage\{[^}]*background:transparent!important/.test(html))
ok('面板在 clean 模式铺满窗口', /\.clean \.frame,\.clean \.frame\[data-runtime\]\{width:100vw!important;height:100vh!important\}/.test(html))
ok('无边框窗拖拽区存在', /\.clean \.drag-strip\{[^}]*-webkit-app-region:drag/.test(html))

// 2. clean 模式开关（query，不污染 hash 深链）
ok('clean 由 query ?clean=1 触发', /isClean = \/\(\^\|\[\?&\]\)clean=1/.test(html) ||
  /var isClean = .*clean=1/.test(html))
ok('clean 只加 class 不改默认行为', /document\.documentElement\.classList\.add\('clean'\)/.test(html))
ok('clean 判定在 hash 解析之前', (() => {
  const a = html.indexOf('var isClean')
  const b = html.indexOf('var h = String(location.hash')
  return a > -1 && b > -1 && a < b
})())

// 3. Electron 真透明三件套
ok('transparent:true', /transparent:\s*true/.test(cjs))
ok('frame:false', /frame:\s*false/.test(cjs))
ok('背景色全透明', /backgroundColor:\s*'#00000000'/.test(cjs))
ok('加载 clean 模式 URL', /8090\/\?clean=1/.test(cjs))

// 4. 真断言（非纯截图摆设）
ok('断言 body 真透明', /body 背景真透明/.test(cjs) && /rgba\(0, 0, 0, 0\)|transparent/.test(cjs))
ok('断言舞台无棋盘格', /舞台无棋盘格图层/.test(cjs) && /stageBg === 'none'/.test(cjs))
ok('像素采样中心光核高 alpha（半透明光晕，非全透）', /中心暖白磨砂不透明/.test(cjs) && /alpha\.center >= 200/.test(cjs))
ok('像素采样四角 alpha 更低（光晕淡出、透出桌面）', /四角明显羽化/.test(cjs) && /a < alpha\.center - 60/.test(cjs))
ok('真机形变在动断言（确定性相位 0↔4.6s 的 alpha 网格明显不同，非静止椭圆）',
  /真机光云形变在动/.test(cjs) && /function sampleAlphaGrid/.test(cjs) && /diff > 2/.test(cjs))
ok('真机分场景：solid 动态渐变层显示 + 返回欢迎步隐藏',
  /solid 步骤动态渐变层显示/.test(cjs) && /solidGlowDisplay === 'block'/.test(cjs) &&
  /返回欢迎步 → solid 渐变层隐藏/.test(cjs) && /solidGlowDisplay === 'none'/.test(cjs))
ok('DOM 断言面板恒透明（无实色/渐变底）', /面板恒透明/.test(cjs) && /dom\.frameBg === 'none'/.test(cjs))
ok('真机进场落终态 + 按钮 hover 未锁死（backwards 防 transform 锁死回归）',
  /进场落终态/.test(cjs) && /ctaProbe/.test(cjs) && /按钮 transform 未被进场动画锁死/.test(cjs) &&
  /intro-\*/.test(cjs) && /glow-reveal/.test(cjs))
ok('截图落盘 .tmp', /\.tmp', 'transparent-preview\.png'/.test(cjs))
ok('capturePage 空尺寸重试（display surface 未就绪不误判）', /i < 5/.test(cjs) && /s\.width > 0 && s\.height > 0/.test(cjs))
ok('无第三方依赖的 PNG 解码', /function sampleCorners/.test(cjs) && /color !== 6/.test(cjs))

// 分场景真机契约：欢迎步 alpha → 点击进入切不透明方框 → 返回恢复 alpha
ok('真机脚本点击开始使用进第 2 步', /getElementById\('btnStart'\)\.click\(\)/.test(cjs))
ok('真机断言切 solid 不透明方框', /切 solid 不透明方框/.test(cjs) && /isSolid === true/.test(cjs))
ok('真机断言 solid 有不透明底色（非 alpha）', /solid 面板有不透明底色/.test(cjs) && /solid\.bg/.test(cjs))
ok('真机断言 solid 光晕关闭', /solid 步骤欢迎页光晕已关闭/.test(cjs) && /glowDisplay === 'none'/.test(cjs))
ok('真机断言返回欢迎步恢复 alpha', /返回欢迎步 → 恢复 alpha/.test(cjs) && /bg === 'none'/.test(cjs))

ok('真机断言弹窗测试层 clean 模式隐藏（不污染 alpha / 形变采样）',
  /弹窗测试层在 clean 模式默认隐藏/.test(cjs) && /dlgOwnHidden/.test(cjs) &&
  /dlgUpdHidden/.test(cjs) && /dlgDisplay === 'none'/.test(cjs))

console.log('transparent-preview.l1.js OK (' + n + ' checks)')
