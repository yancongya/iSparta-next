/**
 * L3 Electron 主进程链路：真实 ipcMain.handle + app.getVersion + shell 白名单
 * 用法（fixture 已在 8124 时）：
 *   $env:ISPARTA_UPDATE_BASE_URL='http://127.0.0.1:8124'
 *   $env:ISPARTA_UPDATE_API_URL='http://127.0.0.1:8124/api'
 *   $env:ISPARTA_FORCE_VERSION='3.3.4'
 *   npx electron scripts/l3-electron.js
 */
const path = require('path')
const { pathToFileURL } = require('url')
const { app, BrowserWindow, ipcMain, shell } = require('electron')
const http = require('http')
const https = require('https')

const UPDATE_UA = 'isparta-next-updater'
const UPDATE_TIMEOUT_MS = 3000

process.env.ISPARTA_UPDATE_BASE_URL = process.env.ISPARTA_UPDATE_BASE_URL || 'http://127.0.0.1:8124'
process.env.ISPARTA_UPDATE_API_URL = process.env.ISPARTA_UPDATE_API_URL || 'http://127.0.0.1:8124/api'
process.env.ISPARTA_FORCE_VERSION = process.env.ISPARTA_FORCE_VERSION || '3.3.4'

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
      finish(reject, new Error('timeout'))
    }, ms)
    hreq.on('timeout', function () { try { hreq.destroy() } catch (e) {} })
    hreq.on('error', function (e) { finish(reject, e) })
    hreq.end()
  })
}

function report (name, obj) {
  console.log('L3E ' + name + ' ' + JSON.stringify(obj))
}

app.whenReady().then(async function () {
  let checkUpdate
  let isAllowedExternalUrl
  try {
    // Electron 主进程对无 type:module 的 .js 不能直接 import；落成临时 .mjs 再载
    const fs = require('fs')
    const os = require('os')
    const tmp = path.join(os.tmpdir(), 'isparta-l3-update')
    fs.mkdirSync(tmp, { recursive: true })
    const brandSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'brand.js'), 'utf8')
    const ucSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'util', 'updateCheck.js'), 'utf8')
      .replace("from '../brand.js'", "from './brand.mjs'")
    fs.writeFileSync(path.join(tmp, 'brand.mjs'), brandSrc)
    fs.writeFileSync(path.join(tmp, 'updateCheck.mjs'), ucSrc)
    const mod = await import(pathToFileURL(path.join(tmp, 'updateCheck.mjs')).href)
    checkUpdate = mod.checkUpdate
    isAllowedExternalUrl = mod.isAllowedExternalUrl
  } catch (e) {
    console.error('L3E import failed', e)
    app.exit(2)
    return
  }

  ipcMain.handle('updater:meta', async function () {
    return {
      version: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      forcedVersion: process.env.ISPARTA_FORCE_VERSION || ''
    }
  })

  ipcMain.handle('updater:check', async function (event, payload) {
    var p = payload || {}
    return checkUpdate({
      env: process.env,
      currentVersion: process.env.ISPARTA_FORCE_VERSION || app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      now: Date.now(),
      timeoutMs: UPDATE_TIMEOUT_MS,
      force: !!p.force,
      enabled: p.enabled !== false,
      lastCheckAt: Number(p.lastCheckAt) || 0,
      skipVersion: typeof p.skipVersion === 'string' ? p.skipVersion : '',
      cachedResult: p.cachedResult || null,
      fetchHead: async function (url) {
        var r = await httpRequest('HEAD', url, UPDATE_TIMEOUT_MS)
        return { status: r.status, location: r.location }
      },
      fetchJson: async function (url) {
        var r = await httpRequest('GET', url, UPDATE_TIMEOUT_MS, { Accept: 'application/vnd.github+json' })
        var json = null
        try { json = JSON.parse(r.text) } catch (e) { json = null }
        return { status: r.status, json: json }
      }
    })
  })

  ipcMain.handle('shell:openExternal', async function (event, url) {
    if (typeof url !== 'string' || !url) { return { opened: false, reason: 'empty' } }
    if (!isAllowedExternalUrl(url, process.env)) { return { opened: false, reason: 'not-allowed' } }
    try {
      await shell.openExternal(url)
      return { opened: true }
    } catch (e) {
      return { opened: false, reason: 'failed' }
    }
  })

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  })
  await win.loadURL('about:blank')

  const preload = path.join(__dirname, 'l3-preload.js')
  // 使用独立隐藏窗 + preload 模拟真实 contextBridge 路径
  const win2 = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false
    }
  })
  await win2.loadURL('about:blank')

  const results = await win2.webContents.executeJavaScript(`(async () => {
    const out = {}
    out.meta = await window.l3api.invoke('updater:meta')
    out.check = await window.l3api.invoke('updater:check', { force: true, enabled: true })
    out.evil = await window.l3api.invoke('shell:openExternal', 'https://evil.example/x')
    out.skip = await window.l3api.invoke('updater:check', { force: true, enabled: true, skipVersion: (out.check && out.check.latest) || '' })
    return out
  })()`)

  report('ipc', {
    meta: results.meta,
    checkState: results.check && results.check.state,
    latest: results.check && results.check.latest,
    assetMissing: results.check && results.check.assetMissing,
    downloadUrl: results.check && results.check.downloadUrl,
    evil: results.evil,
    skipState: results.skip && results.skip.state
  })

  const pass =
    results.meta &&
    results.meta.version &&
    results.check &&
    (results.check.state === 'available' || results.check.state === 'latest') &&
    results.evil &&
    results.evil.opened === false &&
    results.evil.reason === 'not-allowed'

  report('summary', { pass: !!pass })
  app.exit(pass ? 0 : 1)
})

app.on('window-all-closed', function () {
  app.quit()
})
