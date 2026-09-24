/**
 * cep-bridge.js — CEP 侧 node-env 同形桥（exec / fs / path / storage + os/process/ipc）
 *
 * 对齐 src/util/node-env.js 导出形状，供 targets/cep 内调用；
 * W1 之后 processor/* 可直接挂本桥，不必复制业务。
 *
 * 优先 Node（manifest 已开 --enable-nodejs），缺失时用 window.cep.fs 兜底。
 * 注意：本文件是面板 Chromium 脚本，不是 ExtendScript，可用现代 JS。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.ispartaCepBridge = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  var nodeFs = null
  var nodePath = null
  var nodeOs = null
  var nodeCp = null
  var hasNode = false

  try {
    nodeFs = require('fs')
    nodePath = require('path')
    nodeOs = require('os')
    nodeCp = require('child_process')
    hasNode = true
  } catch (e) {
    hasNode = false
  }

  function cepFs () {
    return (typeof window !== 'undefined' && window.cep && window.cep.fs) || null
  }

  function ensureParentSync (p) {
    if (!hasNode || !nodePath) { return }
    var dir = nodePath.dirname(p)
    try {
      nodeFs.mkdirSync(dir, { recursive: true })
    } catch (e) { /* exists */ }
  }

  function ensureDirSync (p) {
    if (hasNode) {
      nodeFs.mkdirSync(p, { recursive: true })
      return
    }
    var c = cepFs()
    if (c && c.makedir) { c.makedir(p) }
  }

  function existsSync (p) {
    if (hasNode) {
      try { return nodeFs.existsSync(p) } catch (e) { return false }
    }
    var c = cepFs()
    if (c && c.exists) {
      var r = c.exists(p)
      return !!(r && r.data)
    }
    return false
  }

  function readFileSync (p, enc) {
    var encoding = null
    if (typeof enc === 'string') { encoding = enc }
    else if (enc && enc.encoding) { encoding = enc.encoding }
    if (hasNode) {
      if (encoding) { return nodeFs.readFileSync(p, encoding) }
      return nodeFs.readFileSync(p)
    }
    var c = cepFs()
    if (!c || !c.readFile) { throw new Error('fs.readFile unavailable') }
    var r = c.readFile(p, encoding || 'utf-8')
    if (!r || (r.err && r.err !== 0)) {
      throw new Error((r && r.err) || 'read failed: ' + p)
    }
    return r.data
  }

  function writeFileSync (p, data, enc) {
    ensureParentSync(p)
    if (hasNode) {
      return nodeFs.writeFileSync(p, data, enc || 'utf-8')
    }
    var c = cepFs()
    if (!c || !c.writeFile) { throw new Error('fs.writeFile unavailable') }
    var r = c.writeFile(p, String(data), enc || 'utf-8')
    if (r && r.err && r.err !== 0) {
      throw new Error(String(r.err))
    }
  }

  function readdirSync (p) {
    if (hasNode) { return nodeFs.readdirSync(p) }
    var c = cepFs()
    if (!c || !c.readdir) { return [] }
    var r = c.readdir(p)
    return (r && r.data) || []
  }

  function lstatSync (p) {
    if (hasNode) {
      var st = nodeFs.lstatSync(p)
      return {
        isDirectory: function () { return st.isDirectory() },
        isFile: function () { return st.isFile() }
      }
    }
    var c = cepFs()
    if (!c || !c.stat) { throw new Error('fs.stat unavailable') }
    var r = c.stat(p)
    var d = r && r.data
    return {
      isDirectory: function () { return !!(d && d.isDirectory) },
      isFile: function () { return !!(d && d.isFile) }
    }
  }

  function copySync (a, b) {
    ensureParentSync(b)
    if (hasNode) {
      nodeFs.copyFileSync(a, b)
      return
    }
    writeFileSync(b, readFileSync(a))
  }

  function copy (a, b) {
    return new Promise(function (resolve, reject) {
      // 同盘大帧优先硬链接（瞬时，不占双份磁盘）；跨盘/失败再异步 copy
      if (hasNode && nodeFs && typeof nodeFs.link === 'function') {
        nodeFs.link(a, b, function (linkErr) {
          if (!linkErr) {
            resolve({ ok: true, linked: true })
            return
          }
          if (hasNode && nodeFs && typeof nodeFs.copyFile === 'function') {
            nodeFs.copyFile(a, b, function (err) {
              if (err) { reject(err); return }
              resolve({ ok: true })
            })
            return
          }
          try {
            copySync(a, b)
            resolve({ ok: true })
          } catch (e2) {
            reject(e2)
          }
        })
        return
      }
      // 大图必须异步：copySync 会堵住面板，表现为「解析图片」假死
      if (hasNode && nodeFs && typeof nodeFs.copyFile === 'function') {
        nodeFs.copyFile(a, b, function (err) {
          if (err) {
            reject(err)
            return
          }
          resolve({ ok: true })
        })
        return
      }
      try {
        copySync(a, b)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  function writeFile (p, data) {
    return new Promise(function (resolve, reject) {
      try {
        writeFileSync(p, data)
        resolve()
      } catch (e) {
        reject(e)
      }
    })
  }

  function remove (p) {
    return new Promise(function (resolve) {
      if (hasNode) {
        try {
          nodeFs.rmSync(p, { recursive: true, force: true })
        } catch (e) { /* ignore */ }
        resolve()
        return
      }
      var c = cepFs()
      if (c && c.remove) {
        try { c.remove(p) } catch (e) { /* ignore */ }
      }
      resolve()
    })
  }

  function ensureFileSync (p) {
    if (existsSync(p)) { return }
    ensureParentSync(p)
    writeFileSync(p, '')
  }

  // 与 preload.statSize 同构；node-env 包装层把失败转成 -1
  function statSizeRaw (p) {
    try {
      if (hasNode) {
        var st = nodeFs.statSync(p)
        return { ok: true, size: st.size }
      }
      var c = cepFs()
      if (c && c.stat) {
        var r = c.stat(p)
        var d = r && r.data
        if (d && d.size !== undefined && d.size !== null) {
          return { ok: true, size: Number(d.size) }
        }
      }
      return { ok: false }
    } catch (e) {
      return { ok: false }
    }
  }

  function statSize (p) {
    var r = statSizeRaw(p)
    return (r && r.ok) ? r.size : -1
  }

  function readDataUrl (p) {
    try {
      if (hasNode) {
        var buf = nodeFs.readFileSync(p)
        var ext = String(p).toLowerCase().split('.').pop()
        var mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
          : ext === 'webp' ? 'image/webp'
            : ext === 'gif' ? 'image/gif' : 'image/png'
        return {
          ok: true,
          dataUrl: 'data:' + mime + ';base64,' + buf.toString('base64')
        }
      }
      return { ok: false }
    } catch (e) {
      return { ok: false }
    }
  }

  var fs = {
    existsSync: existsSync,
    ensureFileSync: ensureFileSync,
    ensureDirSync: ensureDirSync,
    readFileSync: readFileSync,
    writeFileSync: writeFileSync,
    readdirSync: readdirSync,
    lstatSync: lstatSync,
    copy: copy,
    copySync: copySync,
    writeFile: writeFile,
    remove: remove,
    statSize: statSize,
    readDataUrl: readDataUrl
  }

  var path = {
    join: function () {
      if (hasNode) { return nodePath.join.apply(nodePath, arguments) }
      return Array.prototype.slice.call(arguments).filter(Boolean).join('/').replace(/\/{2,}/g, '/')
    },
    dirname: function (p) {
      if (hasNode) { return nodePath.dirname(p) }
      var s = String(p).replace(/\/+$/, '')
      var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
      return i < 0 ? '.' : s.slice(0, i) || '/'
    },
    basename: function (p, ext) {
      if (hasNode) { return nodePath.basename(p, ext) }
      var s = String(p).replace(/[\\/]+$/, '')
      var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
      s = i < 0 ? s : s.slice(i + 1)
      if (ext && s.length > ext.length && s.slice(-ext.length) === ext) {
        s = s.slice(0, -ext.length)
      }
      return s
    },
    get sep () {
      if (hasNode) { return nodePath.sep }
      return (typeof navigator !== 'undefined' && /win/i.test(navigator.platform || '')) ? '\\' : '/'
    }
  }

  var os = {
    tmpdir: function () {
      if (hasNode && nodeOs) { return nodeOs.tmpdir() }
      return path.join('/tmp')
    },
    cpus: function () {
      if (hasNode && nodeOs && nodeOs.cpus) {
        var list = nodeOs.cpus()
        return new Array(list && list.length ? list.length : 1).fill({})
      }
      return [{}]
    }
  }

  // JSON 文件存储：与 preload 完全同构（getItem 只返回 string|null）
  var storagePathRef = { p: '' }
  var storage = {
    setStoragePath: function (p) {
      ensureFileSync(p)
      storagePathRef.p = p
    },
    getItem: function (key) {
      var p = storagePathRef.p
      if (!p) { return null }
      var raw = null
      try {
        raw = readFileSync(p, 'utf-8')
      } catch (e) {
        return null
      }
      try {
        var obj = JSON.parse(raw || '{}')
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
          var v = obj[key]
          return typeof v === 'string' ? v : JSON.stringify(v)
        }
        return null
      } catch (e) {
        return null
      }
    },
    setItem: function (key, value) {
      var p = storagePathRef.p
      if (!p) { return }
      var obj = {}
      try {
        obj = JSON.parse(readFileSync(p, 'utf-8') || '{}') || {}
      } catch (e) {
        obj = {}
      }
      obj[key] = typeof value === 'string' ? value : JSON.stringify(value)
      writeFileSync(p, JSON.stringify(obj), 'utf-8')
    }
  }

  /**
   * 与 background.js job:execFile 同形结果：
   * 成功 { ok:true, stdout, stderr }
   * 失败 { ok:false, cancelled?, error, stdout, stderr }
   */
  function execFile (command, args, options) {
    return new Promise(function (resolve) {
      if (!hasNode || !nodeCp) {
        resolve({
          ok: false,
          error: 'child_process unavailable: need --enable-nodejs',
          stdout: '',
          stderr: ''
        })
        return
      }
      var opts = Object.assign({
        maxBuffer: 1024 * 1024 * 64,
        timeout: 30 * 60 * 1000
      }, options || {})
      var child = nodeCp.execFile(command, args || [], opts, function (err, stdout, stderr) {
        var idx = runningProcs.indexOf(child)
        if (idx >= 0) { runningProcs.splice(idx, 1) }
        if (err) {
          var msg = String((err && err.message) || err)
          resolve({
            ok: false,
            cancelled: /killed|terminated|abort/i.test(msg),
            timedOut: /timeout|ETIMEDOUT/i.test(msg) || err.code === 'ETIMEDOUT',
            error: msg,
            stdout: String(stdout || ''),
            stderr: String(stderr || '')
          })
          return
        }
        resolve({
          ok: true,
          stdout: String(stdout || ''),
          stderr: String(stderr || '')
        })
      })
      runningProcs.push(child)
    })
  }

  // 供 processor/Action.ipc.invoke('job:execFile', ...) 直接挂载
  var appPathRef = { value: null }
  var appPathListeners = []
  var runningProcs = []

  function extensionAppPath () {
    try {
      var cs = (typeof window !== 'undefined' && window.ispartaCS) || null
      if (cs && cs.getExtensionPath) {
        var p = cs.getExtensionPath()
        if (p) { return p }
      }
    } catch (e) { /* fall through */ }
    // Node 侧脚本才有 __dirname；浏览器 script 标签加载时退回空
    var dir = (typeof __dirname === 'string' && __dirname) || ''
    return dir ? path.join(dir, '..') : ''
  }

  var ipc = {
    invoke: function (channel) {
      var rest = Array.prototype.slice.call(arguments, 1)
      if (channel === 'job:execFile') {
        return execFile(rest[0], rest[1], rest[2])
      }
      if (channel === 'job:cancelAll') {
        var n = runningProcs.length
        for (var i = 0; i < runningProcs.length; i++) {
          try { runningProcs[i].kill() } catch (e) { /* ignore */ }
        }
        runningProcs.length = 0
        return Promise.resolve({ ok: true, killed: n })
      }
      return Promise.reject(new Error('unsupported ipc channel: ' + channel))
    },
    send: function (channel) {
      if (channel === 'get-app-path') {
        appPathRef.value = extensionAppPath()
        for (var i = 0; i < appPathListeners.length; i++) {
          try { appPathListeners[i](appPathRef.value) } catch (e) { /* ignore */ }
        }
      }
    },
    on: function (channel, cb) {
      if (channel === 'got-app-path') {
        appPathListeners.push(cb)
        // action.js 里 send 在 on 之前：迟到订阅者也要立刻拿到 appPath
        if (appPathRef.value !== null) {
          try { cb(appPathRef.value) } catch (e) { /* ignore */ }
        }
      }
    }
  }

  var processBridge = {
    cwd: function () {
      if (hasNode) { return process.cwd() }
      return '/'
    },
    env: {
      get NODE_ENV () {
        return (hasNode && process.env && process.env.NODE_ENV) || 'production'
      }
    }
  }

  var childProcess = {
    execFile: execFile
  }

  // RenderSmith forge.js 拷贝：aerender 启停 / PROGRESS / ETA / 挂起检测
  var aerender = null
  try {
    if (typeof require === 'function') {
      aerender = require('./forge.js')
    }
  } catch (eForge) { /* 浏览器无 require */ }
  if (!aerender && typeof window !== 'undefined' && window.ispartaForge) {
    aerender = window.ispartaForge
  }

  var api = {
    hasNode: hasNode,
    fs: fs,
    path: path,
    os: os,
    storage: storage,
    exec: execFile,
    execFile: execFile,
    ipc: ipc,
    process: processBridge,
    childProcess: childProcess,
    aerender: aerender
  }

  // 注入 ispartaAPI：processor/* 经 node-env 只认这个形状（docs/BRIDGE.md）
  if (typeof window !== 'undefined' && !window.ispartaAPI) {
    window.ispartaAPI = {
      fs: fs,
      path: path,
      os: os,
      storage: storage,
      ipc: ipc,
      process: processBridge,
      childProcess: childProcess,
      aerender: aerender
    }
  }
  if (typeof window !== 'undefined') {
    window.ispartaCepBridge = api
  }
  return api
})
