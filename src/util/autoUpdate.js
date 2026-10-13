/**
 * 主进程更新器：Windows/Linux 用 electron-updater，macOS 用一体 pkg。
 * - 检查/弹窗仍由 util/updateCheck + 渲染层负责
 * - 这里只负责：是否支持自动更新、下载进度、下载完成后 quitAndInstall
 * - Dev / 非 AppImage / 非 NSIS 一律不启用
 */

import { app, ipcMain } from 'electron'
import { resetOnboardingForReplay } from './onboarding-replay'
import macPkg from './macPkgUpdate'

let updater = null
let state = {
  supported: false,
  checking: false,
  downloading: false,
  downloaded: false,
  progress: 0,
  error: null,
  version: null,
  file: '',
  installing: false,
  completed: false
}

function isDev () {
  return !app.isPackaged || process.env.NODE_ENV === 'development'
}

/** 不支持原因：便于 UI 区分「开发态」和「正式包形态不对」 */
export function autoUpdateSupportReason () {
  if (isDev()) { return 'dev' }
  if (process.platform === 'darwin') { return 'ok' }
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
export async function startAutoDownload (result) {
  if (!supportsAutoUpdate()) {
    return { ok: false, reason: 'unsupported', state: snapshot() }
  }
  if (process.platform === 'darwin') {
    const version = result && result.latest
    if (!version || result.state !== 'available') return { ok: false, reason: 'no-update', state: snapshot() }
    try {
      state.downloading = true
      state.downloaded = false
      state.progress = 0
      state.version = version
      state.error = null
      broadcast()
      state.file = await macPkg.download(version, process.arch === 'arm64' ? 'arm64' : 'x64', (progress) => {
        state.progress = progress
        broadcast()
      })
      state.downloading = false
      state.downloaded = true
      broadcast()
      return { ok: true, state: snapshot() }
    } catch (e) {
      state.downloading = false
      state.error = String((e && e.message) || e)
      broadcast()
      return { ok: false, reason: state.error, state: snapshot() }
    }
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

export async function quitAndInstall (opts) {
  if (process.platform === 'darwin') {
    if (!state.downloaded || !state.file) return { ok: false, reason: 'not-downloaded' }
    state.installing = true
    state.error = null
    broadcast()
    try {
      await macPkg.install(state.file)
      const { execFileSync } = require('child_process')
      const installedVersion = execFileSync('/usr/libexec/PlistBuddy', [
        '-c', 'Print :CFBundleShortVersionString', '/Applications/iSparta-next.app/Contents/Info.plist'
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
      if (installedVersion !== state.version) throw new Error('installed-version-mismatch')
      try { require('fs').unlinkSync(state.file) } catch (e) { /* cache cleanup is best effort */ }
      state.file = ''
      state.installing = false
      state.downloaded = false
      state.completed = true
      broadcast()
      try { resetOnboardingForReplay() } catch (e) { /* ignore */ }
      setTimeout(() => {
        app.relaunch({ execPath: '/Applications/iSparta-next.app/Contents/MacOS/isparta-next' })
        app.quit()
      }, 500)
      return { ok: true, state: snapshot() }
    } catch (e) {
      state.installing = false
      state.error = String((e && e.message) || e)
      broadcast()
      return { ok: false, reason: state.error, state: snapshot() }
    }
  }
  const u = loadUpdater()
  if (!u || !state.downloaded) { return { ok: false, reason: 'not-downloaded' } }
  try {
    const o = opts || {}
    // 安装前系统 Toast（Windows）；mac/Linux 自动更新路径很少走到这里
    try {
      const { Notification } = require('electron')
      if (Notification.isSupported && Notification.isSupported()) {
        const n = new Notification({
          title: o.title || 'iSparta-next',
          body: o.body || '正在安装更新…',
          silent: true
        })
        n.show()
      }
    } catch (eNotify) { /* 通知失败不阻断安装 */ }

    // 重置首启引导标记：升级后按产品策略重播一遍引导（引导窗本身由渲染层判定）
    try { resetOnboardingForReplay() } catch (eReset) { /* ignore */ }

    // 略等一拍让 Toast 露出，再关应用进安装
    const run = () => {
      // isSilent=true：追加 NSIS `/S`，静默安装，不再弹安装向导。
      //   组件页已有 `${Silent} Abort`，默认 $ispartaInstallDesktop/$ispartaInstallAe
      //   均为 "1"，所以桌面版与 CEP 扩展会一起装上。
      // isForceRunAfter=true：装完自动启动（带 --force-run）。
      u.quitAndInstall(true, true)
    }
    if (o.delayMs > 0) {
      setTimeout(run, o.delayMs)
    } else {
      run()
    }
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
  ipcMain.handle('updater:autoDownload', async (event, result) => startAutoDownload(result))
  ipcMain.handle('updater:quitAndInstall', async (event, opts) => quitAndInstall(opts))
}

export default {
  supportsAutoUpdate,
  startAutoDownload,
  quitAndInstall,
  getAutoUpdateState,
  registerAutoUpdateIpc
}
