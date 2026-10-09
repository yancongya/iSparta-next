/**
 * 首启引导状态（桌面 / CEP 共用）
 *
 * 职责：
 *   1. 判定「是否该自动弹出引导」—— 仅首次安装 / 本模块 VERSION 升级后弹一次。
 *   2. 提供 open / close / finish 三个动作，供 RootGate 与 Home 的帮助入口调用。
 *
 * 形态分端（关键差异，勿再把两端当同一件事）：
 *   · 桌面：引导是**独立无边框小窗**（background.js 的 openOnboardingWindow），
 *     主窗在引导期间隐藏。所以 open()/finish() 走 IPC，组件不参与窗口生命周期，
 *     `state.open` 在桌面恒为 false。
 *   · CEP ：AE 没有自己的窗口可开，引导仍是**面板内浮层**（RootGate 的 overlay），
 *     一切由 state.open 驱动。
 * 统一入口是 open()/finish()，内部按 hostAdapter.kind 分流，调用方无需分支。
 *
 * 持久化：走 node-env 的 storage 桥，键 `onboardingState`，值 `{ version, done }`。
 * 桌面与 CEP 各自独立判定（各自的 storage 文件）。
 *
 * ⚠ 读取失败（桥未就绪 / CEP 端 storage 不可写）时**按「已完成」处理**，
 *   否则每次启动都会弹引导，属于最差降级。首次安装时键不存在 ≠ 读取失败，
 *   两者必须区分开（见 readRecord 的 ok 字段）。
 */

import Vue from 'vue'
import { storage } from '../../util/node-env'
import hostAdapter from '../../util/host-env'

/** 存储键 */
export const KEY = 'onboardingState'
/** 当前引导版本；改版后自增即可让所有用户重新看一遍 */
export const VERSION = 1

/** 引导是否正在展示（跨组件共享的 observable 单例；桌面独立窗下恒 false） */
export const state = Vue.observable({ open: false })

/**
 * 桌面独立窗的宿主 ipc 桥；CEP / browser-mock 下为 null。
 * ⚠ 返回的是 `api.ipc` 而不是 `api` —— 调用方写的是 `ipc.send(...)`，
 *   误返回整个 api 会让 send 恒为 undefined，静默退化成「点了没反应」。
 */
function hostIpc () {
  try {
    const api = (typeof window !== 'undefined' && window.ispartaAPI) || null
    return (api && api.ipc) || null
  } catch (e) { return null }
}

/**
 * 读取存储记录。
 * @returns {{ ok: boolean, record: object|null }}
 *   ok=false 表示**桥不可用**（与「还没有记录」区分）
 */
function readRecord () {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) { return { ok: true, record: null } }
    const parsed = JSON.parse(raw)
    return { ok: true, record: parsed && typeof parsed === 'object' ? parsed : null }
  } catch (e) {
    return { ok: false, record: null }
  }
}

/** 是否已完成当前版本的首启引导 */
export function isDone () {
  const r = readRecord()
  if (!r.ok) { return true }
  if (!r.record) { return false }
  return r.record.version === VERSION && r.record.done === true
}

/** 写入完成标记 */
export function markDone () {
  try {
    storage.setItem(KEY, JSON.stringify({ version: VERSION, done: true }))
  } catch (e) { /* 写不进去也不阻断用户 */ }
}

/** 启动时是否应自动弹出 */
export function shouldAutoOpen () {
  return !isDone()
}

/**
 * 调起引导。桌面发 IPC 让主进程开独立小窗；CEP 走面板内浮层。
 * 浏览器预览（browser-mock）无宿主窗，直接退化成浮层，方便 `npm run serve` 看效果。
 */
export function open () {
  const ipc = hostIpc()
  if (hostAdapter.kind === 'electron' && ipc && typeof ipc.send === 'function') {
    try {
      ipc.send('onboarding:open')
      return
    } catch (e) { /* 发送失败退回落成浮层，总比点了没反应强 */ }
  }
  state.open = true
}

export function close () {
  const ipc = hostIpc()
  if (hostAdapter.kind === 'electron' && ipc && typeof ipc.send === 'function') {
    try {
      ipc.send('onboarding:close')
    } catch (e) { /* ignore */ }
  }
  state.open = false
}

/** 走完最后一步：写标记并关闭 */
export function finish () {
  markDone()
  close()
}

/** dev 用：清掉标记，便于反复验证首启流程 */
export function reset () {
  try {
    storage.setItem(KEY, JSON.stringify({ version: 0, done: false }))
  } catch (e) { /* ignore */ }
}

export default { state, KEY, VERSION, isDone, markDone, shouldAutoOpen, open, close, finish, reset }
