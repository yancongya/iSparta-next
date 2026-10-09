// 验收专用 preload：把 ispartaAPI 缩到引导窗与 storage 真正用到的那几个方法，
// 使离屏验收走的是「electron 宿主」分支。
//
// 为什么必须自带 storage：node-env 的 storage 走 preload 的 fs 桥；
// 若只给 ipc，storage.getItem 抛错 → onboarding/state.js 的 readRecord 返回
// ok:false → isDone() 判「已完成」→ 引导永不自动弹，验收会假报「窗口没创建」。
//
// ⚠ storage 文件名必须与 src/store/index.js 一致（dev = localstorage-dev.json），
//   否则写标记写到另一个文件，表现为「清了标记但引导不弹」。
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

const STORAGE_PATH = process.env.ISPARTA_VERIFY_STORAGE ||
  path.join(os.tmpdir(), 'iSparta', 'localstorage-dev.json')

function readAll () {
  try {
    return JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8') || '{}')
  } catch (e) { return {} }
}

function writeAll (obj) {
  fs.mkdirSync(path.dirname(STORAGE_PATH), { recursive: true })
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(obj))
}

const storage = {
  setStoragePath: () => { /* 路径在本文件里已定 */ },
  getItem: (key) => {
    const obj = readAll()
    if (!Object.prototype.hasOwnProperty.call(obj, key)) { return null }
    const v = obj[key]
    return typeof v === 'string' ? v : JSON.stringify(v)
  },
  setItem: (key, value) => {
    const obj = readAll()
    obj[key] = typeof value === 'string' ? value : JSON.stringify(value)
    writeAll(obj)
  }
}

contextBridge.exposeInMainWorld('ispartaAPI', {
  ipc: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    }
  },
  window: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    onMaximizedChange: (callback) => {
      const listener = (event, value) => callback(!!value)
      ipcRenderer.on('win:maximized', listener)
      return () => ipcRenderer.removeListener('win:maximized', listener)
    }
  },
  storage,
  fs: {
    existsSync: (p) => fs.existsSync(p),
    ensureFileSync: (p) => {
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true })
        fs.writeFileSync(p, '')
      }
      return true
    },
    readFileSync: (p, enc) => {
      if (!fs.existsSync(p)) { return '' }
      return enc === 'utf8' || enc === 'utf-8' ? fs.readFileSync(p, 'utf8') : fs.readFileSync(p)
    },
    writeFileSync: (p, data, enc) => {
      fs.mkdirSync(path.dirname(p), { recursive: true })
      fs.writeFileSync(p, enc === 'utf8' || enc === 'utf-8' ? String(data) : data)
      return true
    },
    readdirSync: (p) => (fs.existsSync(p) ? fs.readdirSync(p) : []),
    statSize: (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0)
  },
  path: {
    join: (...args) => path.join(...args),
    dirname: (p) => path.dirname(p),
    basename: (p, ext) => path.basename(p, ext),
    get sep () { return path.sep }
  },
  os: { tmpdir: () => os.tmpdir() },
  process: {
    cwd: () => process.cwd(),
    env: { NODE_ENV: 'development' },
    versions: { electron: '28.3.3' }
  }
})
