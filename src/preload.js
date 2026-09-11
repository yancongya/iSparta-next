// Preload: 仅桥接主进程 IPC，不直接 require fs/path/child_process（为 sandbox 铺路）
const { contextBridge, ipcRenderer } = require('electron')

const storagePathRef = { p: '' }

function sync (channel, ...args) {
  return ipcRenderer.sendSync(channel, ...args)
}

contextBridge.exposeInMainWorld('ispartaAPI', {
  ipc: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, callback) => {
      ipcRenderer.on(channel, (event, ...args) => callback(...args))
    }
  },
  fs: {
    existsSync: (p) => sync('fs:existsSync', p),
    readDataUrl: (p) => sync('fs:readDataUrl', p),
    ensureFileSync: (p) => sync('fs:ensureFileSync', p),
    ensureDirSync: (p) => sync('fs:ensureDirSync', p),
    readFileSync: (p, enc) => {
      const r = sync('fs:readFileSync', p, enc)
      if (!r || r.type === 'error') {
        throw new Error((r && r.error) || 'read failed')
      }
      if (r.type === 'bytes') {
        return Uint8Array.from(r.data)
      }
      return r.data
    },
    writeFileSync: (p, data, enc) => sync('fs:writeFileSync', p, data, enc),
    readdirSync: (p) => sync('fs:readdirSync', p),
    lstatSync: (p) => {
      const r = sync('fs:lstatSync', p)
      if (!r) { throw new Error('lstat failed') }
      return {
        isDirectory: () => !!r.isDirectory,
        isFile: () => !!r.isFile
      }
    },
    copy: (a, b) => ipcRenderer.invoke('fs:copy', a, b),
    copySync: (a, b) => sync('fs:copySync', a, b),
    writeFile: (p, data) => ipcRenderer.invoke('fs:writeFile', p, data),
    remove: (p) => ipcRenderer.invoke('fs:remove', p)
  },
  path: {
    join: (...args) => sync('path:join', args),
    dirname: (p) => sync('path:dirname', p),
    basename: (p, ext) => sync('path:basename', p, ext),
    get sep () { return sync('path:sep') }
  },
  os: {
    tmpdir: () => sync('os:tmpdir'),
    cpus: () => {
      const r = sync('os:cpus')
      return new Array(r && r.length ? r.length : 1).fill({})
    }
  },
  storage: {
    // 简易 JSON 文件存储（主进程 fs）
    setStoragePath: (p) => { sync('fs:ensureFileSync', p); storagePathRef.p = p },
    getItem: (key) => {
      const p = storagePathRef.p
      if (!p) { return null }
      let raw = null
      try {
        raw = sync('fs:readFileSync', p, 'utf8')
        if (raw && raw.type === 'text') { raw = raw.data }
        else { raw = null }
      } catch (e) { return null }
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
      const p = storagePathRef.p
      if (!p) { return }
      let obj = {}
      try {
        let raw = sync('fs:readFileSync', p, 'utf8')
        if (raw && raw.type === 'text') { raw = raw.data } else { raw = '{}' }
        obj = JSON.parse(raw || '{}') || {}
      } catch (e) {
        obj = {}
      }
      obj[key] = typeof value === 'string' ? value : JSON.stringify(value)
      sync('fs:writeFileSync', p, JSON.stringify(obj), 'utf8')
    }
  },
  process: {
    cwd: () => sync('process:cwd'),
    env: {
      get NODE_ENV () { return sync('process:nodeEnv') }
    }
  },
  childProcess: {
    execFile: (command, args, options) => {
      return ipcRenderer.invoke('job:execFile', command, args, options)
    }
  }
})
