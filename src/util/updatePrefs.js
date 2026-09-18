// 更新检查偏好：独立 storage 键，不塞进 globalSetting（避免被转换默认值整包写回冲掉）
// storage 无 removeItem：清空用空串哨兵

import { storage } from './node-env'

export const UPDATE_PREFS_KEY = 'updateCheck'

const DEFAULT_PREFS = {
  enabled: true,
  // electron-updater：检查到新版后是否自动下载（Win NSIS / Linux AppImage）
  autoDownload: true,
  // 下载完成后是否随退出自动安装；本方案默认 false，由用户点「重启以更新」
  autoInstallOnAppQuit: false,
  lastAt: 0,
  skipVersion: '',
  lastNotifiedVersion: '',
  lastResult: null
}

function parseRaw (raw) {
  if (!raw) { return null }
  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

/** 读取并补齐缺字段；storage 不可用时返回默认值副本 */
export function loadUpdatePrefs () {
  var parsed = null
  try {
    parsed = parseRaw(storage.getItem(UPDATE_PREFS_KEY))
  } catch (e) {
    parsed = null
  }
  var out = Object.assign({}, DEFAULT_PREFS)
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.enabled === 'boolean') { out.enabled = parsed.enabled }
    if (typeof parsed.autoDownload === 'boolean') { out.autoDownload = parsed.autoDownload }
    if (typeof parsed.autoInstallOnAppQuit === 'boolean') { out.autoInstallOnAppQuit = parsed.autoInstallOnAppQuit }
    if (isFinite(Number(parsed.lastAt))) { out.lastAt = Number(parsed.lastAt) || 0 }
    if (typeof parsed.skipVersion === 'string') { out.skipVersion = parsed.skipVersion }
    if (typeof parsed.lastNotifiedVersion === 'string') { out.lastNotifiedVersion = parsed.lastNotifiedVersion }
    if (parsed.lastResult && typeof parsed.lastResult === 'object') { out.lastResult = parsed.lastResult }
  }
  return out
}

export function saveUpdatePrefs (prefs) {
  var next = Object.assign({}, DEFAULT_PREFS, prefs || {})
  try {
    storage.setItem(UPDATE_PREFS_KEY, JSON.stringify(next))
  } catch (e) { /* 存储不可用时本次会话仍生效 */ }
  return next
}

export function patchUpdatePrefs (patch) {
  return saveUpdatePrefs(Object.assign(loadUpdatePrefs(), patch || {}))
}

/** 仅成功解析出 latest 的状态才推进 lastAt，断网后下次启动仍会静默重试 */
export function shouldPersistThrottle (state) {
  return state === 'available' || state === 'latest' || state === 'skipped'
}

/** 是否应在自动检查时弹窗（每版本一次；skip / 已通知都不弹） */
export function shouldAutoPrompt (result, prefs) {
  if (!result || result.state !== 'available') { return false }
  var latest = result.latest
  if (!latest) { return false }
  if (prefs && prefs.skipVersion && prefs.skipVersion === latest) { return false }
  if (prefs && prefs.lastNotifiedVersion && prefs.lastNotifiedVersion === latest) { return false }
  return true
}

/** 红点：有新版且未「不再提示」 */
export function hasUpdateBadge (result, prefs) {
  if (!result || result.state !== 'available') { return false }
  var latest = result.latest
  if (!latest) { return false }
  return !(prefs && prefs.skipVersion && prefs.skipVersion === latest)
}
