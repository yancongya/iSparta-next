/**
 * CEP 桥引导：必须在 store / processor 求值前执行。
 *
 * 优先级：
 * 1. 已有 window.ispartaAPI（桌面 preload 或 cep-bridge 预注入）→ 不动
 * 2. window.ispartaCepBridge（index.html 外链 targets/cep/lib/cep-bridge.js）→ 包装成 ispartaAPI
 * 3. 纯浏览器预览 → 交给 mock-bridge（由 main.js 紧随其后 import）
 *
 * 不要把 cep-bridge 打进 bundle：其 require('fs') 必须在 CEP 运行时解析为 Node，
 * 否则会被 webpack 空模块替换，hasNode 永远为 false。
 */
/* global window */

export default function ensureBridge () {
  if (typeof window === 'undefined') { return false }
  if (window.ispartaAPI) { return true }

  var b = window.ispartaCepBridge
  if (!b) { return false }

  window.ispartaAPI = {
    fs: b.fs,
    path: b.path,
    os: b.os,
    storage: b.storage,
    ipc: b.ipc,
    process: b.process,
    childProcess: b.childProcess,
    aerender: b.aerender || (typeof window !== 'undefined' && window.ispartaForge) || null
  }
  return true
}

ensureBridge()
