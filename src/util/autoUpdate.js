/**
 * electron-updater 封装（仅主进程）。
 * - 检查/弹窗仍由 util/updateCheck + 渲染层负责
 * - 这里只负责：是否支持自动更新、下载进度、下载完成后 quitAndInstall
 * - Dev 与 mac / 非 AppImage / 非 NSIS 一律不启用
 */

import { app, ipcMain } from 'electron'

let updater = null
let state = {
  supported: false,
  checking: false,
  downloading: false,
  downloaded: false,
  progress: 0,
  error: null,
  version: null
}

function isDev () {
  return !app.isPackaged || process.env.NODE_ENV === 'development'
}

/** 不支持原因：便于 UI 区分「开发态」和「正式包形态不对」 */
export function autoUpdateSupportReason () {
  if (isDev()) { return 'dev' }
  if (process.platform === 'darwin') { return 'mac' }
  if (process.platform === 'linux') {
    return process.env.APPIMAGE ? 'ok' : 'not-appimage'
  }
  if (process.platform === 'win32') {
    return 'ok'
  }
  return 'unsupported'
}

/** 是否具备 electron-updater 可用的安装形态 */
export function supportsAutoUpdate () {
  return autoUpdateSupportReason() === 'ok'
}

function snapshot () {
  return Object.assign({}, state, {
    supported: supportsAutoUpdate(),
    reason: autoUpdateSupportReason(),
    packaged: !!app.isPackaged
  })
}

function broadcast () {
  // 渲染层可 ipc.on('updater:autoState') 或主动 invoke 查询
  try {
    const { BrowserWindow } = require('electron')
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('updater:autoState', snapshot())
      }
    })
  } catch (e) { /* ignore */ }
}

function loadUpdater () {
  if (updater) { return updater }
  if (!supportsAutoUpdate()) { return null }
  try {
    // electron-updater 4.x：require 即可，勿在 Dev 里初始化
    const mod = require('electron-updater')
    updater = mod.autoUpdater
    updater.autoDownload = false
    updater.autoInstallOnAppQuit = false
    updater.on('checking-for-update', () => {
      state.checking = true
      state.error = null
      broadcast()
    })
    updater.on('update-available', (info) => {
      state.checking = false
      state.downloading = true
      state.version = (info && info.version) || null
      broadcast()
    })
    updater.on('update-not-available', () => {
      state.checking = false
      state.downloading = false
      state.downloaded = false
      broadcast()
    })
    updater.on('download-progress', (p) => {
      state.downloading = true
      state.progress = p && typeof p.percent === 'number' ? p.percent : state.progress
      broadcast()
    })
    updater.on('update-downloaded', (info) => {
      state.downloading = false
      state.downloaded = true
      state.progress = 100
      state.version = (info && info.version) || state.version
      broadcast()
    })
    updater.on('error', (err) => {
      state.checking = false
      state.downloading = false
      state.error = String((err && err.message) || err)
      broadcast()
    })
  } catch (e) {
    updater = null
    state.error = String(e && e.message || e)
  }
  return updater
}

/** 主动触发下载（检查已有新版时调用） */
export async function startAutoDownload () {
  if (!supportsAutoUpdate()) {
    return { ok: false, reason: 'unsupported', state: snapshot() }
  }
  const u = loadUpdater()
  if (!u) {
    return { ok: false, reason: state.error || 'updater-unavailable', state: snapshot() }
  }
  try {
    state.downloading = true
    state.error = null
    broadcast()
    // checkForUpdates 会拉 latest*.yml；有新版则按 autoDownload=false 需再 downloadUpdate
    const result = await u.checkForUpdates()
    const updateInfo = result && result.updateInfo
    if (!updateInfo) {
      state.downloading = false
      broadcast()
      return { ok: false, reason: 'no-update', state: snapshot() }
    }
    state.version = updateInfo.version || state.version
    await u.downloadUpdate()
    state.downloaded = true
    state.downloading = false
    state.progress = 100
    broadcast()
    return { ok: true, state: snapshot() }
  } catch (e) {
    state.downloading = false
    state.error = String(e && e.message || e)
    broadcast()
    return { ok: false, reason: state.error, state: snapshot() }
  }
}

export function quitAndInstall () {
  const u = loadUpdater()
  if (!u || !state.downloaded) { return { ok: false, reason: 'not-downloaded' } }
  try {
    // isSilent=false：Windows 上让用户看到安装界面；Linux AppImage 替换后重启
    u.quitAndInstall(false, true)
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String(e && e.message || e) }
  }
}

export function getAutoUpdateState () {
  return snapshot()
}

export function registerAutoUpdateIpc () {
  ipcMain.handle('updater:autoState', async () => snapshot())
  ipcMain.handle('updater:autoDownload', async () => startAutoDownload())
  ipcMain.handle('updater:quitAndInstall', async () => quitAndInstall())
}

export default {
  supportsAutoUpdate,
  startAutoDownload,
  quitAndInstall,
  getAutoUpdateState,
  registerAutoUpdateIpc
}
