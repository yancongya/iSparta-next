'use strict'

import { app, protocol, BrowserWindow, ipcMain, dialog, shell, Menu, net } from 'electron'
import {
  createProtocol
} from 'vue-cli-plugin-electron-builder/lib'
const isDevelopment = process.env.NODE_ENV !== 'production'
const path = require("path");
const fsp = require('fs');
const childProcess = require('child_process');
const os = require('os');
const { pathToFileURL } = require('url');
// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

let win

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
    icon:path.join(__static,"icons/icon.icns"),
    title:"iSparta-next",
    show: false,
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
  // 页面 <title> 会覆盖窗口标题，固定为 iSparta-next 以便与旧版 dev 区分
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
  win.once('ready-to-show', () => {
    win.setTitle('iSparta-next')
    win.show()
  })
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
app.on('ready', async () => {
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
ipcMain.handle('job:execFile', async (event, command, args, options) => {
  return new Promise((resolve) => {
    const opts = Object.assign({ maxBuffer: 1024 * 1024 * 64 }, options || {})
    childProcess.execFile(command, args || [], opts, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, error: String(err.message || err), stdout: String(stdout || ''), stderr: String(stderr || '') })
      } else {
        resolve({ ok: true, stdout: String(stdout || ''), stderr: String(stderr || '') })
      }
    })
  })
})

const menuTemplates = {
  'project-item': (payload) => {
    const items = []
    if (!payload.isMultiItems) {
      items.push(
        { id: 'openOriginal', label: payload.locale.openOriginal },
        { id: 'openDist', label: payload.locale.openDist },
        { id: 'changeDist', label: payload.locale.changeDist },
        { type: 'separator' }
      )
    }
    items.push({ id: 'delItem', label: payload.locale.delItem })
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
