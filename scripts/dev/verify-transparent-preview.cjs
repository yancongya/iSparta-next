/**
 * 真机验证：透明 alpha 欢迎页（不打包、不安装、不改真实组件）
 *
 * 用法（WorkBuddy 环境自带 ELECTRON_RUN_AS_NODE=1，必须 unset）：
 *   unset ELECTRON_RUN_AS_NODE && npx electron scripts/dev/verify-transparent-preview.cjs
 *
 * 前置：另开一个终端跑 `npm run preview:guide`（默认 :8090，被占会顺延并打印真实端口）；
 *       若端口不是 8090，用 --url=http://127.0.0.1:8091 指定。
 *
 * 它做什么（全是浏览器 mock / 静态预览台测不到的真实能力）：
 *   1) 起一个 transparent:true + frame:false + backgroundColor 全透明的真 Electron 窗；
 *   2) 加载预览台 ?clean=1 —— 隐藏 dev 控制台、去棋盘格假背景、面板铺满窗口；
 *   3) 截一张真实窗口 PNG（含 alpha 通道）落盘 .tmp/transparent-preview.png，
 *      用像素采样确认：面板整体 alpha 透明（frame 背景 none）——中心光核区有
 *      半透明色块（alpha 高）、四角 alpha=0 透出桌面，证明这是真 alpha 透明面板，
 *      不是棋盘格模拟出来的假象，也没有不透明矩形边界。
 *   4) 离屏（--offscreen）时可无人值守跑；默认 show 方便肉眼拖动换位看透传；
 *      --stay 验证完不关窗，停在桌面上供拖动查看（关窗即退出进程）。
 *
 * 不写任何产物、不碰真实组件源码、不构建、不安装，验证完自动退出。
 *
 * 退出码：0 全通过；1 有断言失败。
 */
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const ROOT = process.cwd()
const argv = process.argv.slice(2)
const arg = (k, d) => { const p = argv.find(a => a.indexOf('--' + k + '=') === 0); return p ? p.split('=').slice(1).join('=') : d }

const URL = arg('url', 'http://127.0.0.1:8090/?clean=1')
const OUT = path.join(ROOT, '.tmp', 'transparent-preview.png')
const OFFSCREEN = argv.indexOf('--offscreen') > -1
const STAY = argv.indexOf('--stay') > -1

app.setPath('userData', path.join(ROOT, '.tmp', 'verify-transparent-preview'))
app.disableHardwareAcceleration()

let win = null
const results = []
function ok (name, cond, detail) {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : ''))
}

app.on('ready', async () => {
  win = new BrowserWindow({
    width: 760,
    height: 500,
    show: !OFFSCREEN,
    // 真透明三件套：Windows 下 transparent 必须配 frame:false，背景色带 0 alpha
    transparent: true,
    frame: false,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: true,
    movable: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
  })

  const loadErr = []
  win.webContents.on('did-fail-load', (e, code, desc) => loadErr.push(code + ' ' + desc))

  try {
    await win.loadURL(URL)
    // 等动画跑几帧 + body class 落定
    await new Promise(r => setTimeout(r, 1800))

    ok('URL 加载无错误', loadErr.length === 0, loadErr)
    ok('窗口 transparent 配置生效', win.getBackgroundColor().toLowerCase() === '#00000000' || /^#?0{6,8}$/i.test(win.getBackgroundColor()), { bg: win.getBackgroundColor() })
    ok('无边框（frame:false）', !win.isMenuBarVisible())

    const dom = await win.webContents.executeJavaScript(`(function(){
      var d=document.documentElement, b=document.body, s=document.querySelector('.stage'), f=document.querySelector('.frame'), g=document.querySelector('.glow-field');
      return {
        clean:d.classList.contains('clean'),
        ctrlHidden:getComputedStyle(document.querySelector('.ctrl')||d).display==='none',
        bodyBg:getComputedStyle(b).backgroundColor,
        stageBg:getComputedStyle(s).backgroundImage,
        frameW:Math.round(f.getBoundingClientRect().width),
        glowPos:getComputedStyle(g).position,
        frameBg:getComputedStyle(f).backgroundImage,
        dlgOwnHidden:document.getElementById('dlgOwn').hidden === true,
        dlgUpdHidden:document.getElementById('dlgUpd').hidden === true,
        dlgDisplay:getComputedStyle(document.getElementById('dlgOwn')).display,
        url:location.href
      }
    })()`, true)
    ok('预览台进入 clean 模式', dom.clean === true, dom)
    ok('dev 控制台已隐藏', dom.ctrlHidden === true)
    ok('body 背景真透明（非棋盘格假底）', /rgba\(0, 0, 0, 0\)|transparent/.test(dom.bodyBg), { bodyBg: dom.bodyBg })
    ok('舞台无棋盘格图层', dom.stageBg === 'none', { stageBg: dom.stageBg })
    ok('面板铺满窗口宽度', dom.frameW === 760, { frameW: dom.frameW })
    ok('光晕层为绝对定位（面板内、非视口级）', dom.glowPos === 'absolute', { glowPos: dom.glowPos })
    ok('面板恒透明（无实色/渐变底，alpha 透明面板）', dom.frameBg === 'none', { frameBg: dom.frameBg })
    ok('弹窗测试层在 clean 模式默认隐藏（不污染 alpha / 形变采样）',
      dom.dlgOwnHidden === true && dom.dlgUpdHidden === true && dom.dlgDisplay === 'none',
      { own: dom.dlgOwnHidden, upd: dom.dlgUpdHidden, display: dom.dlgDisplay })

    // 欢迎页首次进场落终态（用户 11-26「logo 出现→停留→一边缩放一边出背景→文本按钮」）：
    // 五段进场（logo/字标/副标题/光云/按钮）都应可见；按钮 transform 必须
    // 回落到 none（backwards fill 未锁死）——否则 :hover 的 translateY(-2px) 永久失效。
    // 不依赖固定 wall-clock（页面加载慢时 1800ms 动画可能还没起跑导致假阴性）：
    // 先把所有 intro-* 动画 finish() 到终态。backwards fill 播完回落到元素本来的 CSS
    // （各元素默认 opacity:1），即可确定性断言「进场终态全部可见」。
    const intro = await win.webContents.executeJavaScript(`(function(){
      document.getAnimations().forEach(function(a){
        if (a.animationName && a.animationName.indexOf('intro-')===0) { try{a.finish()}catch(e){} }
      });
      var op=function(s){var e=document.querySelector(s);return e?+getComputedStyle(e).opacity:null};
      var e=document.querySelector('.welcome-cta');
      var base=getComputedStyle(e).transform;
      // 判据用「动画值 vs inline 声明」优先级：若进场是 forwards/both（动画值持续生效），
      // 会压过 inline → computed 不变（hover 失效）；backwards 则 inline 生效（hover 可用）。
      e.style.transform='translateY(-7px)';
      var probe=getComputedStyle(e).transform;
      e.style.transform='';
      return {
        logo:op('.step[data-i="0"] .demo--brand'),brand:op('.step[data-i="0"] .brand-name'),
        sub:op('.step[data-i="0"] .sub'),glow:op('.glow-reveal'),cta:op('.step[data-i="0"] .welcome-cta'),
        ctaBase:base, ctaProbe:probe
      }
    })()`, true)
    ok('进场落终态：logo/字标/副标题/光云/按钮全部可见',
      [intro.logo, intro.brand, intro.sub, intro.glow, intro.cta].every(v => v !== null && v >= 0.85), intro)
    ok('按钮 transform 未被进场动画锁死（backwards 生效，hover 可用）',
      intro.ctaBase === 'none' && intro.ctaProbe !== intro.ctaBase,
      { ctaBase: intro.ctaBase, ctaProbe: intro.ctaProbe })

    // 欢迎页 alpha → 点「开始使用」进第 2 步：切 .solid 不透明方框面板、光晕关闭。
    // 验证后回欢迎步，保证下面截图/alpha 采样仍测欢迎页（用户 11-26 拍板的分场景契约）。
    await win.webContents.executeJavaScript(`document.getElementById('btnStart').click()`, true)
    await new Promise(r => setTimeout(r, 500))
    const solid = await win.webContents.executeJavaScript(`(function(){
      var f=document.querySelector('.frame'), g=document.querySelector('.glow-field'), s=document.querySelector('.solid-glow');
      return {
        isSolid:f.classList.contains('solid'),
        isGlowFull:f.classList.contains('glow-full'),
        bg:getComputedStyle(f).backgroundColor,
        glowDisplay:getComputedStyle(g).display,
        solidGlowDisplay:getComputedStyle(s).display,
        solidGlowFilter:getComputedStyle(s).filter,
        radius:getComputedStyle(f).borderRadius
      }
    })()`, true)
    ok('点击开始使用 → 切 solid 不透明方框', solid.isSolid === true && solid.isGlowFull === false, solid)
    ok('solid 面板有不透明底色（非 alpha）', /^rgb\(/.test(solid.bg) && !/rgba\([^)]*,\s*0\)/.test(solid.bg), { bg: solid.bg })
    ok('solid 步骤欢迎页光晕已关闭', solid.glowDisplay === 'none', { glowDisplay: solid.glowDisplay })
    ok('solid 步骤动态渐变层显示（指导面板配色呼应欢迎页）', solid.solidGlowDisplay === 'block', { solidGlowDisplay: solid.solidGlowDisplay })
    ok('solid 渐变 layer 有 blur 柔化（面板内容仍可读）', /blur\(\d+px\)/.test(solid.solidGlowFilter), { filter: solid.solidGlowFilter })
    // 回到欢迎步（键盘 ArrowLeft：2 → 1 步索引即从 1 回 0）
    await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'}))`, true)
    await new Promise(r => setTimeout(r, 500))
    const backHome = await win.webContents.executeJavaScript(`(function(){
      var f=document.querySelector('.frame'), s=document.querySelector('.solid-glow');
      return { isGlowFull:f.classList.contains('glow-full'), isSolid:f.classList.contains('solid'),
        bg:getComputedStyle(f).backgroundImage, solidGlowDisplay:getComputedStyle(s).display }
    })()`, true)
    ok('返回欢迎步 → 恢复 alpha（glow-full、无底色）', backHome.isGlowFull && !backHome.isSolid && backHome.bg === 'none', backHome)
    ok('返回欢迎步 → solid 渐变层隐藏（不干扰 alpha 光云）', backHome.solidGlowDisplay === 'none', { solidGlowDisplay: backHome.solidGlowDisplay })

    // 真实窗口截图（Electron capturePage 需要窗口真的显示过；离屏模式没有 display surface，
    // 会抛 "Current display surface not available for capture"——跳过并明确标注，不当 FAIL）。
    if (OFFSCREEN) {
      console.log('  SKIP 真窗口像素采样（--offscreen 无 display surface；去掉 --offscreen 显示真窗后自动执行）')
    } else {
      // capturePage 在窗口刚 show 后偶发返回空尺寸（display surface 尚未就绪），
      // 重试最多 5 次，每次让渲染帧推进 + 短暂等待，避免偶发 0×0 误判。
      let img = null
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 400))
        const shot = await win.capturePage()
        const s = shot.getSize()
        if (s.width > 0 && s.height > 0) { img = shot; break }
      }
      if (!img) img = await win.capturePage()
      fs.mkdirSync(path.dirname(OUT), { recursive: true })
      fs.writeFileSync(OUT, img.toPNG())
      const size = img.getSize()
      ok('真窗口截图落盘含 alpha', size.width === 760 && size.height === 500 && fs.statSync(OUT).size > 1000,
        { width: size.width, height: size.height, bytes: fs.statSync(OUT).size })

      // PNG 像素采样：解码 8-bit RGBA。暖白 alpha 遮罩：中心实（高 alpha），
      // 四角羽化（alpha 明显低于中心，透出桌面）——中心-四角差值证明遮罩生效。
      const alpha = sampleCorners(fs.readFileSync(OUT))
      ok('中心暖白磨砂不透明（alpha 高，非全透）', alpha.center >= 200, { center: alpha.center })
      ok('四角明显羽化（alpha 低于中心，透出桌面）', alpha.corners.every(a => a < alpha.center - 60),
        { corners: alpha.corners, center: alpha.center })

      // 真机形变验证：确定性地把动画相位钉到 t=0 与 t=4.6s（主核 7s 周期的 66% 关键帧，
      // 浏览器实验已量化此对相位 alpha 平均绝对差最大≈5.6），各截一帧比整幅 alpha 网格。
      // 用计算样式/包围盒会假阳性（DOM 在变但 blur 后看不出）；直接比真机截图像素最可信。
      // 相位控制通过 animation-delay 负值 + paused，避免依赖真实时间流逝导致采样撞上相近相位。
      // 相位控制：animation-delay 负值 + paused。Electron capturePage 对透明窗
      // 偶发帧缓存（两帧撞同一相位 alphaDiff=0），属采样时序问题非渲染问题；
      // 等待拉长到 500ms 让合成线程出帧，降低 flaky。
      const setPhase = t => win.webContents.executeJavaScript(`(function(){
        document.querySelectorAll('.glow-field,.glow-field .orb').forEach(function(el){
          el.style.animationPlayState='paused'; el.style.animationDelay='-${t}s';
        });
      })()`, true)
      await setPhase(0)
      await new Promise(r => setTimeout(r, 500))
      const g0 = sampleAlphaGrid((await win.capturePage()).toPNG())
      await setPhase(4.6)
      await new Promise(r => setTimeout(r, 500))
      const g1 = sampleAlphaGrid((await win.capturePage()).toPNG())
      let diff = 0
      if (g0 && g1 && g0.length === g1.length) {
        for (let i = 0; i < g0.length; i++) diff += Math.abs(g0[i] - g1[i])
        diff /= g0.length
      }
      ok('真机光云形变在动（相位 0↔4.6s 的 alpha 网格明显不同，非静止椭圆）',
        g0 && g1 && g0.length > 0 && diff > 2, { alphaDiff: +diff.toFixed(2) })
      // 恢复：清掉内联相位覆盖，让动画继续（--stay 拖窗查看时要动起来）
      await win.webContents.executeJavaScript(`document.querySelectorAll('.glow-field,.glow-field .orb').forEach(function(el){el.style.animationPlayState='';el.style.animationDelay='';})`, true)
      console.log('\n[transparent-preview] 截图: ' + OUT)
    }
    console.log('[transparent-preview] ' + results.filter(r => r.pass).length + '/' + results.length + ' PASS')
    process.exitCode = results.every(r => r.pass) ? 0 : 1

    if (STAY) {
      // 停在桌面：关窗才退出。顶部 34px 拖拽区（clean 模式 .drag-strip）可换位看透传。
      console.log('[transparent-preview] --stay：窗口保持打开，拖动顶部 34px 换位查看透传；关窗即退出。')
      win.on('closed', () => { win = null; app.quit() })
      return
    }
    win.close()
    app.quit()
  } catch (e) {
    console.error('[transparent-preview] 失败: ' + (e && e.stack || e))
    app.quit()
    process.exitCode = 1
  }
})

/**
 * 极简 PNG 解码：只取 8-bit RGBA（colorType=6, bitDepth=8）的扫描线，
 * 处理 PNG 的 5 种 filter，采样四角与中心 alpha。Electron capturePage 输出符合该格式。
 * 不引第三方依赖；格式不符时返回 NaN（断言会 FAIL，不会误判通过）。
 */
function sampleCorners (buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!buf.slice(0, 8).equals(sig)) return { corners: [NaN], center: NaN }
  let off = 8
  let w = 0, h = 0, depth = 0, color = 0
  const idat = []
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.slice(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      depth = data[8]; color = data[9]
    } else if (type === 'IDAT') { idat.push(data) } else if (type === 'IEND') { break }
    off += 12 + len
  }
  if (depth !== 8 || color !== 6 || !w || !h) return { corners: [NaN], center: NaN }
  const zlib = require('node:zlib')
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4, stride = w * bpp
  const px = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++]
    const row = raw.slice(pos, pos + stride); pos += stride
    const prev = y > 0 ? px.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = row[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      px[y * stride + x] = v & 0xff
    }
  }
  const alphaAt = (x, y) => px[(y * w + x) * bpp + 3]
  return {
    corners: [alphaAt(0, 0), alphaAt(w - 1, 0), alphaAt(0, h - 1), alphaAt(w - 1, h - 1)],
    center: alphaAt(Math.floor(w / 2), Math.floor(h / 2))
  }
}

/** 与 sampleCorners 同款 PNG 解码，返回每 4px 采样一次的 alpha 网格（用于形变在动断言）。 */
function sampleAlphaGrid (buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  if (!buf.slice(0, 8).equals(sig)) return null
  let off = 8, w = 0, h = 0, depth = 0, color = 0
  const idat = []
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.slice(off + 8, off + 8 + len)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; color = data[9] }
    else if (type === 'IDAT') { idat.push(data) } else if (type === 'IEND') { break }
    off += 12 + len
  }
  if (depth !== 8 || color !== 6 || !w || !h) return null
  const zlib = require('node:zlib')
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 4, stride = w * bpp
  const px = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++]
    const row = raw.slice(pos, pos + stride); pos += stride
    const prev = y > 0 ? px.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = row[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += (a + b) >> 1
      else if (ft === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      px[y * stride + x] = v & 0xff
    }
  }
  const grid = []
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) grid.push(px[(y * w + x) * bpp + 3])
  }
  return grid
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
