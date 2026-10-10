/**
 * 升级后重播首启引导（仅主进程）。
 *
 * 为什么要单独一个模块：`ui-next/onboarding/state.js` 依赖 Vue + 渲染层
 * `window.ispartaAPI` 桥，主进程 import 不了它；而引导的判定完全取决于
 * 存储文件里的 `onboardingState`，所以主进程直接改那个 JSON 文件即可，
 * 两端读到的是同一份数据。
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

function storagePath () {
  const dev = process.env.NODE_ENV === 'development'
  return path.join(os.tmpdir(), 'iSparta', dev ? 'localstorage-dev.json' : 'localstorage.json')
}

/**
 * 把引导标记重置为「未完成」，使新版本启动时重播一遍引导。
 * 任何失败都静默：写不进去最坏结果是这次不重播，不该因此拦住更新。
 * @returns {{ ok: boolean, reason?: string }}
 */
export function resetOnboardingForReplay () {
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
    obj[ONBOARDING_KEY] = JSON.stringify({ version: 0, done: false })
    fs.writeFileSync(p, JSON.stringify(obj), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e) }
  }
}

export default { ONBOARDING_KEY, resetOnboardingForReplay }