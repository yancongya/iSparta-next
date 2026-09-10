// Preload: 仅向渲染进程暴露白名单 API（Phase2 M2）
// 注意：preload 无 localStorage，storage 用 fs 自实现，避免 electron-localstorage 崩溃
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')
const childProcess = require('child_process')

let storagePath = ''

function readStorageFile () {
  if (!storagePath) { return null }
  try {
    if (!fs.existsSync(storagePath)) {
      fs.writeFileSync(storagePath, '{}', 'utf8')
    }
    return fs.readFileSync(storagePath, 'utf8')
  } catch (e) {
    return null
  }
}

function writeStorageFile (raw) {
  if (!storagePath) { return }
  try {
    fs.writeFileSync(storagePath, String(raw), 'utf8')
  } catch (e) { /* ignore */ }
}

const fsBridge = {
  existsSync: (p) => fs.existsSync(p),
  ensureFileSync: (p) => {
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, '', 'utf8')
    }
  },
  ensureDirSync: (p) => {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true })
    }
  },
  readFileSync: (p, enc) => {
    const buf = fs.readFileSync(p, enc)
    if (!enc && buf && typeof buf.length === 'number') {
      return new Uint8Array(buf)
    }
    return buf
  },
  writeFileSync: (p, data, enc) => fs.writeFileSync(p, data, enc),
  readdirSync: (p) => fs.readdirSync(p),
  lstatSync: (p) => {
    const st = fs.lstatSync(p)
    return {
      isDirectory: () => st.isDirectory(),
      isFile: () => st.isFile()
    }
  },
  copy: (a, b) => {
    return new Promise((resolve, reject) => {
      try {
        const dir = path.dirname(b)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        fs.copyFileSync(a, b)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  },
  copySync: (a, b) => {
    const dir = path.dirname(b)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.copyFileSync(a, b)
  },
  writeFile: (p, data) => {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFileSync(p, data)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  },
  remove: (p) => {
    return new Promise((resolve) => {
      try {
        fs.rmSync(p, { recursive: true, force: true })
        resolve()
      } catch (e) {
        resolve()
      }
    })
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
  fs: fsBridge,
  path: {
    join: (...args) => path.join(...args),
    dirname: (p) => path.dirname(p),
    basename: (p, ext) => path.basename(p, ext),
    sep: path.sep
  },
  os: {
    tmpdir: () => os.tmpdir(),
    cpus: () => os.cpus()
  },
  storage: {
    setStoragePath: (p) => {
      storagePath = p
      readStorageFile()
    },
    getItem: (key) => {
      const raw = readStorageFile()
      if (raw == null) { return null }
      try {
        const obj = JSON.parse(raw || '{}')
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
          const v = obj[key]
          return typeof v === 'string' ? v : JSON.stringify(v)
        }
        return null
      } catch (e) {
        return null
      }
    },
    setItem: (key, value) => {
      let obj = {}
      try {
        obj = JSON.parse(readStorageFile() || '{}') || {}
      } catch (e) {
        obj = {}
      }
      // electron-localstorage 习惯：对象会 stringify 一次存字符串
      obj[key] = typeof value === 'string' ? value : JSON.stringify(value)
      writeStorageFile(JSON.stringify(obj))
    }
  },
  process: {
    cwd: () => process.cwd(),
    env: {
      NODE_ENV: process.env.NODE_ENV
    }
  },
  childProcess: {
    execFile: (command, args, options, callback) => {
      return childProcess.execFile(command, args, options, callback)
    }
  }
})
