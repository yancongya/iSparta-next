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

/** dock 主操作：支持自动更新则后台下载，否则打开浏览器下载页 */
export async function startUpdateFromDock (result) {
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
  loadUpdatePrefs
}
