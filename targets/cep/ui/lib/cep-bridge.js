/**
 * cep-bridge.js — CEP 侧 node-env 同形桥（exec / fs / path / storage + os/process/ipc）
 *
 * 对齐 src/util/node-env.js 导出形状，供 targets/cep 内调用；
 * W1 之后 processor/* 可直接挂本桥，不必复制业务。
 *
 * ipc.invoke 支持的 channel：
 *   job:execFile / job:cancelAll / get-app-path
 *   updater:meta / updater:http / updater:download / updater:downloadState
 *   updater:cancelDownload / updater:runInstaller / shell:openExternal
 * 更新判定与文案都在渲染层（src/util/updateCheck + cepUpdater），桥只做网络与落盘。
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

  /**
   * ---------- 更新链路（CEP 侧不跑 electron-updater） ----------
   * 双端一体更：面板只负责「查新版 → 后台下官方安装包 → 唤起安装向导」，
   * AE 扩展目录由 NSIS 组件页一起刷新（build/installer.nsh），装完需重启 AE 生效。
   * 网络与落盘全在 Node（--enable-nodejs），判定逻辑仍在渲染层 src/util/*，桥不提供业务。
   */
  var UPDATE_UA = 'iSparta-next-cep'
  var UPDATE_TIMEOUT_MS = 12000
  var UPDATE_MAX_REDIRECTS = 5
  // 外链 / 下载白名单：只认 GitHub 与自家 Pages 落地页
  var UPDATE_HOST_RE = /^https:\/\/(?:[\w.-]+\.)*github(?:\.com|usercontent\.com)(?:\/|$)/i
  var LANDING_HOST_RE = /^https:\/\/[\w.-]*\.github\.io\/iSparta-next(?:\/|$)/i

  function reqModule (name) {
    if (!hasNode) { return null }
    try { return require(name) } catch (e) { return null }
  }

  /** 与 background.js httpRequest 同形：不自动跟随重定向（302 Location 是版本真相源） */
  function httpOnce (url, opts, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var nodeHttp = reqModule('http')
      var nodeHttps = reqModule('https')
      if (!nodeHttp || !nodeHttps) { reject(new Error('node http unavailable')); return }
      var settled = false
      var timer = null
      function finish (fn, arg) {
        if (settled) { return }
        settled = true
        if (timer) { clearTimeout(timer) }
        fn(arg)
      }
      var mod = String(url).indexOf('http://') === 0 ? nodeHttp : nodeHttps
      var rq = mod.request(url, opts, function (res) {
        var raw = res.headers ? res.headers.location : undefined
        var location = Array.isArray(raw) ? raw[0] : (raw || null)
        var body = ''
        if (opts.method === 'HEAD' || opts.headOnly) {
          res.resume()
          finish(resolve, { status: res.statusCode, location: location, headers: res.headers })
          return
        }
        res.setEncoding('utf8')
        res.on('data', function (c) { body += c })
        res.on('end', function () {
          finish(resolve, { status: res.statusCode, location: location, text: body, headers: res.headers })
        })
        res.on('error', function (e) { finish(reject, e) })
      })
      rq.on('socket', function (sock) {
        if (sock && typeof sock.setTimeout === 'function') { sock.setTimeout(timeoutMs) }
      })
      rq.on('timeout', function () {
        try { rq.destroy() } catch (e) { /* ignore */ }
        finish(reject, new Error('timeout'))
      })
      rq.on('error', function (e) { finish(reject, e) })
      rq.end()
    })
  }

  /**
   * updater:http —— 渲染层拿它当 checkUpdate 的 fetchHead / fetchJson / fetchText。
   * @returns {Promise<{status, location, text}>} 重定向交回调用方判断（最多跟 UPDATE_MAX_REDIRECTS 跳）
   */
  function httpRequest (opts) {
    var o = opts || {}
    var url = String(o.url || '')
    if (!/^https?:\/\//i.test(url)) { return Promise.reject(new Error('bad url')) }
    var method = String(o.method || 'GET').toUpperCase()
    var timeoutMs = Number(o.timeoutMs) || UPDATE_TIMEOUT_MS
    var maxHops = Number(o.maxRedirects)
    var hops = isFinite(maxHops) && maxHops >= 0 ? maxHops : UPDATE_MAX_REDIRECTS
    var headers = Object.assign({ 'User-Agent': UPDATE_UA, Accept: '*/*' }, o.headers || {})
    function step (u, left) {
      return httpOnce(u, { method: method, headers: headers }, timeoutMs).then(function (r) {
        var st = r.status || 0
        if (st >= 300 && st < 400 && r.location && left > 0) {
          var next = /^https?:/i.test(r.location)
            ? r.location
            : require('url').resolve(u, r.location)
          return step(next, left - 1)
        }
        return r
      })
    }
    return step(url, hops)
  }

  function isAllowedExtUrl (url) {
    return UPDATE_HOST_RE.test(url) || LANDING_HOST_RE.test(url)
  }

  function openExternal (url) {
    var u = String(url || '')
    if (!isAllowedExtUrl(u)) {
      return Promise.resolve({ opened: false, reason: 'not-allowed' })
    }
    var win = typeof window !== 'undefined' ? window : null
    try {
      if (win && win.ispartaCS && typeof win.ispartaCS.openURLInDefaultBrowser === 'function') {
        return Promise.resolve({ opened: !!win.ispartaCS.openURLInDefaultBrowser(u) })
      }
    } catch (e) { /* fall through */ }
    try {
      if (win && win.cep && win.cep.util && win.cep.util.openURLInDefaultBrowser) {
        win.cep.util.openURLInDefaultBrowser(u)
        return Promise.resolve({ opened: true })
      }
    } catch (e2) { /* fall through */ }
    // 铁律：CEP 禁止 location.href 兜底（会把面板导航走）
    return Promise.resolve({ opened: false, reason: 'no-host-api' })
  }

  /** 已安装扩展的版本（installer/prepare-cep 写的 version.json）；拿不到回 '' */
  function installedExtVersion () {
    try {
      var root = extensionAppPath()
      if (!root) { return '' }
      var raw = readFileSync(nodePath.join(root, 'version.json'), 'utf-8')
      var doc = JSON.parse(raw || '{}')
      return (doc && doc.version) || ''
    } catch (e) { return '' }
  }

  function updateMeta () {
    var ver = installedExtVersion()
    return Promise.resolve({
      version: ver,
      platform: hasNode ? process.platform : '',
      arch: hasNode ? process.arch : '',
      hasNode: hasNode,
      cep: true
    })
  }

  /** 安装包下载态（单任务：AE 面板里同时只跑一个更新） */
  var dl = {
    active: false,
    downloading: false,
    downloaded: false,
    progress: 0,
    received: 0,
    total: 0,
    error: null,
    file: '',
    verified: false,
    startedAt: 0
  }
  var dlReq = null
  var dlStream = null
  var dlHash = null

  function dlSnapshot () {
    return {
      active: dl.active,
      downloading: dl.downloading,
      downloaded: dl.downloaded,
      progress: dl.progress,
      received: dl.received,
      total: dl.total,
      error: dl.error,
      file: dl.file,
      verified: dl.verified,
      supported: hasNode,
      startedAt: dl.startedAt
    }
  }

  function dlFinish (err) {
    dl.active = false
    dl.downloading = false
    if (err) {
      dl.error = String((err && err.message) || err)
      dl.downloaded = false
    }
    try { if (dlStream && dlStream.close) { dlStream.close() } } catch (e) { /* ignore */ }
    try { if (dlReq && dlReq.destroy) { dlReq.destroy() } } catch (e2) { /* ignore */ }
    dlStream = null
    dlReq = null
  }

  function dlFollow (url, left, onRes) {
    var nodeHttps = reqModule('https')
    var nodeHttp = reqModule('http')
    if (!nodeHttps || !nodeHttp) { onRes(new Error('node http unavailable'), null); return }
    var mod = String(url).indexOf('http://') === 0 ? nodeHttp : nodeHttps
    var rq = mod.get(url, { headers: { 'User-Agent': UPDATE_UA } }, function (res) {
      var st = res.statusCode || 0
      var loc = res.headers && res.headers.location
      var next = Array.isArray(loc) ? loc[0] : loc
      if (st >= 300 && st < 400 && next && left > 0) {
        res.resume()
        var abs = /^https?:/i.test(next) ? next : require('url').resolve(url, next)
        dlFollow(abs, left - 1, onRes)
        return
      }
      onRes(null, { req: rq, res: res })
    })
    rq.on('error', function (e) { onRes(e, null) })
  }

  /**
   * updater:download —— 流式下整包（GitHub release 资产，约 100MB），边写边算 sha512。
   * opts: { url, file, sha512? , timeoutMs }
   */
  function startDownload (opts) {
    var o = opts || {}
    var nodeCrypto = reqModule('crypto')
    if (!hasNode || !nodeFs || !nodeCrypto) {
      return Promise.resolve({ ok: false, reason: 'no-node' })
    }
    var url = String(o.url || '')
    if (!UPDATE_HOST_RE.test(url)) {
      return Promise.resolve({ ok: false, reason: 'not-allowed' })
    }
    if (dl.active) { return Promise.resolve({ ok: false, reason: 'busy', state: dlSnapshot() }) }
    var dest = String(o.file || '')
    if (!dest) { return Promise.resolve({ ok: false, reason: 'no-dest' }) }
    var part = dest + '.part'
    try {
      ensureDirSync(nodePath.dirname(dest))
      if (existsSync(dest)) { nodeFs.unlinkSync(dest) }
      dlStream = nodeFs.createWriteStream(part)
    } catch (eDest) {
      return Promise.resolve({ ok: false, reason: 'fs-error', error: String(eDest.message || eDest) })
    }
    dl.active = true
    dl.downloading = true
    dl.downloaded = false
    dl.error = null
    dl.progress = 0
    dl.received = 0
    dl.total = Number(o.total) || 0
    dl.file = dest
    dl.verified = false
    dl.startedAt = Date.now()
    dlHash = nodeCrypto.createHash('sha512')

    dlFollow(url, UPDATE_MAX_REDIRECTS, function (err, ctx) {
      if (err || !ctx) { dlFinish(err || new Error('request failed')); return }
      var st = (ctx.res && ctx.res.statusCode) || 0
      if (st < 200 || st >= 300) {
        try { ctx.res.resume() } catch (e) { /* ignore */ }
        dlFinish(new Error('http ' + st))
        return
      }
      dlReq = ctx.req
      var len = Number(ctx.res.headers && ctx.res.headers['content-length']) || 0
      if (len > dl.total) { dl.total = len }
      ctx.res.on('data', function (chunk) {
        try { dlHash.update(chunk) } catch (eH) { /* ignore */ }
        dlStream.write(chunk)
        dl.received += chunk.length
        if (dl.total > 0) {
          dl.progress = Math.min(99, Math.floor((dl.received / dl.total) * 100))
        }
      })
      ctx.res.on('error', function (e) { dlFinish(e) })
      ctx.res.on('end', function () {
        dlStream.end(function () {
          var digest = dlHash.digest('base64')
          var expected = String(o.sha512 || '')
          if (expected && expected !== digest) {
            try { nodeFs.unlinkSync(part) } catch (e) { /* ignore */ }
            dlFinish(new Error('sha512 mismatch'))
            return
          }
          try {
            nodeFs.renameSync(part, dest)
          } catch (eRe) {
            dlFinish(eRe)
            return
          }
          dl.downloading = false
          dl.active = false
          dl.downloaded = true
          dl.progress = 100
          dl.verified = !!expected
          dl.total = dl.received
        })
      })
    })
    return Promise.resolve({ ok: true, state: dlSnapshot() })
  }

  function cancelDownload () {
    if (!dl.active) { return Promise.resolve({ ok: true, state: dlSnapshot() }) }
    dlFinish(new Error('cancelled'))
    return Promise.resolve({ ok: true, state: dlSnapshot() })
  }

  /** updater:runInstaller —— 起 NSIS 向导后立即撒手（detached + unref），不阻塞面板 */
  function runInstaller (opts) {
    var o = opts || {}
    if (!hasNode || !nodeCp) { return Promise.resolve({ ok: false, reason: 'no-node' }) }
    var file = String(o.file || dl.file || '')
    if (!file) { return Promise.resolve({ ok: false, reason: 'no-file' }) }
    if (!existsSync(file)) { return Promise.resolve({ ok: false, reason: 'missing-file', file: file }) }
    try {
      var child = nodeCp.spawn(file, o.args || [], { detached: true, stdio: 'ignore' })
      child.unref()
      return Promise.resolve({ ok: true, pid: child.pid, file: file })
    } catch (e) {
      return Promise.resolve({ ok: false, reason: String(e && e.message || e), file: file })
    }
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
      // ---- 更新链路（详见上方「更新链路」注释块）----
      if (channel === 'updater:meta') {
        return updateMeta()
      }
      if (channel === 'updater:http') {
        return httpRequest(rest[0])
      }
      if (channel === 'updater:download') {
        return startDownload(rest[0])
      }
      if (channel === 'updater:downloadState') {
        return Promise.resolve(dlSnapshot())
      }
      if (channel === 'updater:cancelDownload') {
        return cancelDownload()
      }
      if (channel === 'updater:runInstaller') {
        return runInstaller(rest[0])
      }
      if (channel === 'shell:openExternal') {
        return openExternal(rest[0])
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
    // 更新产物名要用真实平台/架构（mac arm64 下不能再回退成 win-x64）
    platform: hasNode ? process.platform : '',
    arch: hasNode ? process.arch : '',
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
    aerender: aerender,
    // CEP 更新能力探测（渲染层同步读，决定 updatePolicy）
    updater: {
      hasNode: hasNode,
      platform: hasNode ? process.platform : '',
      arch: hasNode ? process.arch : '',
      installedVersion: installedExtVersion
    }
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
