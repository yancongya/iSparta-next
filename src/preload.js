// Preload: 仅向渲染进程暴露白名单 API（Phase2 M2）
const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const storage = require('electron-localstorage')
const childProcess = require('child_process')

const fsBridge = {
  existsSync: (p) => fs.existsSync(p),
  ensureFileSync: (p) => fs.ensureFileSync(p),
  ensureDirSync: (p) => fs.ensureDirSync(p),
  readFileSync: (p, enc) => {
    const buf = fs.readFileSync(p, enc)
    // contextBridge 无法可靠传递 Buffer，二进制改走 Uint8Array
    if (!enc && buf && typeof buf.length === 'number') {
      return new Uint8Array(buf)
    }
    return buf
  },
  writeFileSync: (p, data, enc) => fs.writeFileSync(p, data, enc),
  readdirSync: (p) => fs.readdirSync(p),
  lstatSync: (p) => fs.lstatSync(p),
  copy: (a, b) => fs.copy(a, b),
  copySync: (a, b) => fs.copySync(a, b),
  writeFile: (p, data) => fs.writeFile(p, data),
  remove: (p) => fs.remove(p)
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
    setStoragePath: (p) => storage.setStoragePath(p),
    getItem: (k) => storage.getItem(k),
    setItem: (k, v) => storage.setItem(k, v)
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
