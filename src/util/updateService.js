/**
 * 更新检查渲染层编排：IPC + 偏好 + 日志/弹窗策略
 * 网络与判定在主进程；这里只负责何时调、如何提示、如何落偏好。
 */

import Vue from 'vue'
import { ipc } from './node-env'
import appLog from '../ui-next/log'
import {
  loadUpdatePrefs,
  saveUpdatePrefs,
  patchUpdatePrefs,
  shouldPersistThrottle,
  shouldAutoPrompt,
  hasUpdateBadge
} from './updatePrefs'

const state = Vue.observable({
  checking: false,
  meta: null,
  lastResult: null,
  dialogVisible: false,
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
    }
  } catch (e) { /* mock/旧主进程：忽略 */ }
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
  if (state.checking) { return state.lastResult }
  state.checking = true
  try {
    var meta = await loadMeta()
    var result = await ipc.invoke('updater:check', {
      force: !!o.force,
      enabled: prefs.enabled !== false,
      lastAt: prefs.lastAt || 0,
      skipVersion: prefs.skipVersion || '',
      cachedResult: prefs.lastResult || null
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
        state.dialogVisible = true
        patchUpdatePrefs({ lastNotifiedVersion: result.latest })
        state.lastResult = result
        refreshBadge()
      }
      // 支持自动更新且用户未关闭自动下载时，后台拉 electron-updater
      if (prefsAfter.autoDownload !== false && o.autoDownload !== false) {
        maybeStartAutoDownload()
      }
    }
    return result
  } finally {
    state.checking = false
  }
}

async function maybeStartAutoDownload () {
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

function applyAutoState (snap) {
  if (!snap || typeof snap !== 'object') { return }
  state.auto = Object.assign({}, state.auto, snap)
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
    return await ipc.invoke('updater:quitAndInstall')
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

export function markLater (latest) {
  if (latest) { patchUpdatePrefs({ lastNotifiedVersion: latest }) }
  state.dialogVisible = false
  refreshBadge()
}

export function markSkipVersion (latest) {
  if (latest) { patchUpdatePrefs({ skipVersion: latest, lastNotifiedVersion: latest }) }
  state.dialogVisible = false
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
  loadUpdatePrefs
}
