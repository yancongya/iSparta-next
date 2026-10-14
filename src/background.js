'use strict'

import { app, protocol, BrowserWindow, ipcMain, dialog, shell, Menu, net } from 'electron'
import {
  createProtocol
} from 'vue-cli-plugin-electron-builder/lib'
import { APP_NAME } from './brand'
import { checkUpdate, isAllowedExternalUrl, makeCheckDeps } from './util/updateCheck'
import { registerAutoUpdateIpc } from './util/autoUpdate'
import { ensureCepExtension } from './util/cepSync'
import { ensurePlayerDebugMode } from './util/cepDebugMode'
import { markOnboardingDone } from './util/onboarding-replay'
const isDevelopment = process.env.NODE_ENV !== 'production'
const path = require("path");
const fsp = require('fs');
const childProcess = require('child_process');
const os = require('os');
const https = require('https');
const { pathToFileURL } = require('url');
// package.json productName 为显示名唯一来源；开发态若未生效则用 brand 兜底
if (app.getName() !== APP_NAME) {
  app.setName(APP_NAME)
}
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let win

// ---------------------------------------------------------------- 首启引导
// 桌面端引导走**独立无边框小窗**，不是主窗口上的浮层：
//   · frame:false 去掉原生标题栏 —— 软件名与最小化/最大化/关闭三个系统按钮
//     一并消失，窗口按钮改由 Onboarding.vue 在面板内自绘（沉浸式）。
//   · 尺寸 1120×780 ≈ 1.44:1，比 4:3 稍宽一档：末页 2×2 卡片能横排，
//     且纵向空间够放完「动图 + 标题 + 说明 + 卡片」，不必滚动。
//   · 主窗口在引导期间隐藏，屏幕上只剩引导一扇窗（否则背后会露出主窗口的原生标题栏）。
// CEP 端没有自己的窗口，引导仍是 AE 面板内的浮层 —— 见 RootGate.vue 的分流。
const OB_WIDTH = 1120
const OB_HEIGHT = 780

// 桌面启动先等主界面渲染层完成引导判定，再显示工作台或直接打开引导窗。
// 这样首次安装 / 更新后的用户不会先看到一张没有真实进度的 loading 窗。
let pendingOnboarding = false
let mainUiReady = false
let mainWindowReady = false
let startupDone = false
let startupFallbackTimer = null

let onboardingWin = null
/** 引导窗是否由渲染层主动收尾（finish/skip → onboarding:close）关闭；否则按用户关窗处理 */
let onboardingClosedClean = false

/** 把工作台还回来：引导结束 / 用户关掉引导窗 / 引导窗异常都走这里 */
function showMainWindow () {
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) { win.restore() }
    win.show()
    win.focus()
  }
}

/**
 * 等 Electron 主窗首帧与 RootGate 的引导判定都就绪后再显示窗口。
 * 若渲染层异常未发 app:ready，8 秒后显示主界面，避免启动时一直黑屏。
 */
function finishStartup (force) {
  if (startupDone) { return }
  if (!force && (!mainUiReady || !mainWindowReady)) { return }
  startupDone = true
  if (startupFallbackTimer) { clearTimeout(startupFallbackTimer); startupFallbackTimer = null }

  if (pendingOnboarding) {
    pendingOnboarding = false
    openOnboardingWindow()
    return
  }
  if (win && !win.isDestroyed()) {
    win.setTitle(app.getName() + ' ' + app.getVersion())
    showMainWindow()
  }
}

/** 引导小窗的 webPreferences 与主窗一致（sandbox + contextIsolation，preload 桥） */
function onboardingWebPreferences () {
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    enableRemoteModule: false,
    webSecurity: false,
    preload: path.join(__dirname, 'preload.js')
  }
}

/**
 * 打开（或聚焦）引导小窗。渲染层只发 `onboarding:open`，窗口生命周期全在主进程：
 * 重复调用只做聚焦，避免叠开多扇窗。
 */
function openOnboardingWindow () {
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    if (onboardingWin.isMinimized()) { onboardingWin.restore() }
    onboardingWin.focus()
    return onboardingWin
  }

  onboardingWin = new BrowserWindow({
    width: OB_WIDTH,
    height: OB_HEIGHT,
    // 允许用户缩到「两列卡片还能横排」的极限，再窄由面板内的 480px 断点兜单列
    minWidth: 760,
    minHeight: 560,
    // frame:false —— 没有原生标题栏，软件名与系统按钮都不会出现；
    // 窗口按钮由 Onboarding.vue 在面板内自绘（沉浸式），拖拽靠顶栏的 app-region: drag
    frame: false,
    show: false,
    resizable: true,
    maximizable: true,
    fullscreen: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0f0e',
    icon: path.join(__static, 'icons/icon.' + (process.platform === 'win32' ? 'ico'
      : process.platform === 'darwin' ? 'icns' : 'png')),
    webPreferences: onboardingWebPreferences()
  })

  onboardingWin.on('closed', () => {
    onboardingWin = null
    // 用系统关闭按钮（win 自绘按钮走 win:close → 同上）或 Alt+F4 关窗时，
    // 渲染层**不会**走 onboarding.finish()，于是：
    //   · 主窗还停在 hide 状态 → 应用看起来「闪退」了（其实只是没有可见窗口）；
    //   · 完成标记没写 → 下次启动又弹一遍。
    // 关窗一律视为「用户主动结束引导」：补写标记 + 把工作台还回来。
    if (!onboardingClosedClean) {
      try { markOnboardingDone() } catch (e) { /* 写不进去最多下次再弹 */ }
      showMainWindow()
    }
    onboardingClosedClean = false
  })
  bindMaximizeState(onboardingWin)

  if (process.env.WEBPACK_DEV_SERVER_URL) {
    onboardingWin.loadURL(process.env.WEBPACK_DEV_SERVER_URL + '#/onboarding')
    if (!process.env.IS_TEST) onboardingWin.webContents.openDevTools()
  } else {
    createProtocol('app')
    // ⚠ 必须是 #/onboarding：加载 '/' 会让 RootGate 把工作台渲染进这扇窗
    // （根路由的引导浮层只对 CEP 为真），引导窗里出现的是一份空态工作台。
    onboardingWin.loadURL('app://./index.html#/onboarding')
  }

  // 引导期间把主窗收起来：背后露出主窗的原生标题栏会立刻破掉沉浸感
  if (win && !win.isDestroyed()) { win.hide() }

  onboardingWin.once('ready-to-show', () => {
    if (!onboardingWin || onboardingWin.isDestroyed()) { return }
    onboardingWin.show()
  })

  return onboardingWin
}

// RootGate 已完成 storage / 引导状态判定。
ipcMain.on('app:ready', () => {
  mainUiReady = true
  finishStartup()
})

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } },
  // sandbox 下渲染层不能 file://，用自定义协议读本地帧缩略图
  {
    scheme: 'isparta-file',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

function mediaPathFromUrl (requestUrl) {
  let p = decodeURIComponent(requestUrl.replace(/^isparta-file:/, '').replace(/^\/\//, '/'))
  // /E:/foo -> E:/foo
  if (/^\/[A-Za-z]:/.test(p)) {
    p = p.slice(1)
  }
  return p
}


function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    minWidth: 820,
    minHeight: 800,
    // 三栏结构（列表 + 工具条 + 输出设置）下 820 默认宽会让右侧表单很挤，
    // 默认给到 1000；minWidth 仍是 820，小屏与手动收窄不受影响
    width: 1000,
    height: 800, 
    // 图标必须按平台给格式：写死 .icns 时 Windows 读不到，窗口与任务栏会回落成
    // Electron 默认图标。exe 文件自身的图标由 electron-builder 的 rcedit 负责，另一回事。
    icon: path.join(__static, 'icons/icon.' + (process.platform === 'win32' ? 'ico'
      : process.platform === 'darwin' ? 'icns' : 'png')),
    // 主窗口去掉原生标题栏：软件名 + 版本号移到自绘顶部横条（IsWinBar），
    // 最小化/最大化/关闭由渲染层自绘，走 win:* 三个通道。
    // 与首启引导独立窗（createOnboardingWindow 的 frame:false）同一套做法。
    //
    // mac 例外：titleBarStyle:'hiddenInset' 保留左上角红绿灯，只去掉标题栏文字。
    //  macOS 的 frame:false 会连系统按钮与全屏手势一起失去（引导窗目前就是那样），
    //  主窗口是长期使用的主界面，不能跟着退化。
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : { frame: false }),
    title: app.getName() + ' ' + app.getVersion(),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      enableRemoteModule: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    } })
  
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    // Load the url of the dev server if in development mode
    win.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
    if (!process.env.IS_TEST) win.webContents.openDevTools()
  } else {
    createProtocol('app')
    
    // Load the index.html when not in development
    win.loadURL('app://./index.html')
  }

  win.on('closed', () => {
    win = null
  })
  // 自绘标题栏去掉了原生最大化图标切换，靠 win:maximized 回推给渲染层
  bindMaximizeState(win)
  // 页面 <title> 会覆盖窗口标题，统一锁到 productName + 版本号
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
  win.once('ready-to-show', () => {
    win.setTitle(app.getName() + ' ' + app.getVersion())
    mainWindowReady = true
    if (startupDone) {
      if (!onboardingWin || onboardingWin.isDestroyed()) { showMainWindow() }
      return
    }
    finishStartup()
  })
  // RootGate 异常时仍放行主界面；正常启动由 app:ready 与 ready-to-show 协调。
  if (startupFallbackTimer) { clearTimeout(startupFallbackTimer) }
  startupFallbackTimer = setTimeout(() => { finishStartup(true) }, 8000)
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// 不设置时 Electron 会挂上默认的 File/Edit/View/Window/Help 菜单，
// 对这种单窗口工具是噪音；macOS 必须保留一份精简菜单，否则没有 Cmd+Q 与粘贴。
function setupApplicationMenu () {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  const name = app.getName()
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: name, submenu: [{ role: 'close' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ] }
  ]))
}

app.on('ready', async () => {
  setupApplicationMenu()
  protocol.handle('isparta-file', (request) => {
    try {
      const filePath = mediaPathFromUrl(request.url)
      if (!filePath || !fsp.existsSync(filePath)) {
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (e) {
      return new Response(String(e && e.message || e), { status: 500 })
    }
  })

  if (isDevelopment && !process.env.IS_TEST) {
    // Install Vue Devtools
    // Devtools extensions are broken in Electron 6.0.0 and greater
    // See https://github.com/nklayman/vue-cli-plugin-electron-builder/issues/378 for more info
    // Electron will not launch with Devtools extensions installed on Windows 10 with dark mode
    // If you are not using Windows 10 dark mode, you may uncomment these lines
    // In addition, if the linked issue is closed, you can upgrade electron and uncomment these lines
    // try {
    //   await installVueDevtools()
    // } catch (e) {
    //   console.error('Vue Devtools failed to install:', e.toString())
    // }

  }
  // 只建主窗；RootGate 判定为首次启动 / 更新后时会直接引导打开现成指导页。
  createWindow()
})

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', data => {
      if (data === 'graceful-exit') {
        app.quit()
      }
    })
  } else {
    process.on('SIGTERM', () => {
      app.quit()
    })
  }
}

// ---- 首启引导（桌面独立无边框小窗）----
// 渲染层不直接 new BrowserWindow，只发意图；窗口显示/隐藏/销毁都在这里收口，
// 保证「引导在前、工作台在后」的层级关系不会被渲染层搞乱。
ipcMain.on('onboarding:open', function () {
  // 首帧 / RootGate 判定未完成时先排队，避免主窗与引导窗同时闪现。
  if (!startupDone) {
    pendingOnboarding = true
    finishStartup()
    return
  }
  try {
    openOnboardingWindow()
  } catch (e) {
    console.error('[onboarding] open failed:', e && e.message)
    if (win && !win.isDestroyed()) { win.show() }
  }
})

// 引导关闭（走完 / 跳过）：销毁小窗并把工作台还回来
ipcMain.on('onboarding:close', function () {
  // 先打标：渲染层主动收尾，'closed' 里就不要再补写完成标记（finish 已写）
  onboardingClosedClean = true
  if (onboardingWin && !onboardingWin.isDestroyed()) {
    // 走正常 close 才会触发 'closed' → 置空引用；这里同步兜底，双保险
    onboardingWin.destroy()
    onboardingWin = null
  }
  showMainWindow()
})

// 无边框窗口的按钮由渲染层自绘，主进程只提供「最小化/最大化/关闭」三个动作。
// 一律以 event.sender 反查窗口，不信任渲染层传 id。
ipcMain.on('win:minimize', function (event) {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w) { w.minimize() }
})

ipcMain.on('win:toggle-maximize', function (event) {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (!w) { return }
  if (w.isMaximized()) {
    w.unmaximize()
  } else {
    w.maximize()
  }
})

ipcMain.on('win:close', function (event) {
  const w = BrowserWindow.fromWebContents(event.sender)
  if (w) { w.close() }
})

// 最大化状态会因双击标题栏 / Win+↑ / 拖到屏幕边缘变化，回推给渲染层切图标
function bindMaximizeState (target) {
  const push = () => {
    if (target.isDestroyed()) { return }
    // isMaximized() 在 macOS 全屏下为 false，但红绿灯此时隐藏、需要收掉 padding，
    // 所以把全屏也算进「展开态」一起推
    target.webContents.send('win:maximized', target.isMaximized() || target.isFullScreen())
  }
  target.on('maximize', push)
  target.on('unmaximize', push)
  target.on('enter-full-screen', push)
  target.on('leave-full-screen', push)
}

ipcMain.on('change-item-fold', function (event, path, order) {
  dialog.showOpenDialog(win, {
    defaultPath: path,
    properties: ['openDirectory']
  }).then(function (result) {
    if (!result.canceled && result.filePaths.length) {
      event.sender.send('change-item-fold', result.filePaths, order)
    }
  })
})
// 监听输出到目录的操作
ipcMain.on('change-multiItem-fold', function (event, path) {
  dialog.showOpenDialog(win, {
    defaultPath: path,
    properties: ['openDirectory']
  }).then(function (result) {
    if (!result.canceled && result.filePaths.length) {
      event.sender.send('change-multiItem-fold', result.filePaths)
    }
  })
})
// 监听获取应用目录的操作
ipcMain.on('get-app-path', function (event) {
  event.sender.send('got-app-path', app.getAppPath())
})

// Phase1: replace electron.remote with IPC

ipcMain.handle('dialog:openFiles', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(win, {
    defaultPath: options.defaultPath,
    properties: options.properties || ['openFile', 'openDirectory', 'multiSelections']
  })
  return { canceled: result.canceled, filePaths: result.filePaths }
})

ipcMain.handle('dialog:openDirectory', async (event, options = {}) => {
  const result = await dialog.showOpenDialog(win, {
    defaultPath: options.defaultPath,
    properties: ['openDirectory']
  })
  return { canceled: result.canceled, filePaths: result.filePaths }
})

ipcMain.handle('shell:showItemInFolder', async (event, fullPath) => {
  if (typeof fullPath === 'string' && fullPath) {
    shell.showItemInFolder(fullPath)
  }
})

ipcMain.handle('shell:openPath', async (event, fullPath) => {
  if (typeof fullPath !== 'string' || !fullPath) {
    return '目录路径无效'
  }
  // shell.openPath 打开目标目录本身；showItemInFolder 则会打开其父目录并选中目标。
  return shell.openPath(fullPath)
})

function appleScriptLiteral (value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"'
}

ipcMain.handle('clipboard:copyFiles', async (event, inputPaths) => {
  const files = Array.from(new Set(Array.isArray(inputPaths) ? inputPaths : []))
    .filter((value) => typeof value === 'string' && path.isAbsolute(value))
  if (!files.length) { return { ok: false, error: '没有有效的输出文件' } }
  try {
    for (const file of files) {
      if (!fsp.statSync(file).isFile()) { return { ok: false, error: '输出文件不存在：' + file } }
    }
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) }
  }

  let command
  let args
  if (process.platform === 'win32') {
    const json = Buffer.from(JSON.stringify(files), 'utf8').toString('base64')
    const script = 'Add-Type -AssemblyName System.Windows.Forms; $paths = @([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String("' + json + '") ) | ConvertFrom-Json); $list = New-Object System.Collections.Specialized.StringCollection; foreach ($p in $paths) { [void]$list.Add([string]$p) }; [Windows.Forms.Clipboard]::SetFileDropList($list)'
    command = 'powershell.exe'
    args = ['-NoProfile', '-STA', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')]
  } else if (process.platform === 'darwin') {
    command = '/usr/bin/osascript'
    args = ['-e', 'set the clipboard to {' + files.map(function (file) {
      return '(POSIX file ' + appleScriptLiteral(file) + ' as alias)'
    }).join(', ') + '}']
  } else {
    return { ok: false, error: '当前系统暂不支持复制文件到剪贴板' }
  }

  return new Promise((resolve) => {
    childProcess.execFile(command, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: String(stderr || error.message || error) })
      } else {
        resolve({ ok: true })
      }
    })
  })
})

// --- 更新检查：主进程注入层 ---
// 渲染层保持离线，外部请求只发生在这里；判定逻辑全在 util/updateCheck.js（可脱离 Electron 测试）
const UPDATE_UA = 'isparta-next-updater'
const UPDATE_TIMEOUT_MS = 12000
const http = require('http')

// 用 Node http(s) 而不是 Electron net：实测 net 在 redirect:'manual' 下会直接抛
// "Redirect was cancelled"，拿不到 302 的 Location；Node 的 request 本身不跟随重定向，
// 正好能直接读到 302 + Location，这是「零 API 配额拿版本号」的前提。
// 必须按协议分流：fixture 用 http://localhost，只走 https 会直接连不上。
function httpRequest (method, url, timeoutMs, headers) {
  return new Promise(function (resolve, reject) {
    var settled = false
    var timer = null
    function finish (fn, arg) {
      if (settled) { return }
      settled = true
      if (timer) { clearTimeout(timer) }
      fn(arg)
    }
    var mod = String(url).indexOf('http://') === 0 ? http : https
    var hreq = mod.request(url, {
      method: method,
      headers: Object.assign({ 'User-Agent': UPDATE_UA, Accept: '*/*' }, headers || {})
    }, function (res) {
      var raw = res.headers ? res.headers.location : undefined
      var location = Array.isArray(raw) ? raw[0] : (raw || null)
      if (method === 'HEAD') {
        // HEAD 无 body，等 'end' 会挂住：状态与头到手就结算
        res.resume()
        finish(resolve, { status: res.statusCode, location: location, text: '' })
        return
      }
      var body = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { body += c })
      res.on('end', function () { finish(resolve, { status: res.statusCode, location: location, text: body }) })
      res.on('error', function (e) { finish(reject, e) })
    })
    var ms = timeoutMs || UPDATE_TIMEOUT_MS
    timer = setTimeout(function () {
      try { hreq.destroy() } catch (e) { /* ignore */ }
      // destroy 不一定 emit error，必须自己 reject，否则 Promise 永不结算
      finish(reject, new Error('timeout'))
    }, ms)
    hreq.on('timeout', function () { try { hreq.destroy() } catch (e) {} })
    hreq.on('error', function (e) { finish(reject, e) })
    hreq.end()
  })
}

ipcMain.handle('updater:meta', async () => {
  return {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    // 仅开发/测试注入时非空；展示层默认仍用 version
    forcedVersion: process.env.ISPARTA_FORCE_VERSION || ''
  }
})

ipcMain.handle('updater:check', async (event, payload) => {
  // deps 由 updateCheck.makeCheckDeps 统一构造（与 CEP 桥、浏览器兜底同一处映射），
  // 主进程只注入自身特有的传输层（node http）与宿主事实（app.getVersion / process.*）。
  return checkUpdate(makeCheckDeps(payload || {}, {
    env: process.env,
    // 允许用 env 覆盖当前版本来模拟旧版，避免为了测试去改 package.json
    currentVersion: process.env.ISPARTA_FORCE_VERSION || app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    timeoutMs: UPDATE_TIMEOUT_MS,
    fetchHead: async function (url) {
      var r = await httpRequest('HEAD', url, UPDATE_TIMEOUT_MS)
      return { status: r.status, location: r.location }
    },
    fetchJson: async function (url) {
      // GitHub API 无 UA 直接 403，会被误判成限流
      var r = await httpRequest('GET', url, UPDATE_TIMEOUT_MS, { Accept: 'application/vnd.github+json' })
      var json = null
      try { json = JSON.parse(r.text) } catch (e) { json = null }
      return { status: r.status, json: json }
    }
  }))
})

ipcMain.handle('shell:openExternal', async (event, url) => {
  if (typeof url !== 'string' || !url) { return { opened: false, reason: 'empty' } }
  // 白名单：origin + /<repo>/ 前缀，拒绝 .. 与非 http(s)
  if (!isAllowedExternalUrl(url, process.env)) { return { opened: false, reason: 'not-allowed' } }
  try {
    await shell.openExternal(url)
    return { opened: true }
  } catch (e) {
    return { opened: false, reason: 'failed' }
  }
})

// electron-updater 自动下载 / 重启安装（Win NSIS / Linux AppImage；dev 与 mac 不启用）
registerAutoUpdateIpc()
// 双端一起更：启动 / 热更安装完成后自检 CEP 落盘，与 resources/cep payload 对齐
try {
  const cepSyncResult = ensureCepExtension({
    appVersion: app.getVersion(),
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    env: process.env,
    home: os.homedir(),
    commonFiles: process.env.CommonProgramFiles
  })
  if (cepSyncResult && cepSyncResult.refreshed) {
    console.log('[cep-sync] refreshed', cepSyncResult.reason, cepSyncResult.dest, cepSyncResult.version)
  }
  // macOS 没有 NSIS 组件页可写 PlayerDebugMode，扩展落盘后用 payload 自带脚本补上
  const cepDebugResult = ensurePlayerDebugMode({
    platform: process.platform,
    dest: cepSyncResult && cepSyncResult.dest,
    payloadDir: cepSyncResult && cepSyncResult.payloadDir,
    refreshed: !!(cepSyncResult && cepSyncResult.refreshed)
  })
  if (cepDebugResult.applied) {
    console.log('[cep-debug] applied', cepDebugResult.script)
  } else if (cepDebugResult.reason !== 'nsis-installer' && cepDebugResult.reason !== 'already-applied') {
    console.warn('[cep-debug] skip', cepDebugResult.reason, cepDebugResult.error || '')
  }
} catch (eCepSync) {
  console.warn('[cep-sync] skip', String(eCepSync && eCepSync.message || eCepSync))
}

// --- Phase3/4: Node fs / path / os / execFile 均在主进程 ---
function ensureDir (dir) {
  if (!dir) { return }
  fsp.mkdirSync(dir, { recursive: true })
}

ipcMain.on('fs:existsSync', (event, p) => {
  try { event.returnValue = fsp.existsSync(p) } catch (e) { event.returnValue = false }
})
ipcMain.on('fs:statSize', (event, p) => {
  try {
    const st = fsp.statSync(p)
    event.returnValue = { ok: true, size: st.size }
  } catch (e) {
    event.returnValue = { ok: false, size: 0, error: String(e && e.message || e) }
  }
})
// 缩略图：主进程读文件转 data URL，避免 sandbox/file 协议问题
ipcMain.on('fs:readDataUrl', (event, p) => {
  try {
    const buf = fsp.readFileSync(p)
    const ext = path.extname(String(p)).toLowerCase()
    let mime = 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') { mime = 'image/jpeg' } else if (ext === '.gif') { mime = 'image/gif' } else if (ext === '.webp') { mime = 'image/webp' }
    event.returnValue = { ok: true, dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64') }
  } catch (e) {
    event.returnValue = { ok: false, error: String(e && e.message || e) }
  }
})
ipcMain.on('fs:readdirSync', (event, p) => {
  try { event.returnValue = fsp.readdirSync(p) } catch (e) { event.returnValue = [] }
})
ipcMain.on('fs:lstatSync', (event, p) => {
  try {
    const st = fsp.lstatSync(p)
    event.returnValue = { isDirectory: st.isDirectory(), isFile: st.isFile() }
  } catch (e) {
    event.returnValue = null
  }
})
ipcMain.on('fs:readFileSync', (event, p, enc) => {
  try {
    const buf = fsp.readFileSync(p, enc)
    if (!enc && buf) {
      event.returnValue = { type: 'bytes', data: Array.from(buf) }
    } else {
      event.returnValue = { type: 'text', data: buf }
    }
  } catch (e) {
    event.returnValue = { type: 'error', error: String(e && e.message || e) }
  }
})
ipcMain.on('fs:writeFileSync', (event, p, data, enc) => {
  try {
    ensureDir(path.dirname(p))
    if (data && data.type === 'bytes' && Array.isArray(data.data)) {
      fsp.writeFileSync(p, Buffer.from(data.data), enc)
    } else {
      fsp.writeFileSync(p, data, enc)
    }
    event.returnValue = true
  } catch (e) {
    event.returnValue = false
  }
})
ipcMain.on('fs:ensureFileSync', (event, p) => {
  try {
    ensureDir(path.dirname(p))
    if (!fsp.existsSync(p)) { fsp.writeFileSync(p, '', 'utf8') }
    event.returnValue = true
  } catch (e) {
    event.returnValue = false
  }
})
ipcMain.on('fs:ensureDirSync', (event, p) => {
  try { ensureDir(p); event.returnValue = true } catch (e) { event.returnValue = false }
})
ipcMain.on('fs:copySync', (event, a, b) => {
  try {
    ensureDir(path.dirname(b))
    fsp.copyFileSync(a, b)
    event.returnValue = true
  } catch (e) {
    event.returnValue = false
  }
})
ipcMain.on('fs:removeSync', (event, p) => {
  try {
    fsp.rmSync(p, { recursive: true, force: true })
    event.returnValue = true
  } catch (e) {
    event.returnValue = true
  }
})
ipcMain.on('path:join', (event, parts) => {
  event.returnValue = path.join(...(parts || []))
})
ipcMain.on('path:dirname', (event, p) => {
  event.returnValue = path.dirname(p)
})
ipcMain.on('path:basename', (event, p, ext) => {
  event.returnValue = path.basename(p, ext)
})
ipcMain.on('path:sep', (event) => {
  event.returnValue = path.sep
})
ipcMain.on('os:tmpdir', (event) => {
  event.returnValue = os.tmpdir()
})
ipcMain.on('os:cpus', (event) => {
  const cpus = os.cpus()
  event.returnValue = { length: cpus.length }
})
ipcMain.on('process:cwd', (event) => {
  event.returnValue = process.cwd()
})
ipcMain.on('process:nodeEnv', (event) => {
  event.returnValue = process.env.NODE_ENV
})
ipcMain.on('job:execFileSync', (event, command, args, options) => {
  try {
    const opts = Object.assign({ maxBuffer: 1024 * 1024 * 64 }, options || {})
    const stdout = childProcess.execFileSync(command, args || [], opts)
    event.returnValue = { ok: true, stdout: stdout ? stdout.toString() : '' }
  } catch (e) {
    event.returnValue = {
      ok: false,
      error: String(e && e.message || e),
      stdout: e && e.stdout ? e.stdout.toString() : '',
      stderr: e && e.stderr ? e.stderr.toString() : ''
    }
  }
})
ipcMain.handle('fs:copy', async (event, a, b) => {
  ensureDir(path.dirname(b))
  fsp.copyFileSync(a, b)
})
ipcMain.handle('fs:writeFile', async (event, p, data) => {
  ensureDir(path.dirname(p))
  fsp.writeFileSync(p, data)
})
ipcMain.handle('fs:remove', async (event, p) => {
  try { fsp.rmSync(p, { recursive: true, force: true }) } catch (e) { /* ignore */ }
})
// 运行中的转换子进程：用于右键「终止任务」
const runningJobs = new Set()

ipcMain.handle('job:execFile', async (event, command, args, options) => {
  return new Promise((resolve) => {
    // 大动画下 apngquant/apngasm 可能跑很久；无超时会永久挂住表现为「进度不动」
    const opts = Object.assign({
      maxBuffer: 1024 * 1024 * 64,
      timeout: 30 * 60 * 1000
    }, options || {})
    let child = null
    let settled = false
    const finish = (payload) => {
      if (settled) { return }
      settled = true
      if (child) { runningJobs.delete(child) }
      resolve(payload)
    }
    child = childProcess.execFile(command, args || [], opts, (err, stdout, stderr) => {
      if (err) {
        const msg = String(err.message || err)
        finish({
          ok: false,
          cancelled: /killed|terminated|abort/i.test(msg),
          timedOut: /timeout|ETIMEDOUT/i.test(msg) || err.code === 'ETIMEDOUT',
          error: msg,
          stdout: String(stdout || ''),
          stderr: String(stderr || '')
        })
      } else {
        finish({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') })
      }
    })
    if (child) { runningJobs.add(child) }
  })
})

ipcMain.handle('job:cancelAll', async () => {
  let killed = 0
  runningJobs.forEach((child) => {
    try {
      if (child && !child.killed) {
        child.kill('SIGTERM')
        killed++
      }
    } catch (e) { /* ignore */ }
  })
  runningJobs.clear()
  return { ok: true, killed }
})

const menuTemplates = {
  'project-item': (payload) => {
    const items = []
    const locale = (payload && payload.locale) || {}
    if (!payload.isMultiItems && !payload.isRunning) {
      items.push(
        { id: 'openOriginal', label: locale.openOriginal },
        { id: 'openDist', label: locale.openDist },
        { id: 'changeDist', label: locale.changeDist },
        { type: 'separator' }
      )
    }
    if (payload.isRunning) {
      items.push({ id: 'stopItem', label: locale.stopItem || 'Stop task' })
    }
    items.push({ id: 'delItem', label: locale.delItem })
    return items
  }
}

ipcMain.on('menu:popup', (event, { menuId, x, y, payload }) => {
  const build = menuTemplates[menuId]
  if (!build) { return }
  const template = build(payload || {}).map((item) => {
    if (item.type === 'separator') { return item }
    return Object.assign({}, item, {
      click: () => {
        event.sender.send('menu:clicked', {
          menuId,
          action: item.id,
          payload
        })
      }
    })
  })
  const menu = Menu.buildFromTemplate(template)
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender) || win, x, y })
})
