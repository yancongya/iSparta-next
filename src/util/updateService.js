/**
 * 更新检查渲染层编排：IPC + 偏好 + 日志/弹窗策略
 * 网络与判定在主进程；这里只负责何时调、如何提示、如何落偏好。
 *
 * updatePolicy（双端一起更，禁止扩展单独热更）：
 * - electron → 'full'（可 electron-updater 自动下载）
 * - cep      → 'none'（默认；不跑 electron-updater）。可用 ISPARTA_CEP_UPDATE_POLICY=notify-only 只提示
 * - browser-mock → 'notify-only'（UI 预览）
 * W6 host-env 合入后改从 host-env 读 kind/updatePolicy；此处先自探测。
 */

import Vue from 'vue'
import { ipc } from './node-env'
import appLog from '../ui-next/log'
import hostAdapter from './host-env'
import { checkUpdate } from './updateCheck'
import {
  loadUpdatePrefs,
  saveUpdatePrefs,
  patchUpdatePrefs,
  shouldPersistThrottle,
  shouldAutoPrompt,
  hasUpdateBadge
} from './updatePrefs'

/** 探测宿主 kind；host-env 就绪后优先用它 */
export function detectHostKind () {
  try {
    var host = require('./host-env')
    if (host && typeof host.getKind === 'function') { return host.getKind() }
    if (host && host.kind) { return host.kind }
  } catch (e) { /* W6 未合入 */ }
  if (typeof window === 'undefined') { return 'browser-mock' }
  if (window.__adobe_cep__ || window.ispartaCepBridge || (window.cep && window.cep.fs)) {
    return 'cep'
  }
  if (window.ispartaAPI) {
    var proc = window.ispartaAPI.process
    if (proc && proc.versions && proc.versions.electron) { return 'electron' }
    if (window.ispartaAPI.ipc) { return 'electron' }
  }
  return 'browser-mock'
}

/**
 * 更新策略：full | notify-only | none
 * CEP 默认 none（禁 electron-updater 自动下载）；notify-only 可选（env 开启）。
 */
export function resolveUpdatePolicy (kind) {
  try {
    var host = require('./host-env')
    if (host && typeof host.getUpdatePolicy === 'function') {
      var p = host.getUpdatePolicy()
      if (p === 'full' || p === 'notify-only' || p === 'none') { return p }
    }
  } catch (e) { /* W6 未合入 */ }
  var k = kind || detectHostKind()
  if (k === 'cep') {
    var forced = ''
    try {
      forced = (typeof process !== 'undefined' && process.env && process.env.ISPARTA_CEP_UPDATE_POLICY) || ''
    } catch (eEnv) { forced = '' }
    return forced === 'notify-only' ? 'notify-only' : 'none'
  }
  if (k === 'electron') { return 'full' }
  return 'notify-only'
}

const hostKind = detectHostKind()
const updatePolicy = resolveUpdatePolicy(hostKind)

const state = Vue.observable({
  checking: false,
  meta: null,
  lastResult: null,
  hostKind: hostKind,
  updatePolicy: updatePolicy,
  // 自动检查：右下角非阻断 dock；手动检查/详情：模态 dialog
  dialogVisible: false,
  dockVisible: false,
  badge: false,
  auto: {
    supported: false,
    checking: false,
    downloading: false,
    downloaded: false,
    progress: 0,
    error: null,
    version: null
  }
})

/** 当前策略是否允许检查（none 仅手动 force 且只提示） */
export function getUpdatePolicy () {
  return state.updatePolicy
}

export function getHostKind () {
  return state.hostKind
}

/** 自动下载仅 full；notify-only / none 一律禁用 electron-updater 拉包 */
function allowsAutoDownload () {
  return state.updatePolicy === 'full' && state.hostKind === 'electron'
}

function refreshBadge () {
  state.badge = hasUpdateBadge(state.lastResult, loadUpdatePrefs())
}

function persistResult (result, opts) {
  var prefs = loadUpdatePrefs()
  var patch = { lastResult: result }
  if (opts && opts.forceNotify && result && result.state === 'available' && result.latest) {
    patch.lastNotifiedVersion = result.latest
  }
  if (result && shouldPersistThrottle(result.state) && !(result && result.throttled)) {
    patch.lastAt = Date.now()
  }
  prefs = patchUpdatePrefs(patch)
  state.lastResult = result
  refreshBadge()
  return prefs
}

async function loadMeta () {
  if (state.meta) { return state.meta }
  try {
    var meta = await ipc.invoke('updater:meta')
    if (meta && meta.version) {
      state.meta = meta
      return state.meta
    }
  } catch (e) { /* CEP / mock / 旧主进程：无 updater:meta */ }
  // CEP 等无 Electron IPC 时：用 brand 静态版本（与 package.json 同步）
  try {
    var APP_VERSION = require('../brand').APP_VERSION
    if (APP_VERSION) {
      state.meta = { version: APP_VERSION, portable: false, autoSupported: false }
    }
  } catch (e2) { /* ignore */ }
  return state.meta
}

/**
 * @param {object} opts
 *   force {boolean} 手动检查，绕过节流
 *   silentUI {boolean} 自动检查：失败不 notice
 *   openDialog {boolean} available 且应提示时打开对话框
 */
export async function runUpdateCheck (opts) {
  var o = opts || {}
  var prefs = loadUpdatePrefs()
  // 用户关了自动检查：仅手动 force 仍查（双端都要能显示最新/无网络状态）
  if (prefs.enabled === false && !o.force) {
    return { state: 'disabled', reason: 'user-disabled' }
  }
  if (state.checking) { return state.lastResult }
  state.checking = true
  try {
    var meta = await loadMeta()
    var result = await invokeCheck({
      force: !!o.force,
      enabled: prefs.enabled !== false,
      lastAt: prefs.lastAt || 0,
      lastCheckAt: prefs.lastAt || 0,
      skipVersion: prefs.skipVersion || '',
      cachedResult: prefs.lastResult || null,
      current: (meta && meta.version) || ''
    })
    if (!result || typeof result !== 'object') {
      result = { state: 'error', current: (meta && meta.version) || '', latest: null }
    }
    if (!result.current && meta && meta.version) {
      result = Object.assign({}, result, { current: meta.version })
    }

    var auto = !o.force
    if (auto && (result.state === 'offline' || result.state === 'rate-limit' || result.state === 'error')) {
      appLog.warn('检查更新失败', result.state)
    }

    var prefsAfter = persistResult(result, { forceNotify: false })

    if (result.state === 'available' && o.openDialog !== false) {
      var prompt = o.force || shouldAutoPrompt(result, prefsAfter)
      if (prompt) {
        // 手动检查或显式要求：开完整 Dialog；自动检查：只出角落 Dock
        if (o.force || o.openDialog === true) {
          state.dialogVisible = true
          state.dockVisible = false
        } else {
          state.dockVisible = true
          state.dialogVisible = false
        }
        patchUpdatePrefs({ lastNotifiedVersion: result.latest })
        state.lastResult = result
        refreshBadge()
      }
      // 检查本身不触发下载：有新版只出 UI（Dock/Dialog），由用户点「立即更新」再拉包
      // 避免设置里一点「检查更新」就后台下完只丢一个「重启」
      if (!o.force) {
        try {
          var snap = await ipc.invoke('updater:autoState')
          applyAutoState(snap)
        } catch (eSnap) { /* 忽略 */ }
      }
    }
    return result
  } finally {
    state.checking = false
  }
}

/**
 * 桌面走主进程 updater:check；CEP/桥缺失时渲染层直接查 GitHub。
 * 两边都返回 updateCheck 同形 result：latest / available / offline / error…
 */
async function invokeCheck (payload) {
  try {
    if (ipc && typeof ipc.invoke === 'function') {
      var r = await ipc.invoke('updater:check', payload)
      if (r && typeof r === 'object' && r.state) { return r }
    }
  } catch (e) { /* CEP 桥无 updater:check → 回退 */ }
  return browserCheck(payload)
}

function browserFetchJson (url, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var done = false
    var timer = setTimeout(function () {
      if (done) return
      done = true
      reject(new Error('timeout'))
    }, timeoutMs || 12000)
    fetch(url, { method: 'GET', headers: { Accept: 'application/vnd.github+json' }, redirect: 'follow' })
      .then(function (res) {
        return res.json().then(function (json) {
          if (done) return
          done = true
          clearTimeout(timer)
          resolve({ status: res.status, json: json })
        })
      })
      .catch(function (e) {
        if (done) return
        done = true
        clearTimeout(timer)
        reject(e)
      })
  })
}

function browserFetchHead (url, timeoutMs) {
  // 浏览器 fetch 会跟随重定向，读不到 302 Location；交给 checkUpdate 的 API 兜底
  return Promise.resolve({ status: 0, location: null })
}

function browserCheck (payload) {
  var p = payload || {}
  var proc = (typeof window !== 'undefined' && window.ispartaAPI && window.ispartaAPI.process) || null
  var platform = (proc && proc.platform) || 'win32'
  var arch = (proc && proc.arch) || 'x64'
  return checkUpdate({
    force: !!p.force,
    enabled: p.enabled !== false,
    lastCheckAt: p.lastCheckAt || p.lastAt || 0,
    skipVersion: p.skipVersion || '',
    cachedResult: p.cachedResult || null,
    currentVersion: p.current || p.currentVersion || '',
    platform: platform,
    arch: arch,
    env: {},
    fetchJson: browserFetchJson,
    fetchHead: browserFetchHead,
    now: Date.now()
  })
}

async function maybeStartAutoDownload () {
  // CEP / notify-only / none：禁止 electron-updater 自动下载
  if (!allowsAutoDownload()) {
    return { ok: false, reason: 'update-policy', policy: state.updatePolicy }
  }
  try {
    var snap = await ipc.invoke('updater:autoState')
    applyAutoState(snap)
    if (!snap || !snap.supported) { return null }
    var dl = await ipc.invoke('updater:autoDownload')
    if (dl && dl.state) { applyAutoState(dl.state) }
    return dl
  } catch (e) {
    return null
  }
}

/**
 * UI 预览用（开发调试）：挂 window.__updateAutoStub 或
 * localStorage.ispartaPreviewAuto 后，合并覆盖 auto 快照，
 * 便于在 dev 下看「立即更新 / 重启以更新」形态。未设置时零影响。
 */
function previewAutoStub () {
  if (typeof window === 'undefined') { return null }
  if (window.__updateAutoStub && typeof window.__updateAutoStub === 'object') {
    return window.__updateAutoStub
  }
  try {
    var raw = window.localStorage && window.localStorage.getItem('ispartaPreviewAuto')
    if (raw) {
      var parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') { return parsed }
    }
  } catch (e) { /* ignore */ }
  return null
}

function applyAutoState (snap) {
  var stub = previewAutoStub()
  if (stub) { snap = Object.assign({}, snap || {}, stub) }
  if (!snap || typeof snap !== 'object') { return }
  state.auto = Object.assign({}, state.auto, snap)
  // 下载中 / 已完成：即使用户关过「有新版」卡片，也重新露出 dock（重启 CTA 不能埋掉）
  if (snap.downloading || snap.downloaded) {
    var last = state.lastResult
    var prefs = loadUpdatePrefs()
    if (last && last.state === 'available' &&
        !(prefs.skipVersion && prefs.skipVersion === last.latest)) {
      state.dockVisible = true
    }
  }
}

export async function refreshAutoUpdateState () {
  try {
    var snap = await ipc.invoke('updater:autoState')
    applyAutoState(snap)
    return state.auto
  } catch (e) {
    return state.auto
  }
}

export async function restartToUpdate () {
  try {
    // 文案走渲染层 i18n，主进程 Toast 用这份文案
    var i18nMod = null
    try { i18nMod = require('../i18n').default } catch (e) { i18nMod = null }
    var title = (i18nMod && i18nMod.t('updateInstallingApp')) || 'iSparta-next'
    var body = (i18nMod && i18nMod.t('updateInstallingBody')) || '正在安装更新…'
    return await ipc.invoke('updater:quitAndInstall', {
      title: title,
      body: body,
      delayMs: 500
    })
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) }
  }
}

export function getAutoUpdate () {
  return state.auto
}

export function closeUpdateDialog () {
  state.dialogVisible = false
}

/** 打开完整更新对话框（dock「查看说明」/ 手动检查） */
export function openUpdateDialog () {
  state.dialogVisible = true
  state.dockVisible = false
}

export function closeUpdateDock () {
  state.dockVisible = false
}

/** dock 主操作：策略允许且支持自动更新则后台下载，否则打开浏览器下载页（CEP 同此） */
export async function startUpdateFromDock (result) {
  if (!allowsAutoDownload()) {
    // notify-only / none：不跑 electron-updater；引导获取桌面完整包
    var opened = await openDownload(result)
    markLater(result && result.latest)
    return { ok: false, reason: 'update-policy', policy: state.updatePolicy, opened: opened }
  }
  var snap = await ipc.invoke('updater:autoState').catch(function () { return null })
  applyAutoState(snap)
  if (state.auto && state.auto.supported) {
    state.dockVisible = true
    return maybeStartAutoDownload()
  }
  await openDownload(result)
  markLater(result && result.latest)
  return null
}

export function markLater (latest) {
  if (latest) { patchUpdatePrefs({ lastNotifiedVersion: latest }) }
  state.dialogVisible = false
  state.dockVisible = false
  refreshBadge()
}

export function markSkipVersion (latest) {
  if (latest) { patchUpdatePrefs({ skipVersion: latest, lastNotifiedVersion: latest }) }
  state.dialogVisible = false
  state.dockVisible = false
  refreshBadge()
}

export function setUpdateEnabled (enabled) {
  patchUpdatePrefs({ enabled: enabled !== false })
}

export function setAutoDownload (on) {
  patchUpdatePrefs({ autoDownload: on !== false })
}

/** 浏览器 mock：挂 window.__updateAutoStub 后 IPC 返回它 */
export function bindAutoIpcListener () {
  try {
    ipc.on('updater:autoState', function (snap) {
      applyAutoState(snap)
    })
  } catch (e) { /* mock on() 为空 */ }
}

export async function openDownload (result) {
  if (!result) { return { opened: false } }
  var url = result.assetMissing ? result.fallbackUrl : result.downloadUrl
  if (!url && result.fallbackUrl) { url = result.fallbackUrl }
  try {
    return await ipc.invoke('shell:openExternal', url)
  } catch (e) {
    return { opened: false, reason: String(e && e.message || e) }
  }
}

export function getUpdateState () {
  return state
}

export function bootstrapUpdateFromStorage () {
  var prefs = loadUpdatePrefs()
  state.lastResult = prefs.lastResult
  refreshBadge()
  return prefs
}

export function savePrefs (prefs) {
  return saveUpdatePrefs(prefs)
}

export { loadUpdatePrefs }

export default {
  state,
  runUpdateCheck,
  closeUpdateDialog,
  openUpdateDialog,
  closeUpdateDock,
  startUpdateFromDock,
  markLater,
  markSkipVersion,
  setUpdateEnabled,
  setAutoDownload,
  openDownload,
  getUpdateState,
  getAutoUpdate,
  refreshAutoUpdateState,
  restartToUpdate,
  bindAutoIpcListener,
  bootstrapUpdateFromStorage,
  loadMeta,
  loadUpdatePrefs,
  detectHostKind,
  resolveUpdatePolicy,
  getUpdatePolicy,
  getHostKind
}
