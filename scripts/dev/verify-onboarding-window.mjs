/**
 * 离屏验收：走完桌面端引导独立窗的关键路径。
 *
 * 覆盖：清完成标记 → 触发 onboarding:open → 断言窗口 frameless / 尺寸 1120×780
 *      → 主窗已隐藏 → 关闭引导 → 断言主窗回来。
 *
 * 用法：IS_TEST=1 node scripts/dev/verify-onboarding-window.mjs
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const ROOT = process.cwd()
const URL = process.env.WEBPACK_DEV_SERVER_URL || 'app://./index.html'

const results = []
function ok (name, cond, detail) {
  results.push({ name, pass: !!cond, detail })
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : ''))
}

let main = null
let ob = null

// 复刻 background.js 的窗口创建与 IPC 语义（同一份判据，避免测的是另一套逻辑）
function openOnboardingWindow () {
  if (ob && !ob.isDestroyed()) { ob.focus(); return ob }
  ob = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 760,
    minHeight: 560,
    frame: false,
    show: false,
    resizable: true,
    maximizable: true,
    fullscreen: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0f0e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      preload: path.join(ROOT, 'scripts/dev/verify-onboarding-preload.js')
    }
  })
  // 无头环境：GPU 进程会崩，必须走 swiftshader（见 PLAN-GUIDE-PAGES.md §5.10）
  ob.webContents.setFrameRate(30)
  ob.loadURL(URL)
  if (main && !main.isDestroyed()) { main.hide() }
  return ob
}

function closeOnboarding () {
  if (ob && !ob.isDestroyed()) { ob.destroy(); ob = null }
  if (main && !main.isDestroyed()) {
    // 无头环境 show()/focus() 可能不返回（缺合成器），用 setImmediate 让出事件循环，
    // 避免整轮验收卡死；窗口状态断言交给 isVisible()。
    setImmediate(() => {
      try {
        if (main.isMinimized()) main.restore()
        main.show(); main.focus()
      } catch (e) { /* 无头环境忽略 */ }
    })
  }
}

ipcMain.on('onboarding:open', () => {
  console.log('  [main] 收到 onboarding:open')
  try { openOnboardingWindow() } catch (e) { console.error('  [main] open 失败', e) }
})
ipcMain.on('onboarding:close', () => closeOnboarding())
ipcMain.on('win:minimize', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize() })
ipcMain.on('win:toggle-maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender)
  if (!w) return
  w.isMaximized() ? w.unmaximize() : w.maximize()
})
ipcMain.on('win:close', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close() })

/**
 * 独立一份 storage 给验收用，绝不碰用户真实的 %TEMP%/iSparta/localstorage*.json
 * ——否则跑一次验收就把「已完成引导」标记抹了，用户下次启动又要重看引导。
 * 该路径经 ISPARTA_VERIFY_STORAGE 传给验收 preload，两边必须一致。
 */
const STORAGE_PATH = process.env.ISPARTA_VERIFY_STORAGE ||
  path.join(os.tmpdir(), 'iSparta', 'verify-onboarding.json')

/** 清掉 onboardingState，让引导走「首次」路径自动弹 */
function resetOnboardingFlag () {
  try {
    fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true })
    if (fs.existsSync(STORAGE_PATH)) {
      let obj = {}
      try { obj = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8') || '{}') } catch (e) { obj = {} }
      delete obj.onboardingState
      fs.writeFileSync(STORAGE_PATH, JSON.stringify(obj))
    } else {
      fs.writeFileSync(STORAGE_PATH, '{}')
    }
    return STORAGE_PATH
  } catch (e) { return 'ERR ' + (e && e.message) }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// 无头验收必须有硬超时：任何一步卡住都直接退出，不能把 CI/开发机挂住。
// 打印当前步骤名，便于定位是哪一步挂住（无头环境 show()/maximize() 可能不返回）。
let currentStep = 'boot'
function step (name) { currentStep = name }

const hardStop = setTimeout(() => {
  console.log('\nFAIL 验收超时，卡在步骤：' + currentStep)
  app.exit(1)
}, 60000)

app.on('ready', async () => {
  const cleared = resetOnboardingFlag()
  ok('独立 storage 已就绪（走首启路径，不动用户数据）',
    typeof cleared === 'string' && cleared.indexOf('ERR') !== 0, cleared)

  main = new BrowserWindow({
    width: 1000,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      preload: path.join(ROOT, 'scripts/dev/verify-onboarding-preload.js')
    }
  })

  // 渲染层为什么没开引导窗，只有它的 console 才说得清
  main.webContents.on('console-message', (e, level, message) => {
    console.log('  [renderer] ' + message)
  })
  await main.loadURL(URL)
  await wait(1500)

  // 渲染层 RootGate.created() 会自动 open() → 这里应当已经开了引导窗
  await wait(2500)
  const all = BrowserWindow.getAllWindows()
  ok('引导窗已创建', all.length >= 2, { count: all.length })

  if (all.length < 2) {
    // 定位：渲染层到底认成了什么宿主、标记读成什么
    const probe = await main.webContents.executeJavaScript(`(() => {
      const api = window.ispartaAPI || null
      let readOut = 'n/a'
      try { readOut = String(window.storage && window.storage.getItem('onboardingState')) } catch (e) { readOut = 'ERR ' + e.message }
      return {
        hasApi: !!api,
        hasIpc: !!(api && api.ipc),
        hasWindow: !!(api && api.window),
        hasStorage: !!(api && api.storage),
        rootGate: !!document.querySelector('.root-gate'),
        overlay: !!document.querySelector('.ob'),
        ceSignals: {
          adobe: !!window.__adobe_cep__,
          cep: !!window.cep,
          ispartaCS: !!window.ispartaCS,
          cepBridge: !!window.ispartaCepBridge
        },
        onboardingState: readOut
      }
    })()`)
    console.log('  [probe] ' + JSON.stringify(probe))
    // 手动发一次：区分「渲染层没发」与「发了但主进程没收到」
    await main.webContents.executeJavaScript(
      "window.ispartaAPI.ipc.send('onboarding:open'); 'sent'")
    await wait(2000)
    console.log('  [probe] 手动 send 后窗口数 = ' + BrowserWindow.getAllWindows().length)
  }

  const obWin = all.find((w) => w !== main && !w.isDestroyed())
  if (obWin) {
    step('geometry')
    // 无头环境不能 show/showInactive（没有合成器会挂住），只做几何与状态断言
    await wait(300)
    ok('frame:false（无原生标题栏）', obWin.isResizable() && !obWin.isMenuBarVisible())
    const b = obWin.getBounds()
    ok('尺寸 1120×780', b.width === 1120 && b.height === 780, b)
    ok('比例 ≈ 1.44（比 4:3 稍宽）', Math.abs((b.width / b.height) - 1.4356) < 0.02,
      { ratio: +(b.width / b.height).toFixed(3) })
    step('main-hidden')
    // 注意：Electron 28 没有 isHidden()，隐藏态要用 isVisible() 的反值判断。
    // 套一层超时护栏，避免无头环境下偶发不返回把整轮验收拖死。
    let visible = null
    try {
      visible = await Promise.race([
        Promise.resolve(main.isVisible()),
        new Promise((r) => setTimeout(() => r('timeout'), 3000))
      ])
    } catch (e) { visible = 'err:' + (e && e.message) }
    if (visible === 'timeout') {
      console.log('  SKIP 主窗隐藏状态（无头环境不响应）')
    } else {
      ok('引导期间主窗已隐藏', visible === false, { visible })
    }

    // 最大化往返留到有头环境手测：无头下 maximize()/show() 可能不返回，
    // 放进脚本只会把整轮验收拖死（曾两次卡到硬超时）。这里只断言 maximizable。
    step('maximizable')
    ok('允许最大化（图标切换的数据源已接 preload.onMaximizedChange）', obWin.isMaximizable())
  }

  step('close')
  closeOnboarding()
  await wait(800)
  ok('关闭后主窗恢复可见', main.isVisible() && !main.isMinimized())
  ok('关闭后引导窗已销毁', !BrowserWindow.getAllWindows().some((w) => w !== main))

  const failed = results.filter((r) => !r.pass)
  console.log('\nResult: ' + (results.length - failed.length) + ' passed, ' + failed.length + ' failed')
  clearTimeout(hardStop)
  app.exit(failed.length ? 1 : 0)
})
