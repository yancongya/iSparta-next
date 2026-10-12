/**
 * 首启引导标记的主进程侧读写（桌面专用）。
 *
 * 为什么单独一个模块：`ui-next/onboarding/state.js` 依赖 Vue + 渲染层
 * `window.ispartaAPI` 桥，主进程 import 不了它；而引导的判定完全取决于
 * 存储文件里的 `onboardingState`，所以主进程直接改那个 JSON 文件即可，
 * 两端读到的是同一份数据。
 *
 * 两个用途：
 *   1. resetOnboardingForReplay() —— 自动更新安装前清标记，升级后重播一遍引导。
 *   2. markOnboardingDone()       —— 用户用系统关闭按钮关掉引导窗（渲染层没机会
 *      走 finish()）时补写完成标记，否则下次启动又弹一遍。
 *
 * 存储位置必须与 `store/index.js` 完全一致，否则写了一个没人读的文件：
 *   开发态 → os.tmpdir()/iSparta/localstorage-dev.json
 *   生产态 → os.tmpdir()/iSparta/localstorage.json
 */

import fs from 'fs'
import os from 'os'
import path from 'path'

/** 与 src/ui-next/onboarding/state.js 的 KEY 保持一致 */
export const ONBOARDING_KEY = 'onboardingState'
/** 与 src/ui-next/onboarding/state.js 的 VERSION 保持一致（改版后一起自增） */
export const ONBOARDING_VERSION = 1

function storagePath () {
  const dev = process.env.NODE_ENV === 'development'
  return path.join(os.tmpdir(), 'iSparta', dev ? 'localstorage-dev.json' : 'localstorage.json')
}

/**
 * 读改写整份存储文件。文件不存在或内容不是合法 JSON 时按空对象继续
 * （与 store/index.js 的容错一致）。任何失败都不抛，交由调用方决定降级。
 * @returns {{ ok: boolean, reason?: string }}
 */
function writeOnboardingState (state) {
  const p = storagePath()
  try {
    if (!fs.existsSync(p)) {
      // 文件还不存在说明这用户没跑过几轮渲染层，标记天然就是「未完成」，无需写。
      return { ok: true, reason: 'no-storage-file' }
    }
    let obj = {}
    try {
      const raw = fs.readFileSync(p, 'utf8')
      obj = raw ? (JSON.parse(raw) || {}) : {}
    } catch (e) {
      // 内容不是合法 JSON：与 store 的处理一致，重置为 {}
      obj = {}
    }
    if (!obj || typeof obj !== 'object') { obj = {} }
    obj[ONBOARDING_KEY] = JSON.stringify(state)
    fs.writeFileSync(p, JSON.stringify(obj), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}

/**
 * 把引导标记重置为「未完成」，使新版本启动时重播一遍引导。
 * 任何失败都静默：写不进去最坏结果是这次不重播，不该因此拦住更新。
 * @returns {{ ok: boolean, reason?: string }}
 */
export function resetOnboardingForReplay () {
  return writeOnboardingState({ version: 0, done: false })
}

/**
 * 标记引导已完成（当前版本），供主进程在「用户直接关掉引导窗」时补写。
 * @returns {{ ok: boolean, reason?: string }}
 */
export function markOnboardingDone () {
  return writeOnboardingState({ version: ONBOARDING_VERSION, done: true })
}

export default { ONBOARDING_KEY, ONBOARDING_VERSION, resetOnboardingForReplay, markOnboardingDone }