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
  var b = window.ispartaCepBridge || {}
  var api = window.ispartaAPI || {}
  // 不能「有对象就 return」：HMR 后可能是残缺 ispartaAPI，store 顶层 fs/storage 会抛错
  var keys = ['fs', 'path', 'os', 'storage', 'ipc', 'process', 'childProcess', 'aerender']
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i]
    if (!api[k] && b[k]) { api[k] = b[k] }
  }
  if (!api.aerender && window.ispartaForge) { api.aerender = window.ispartaForge }
  if (api.fs || api.storage || api.ipc) {
    window.ispartaAPI = api
    return true
  }
  return !!window.ispartaAPI
}

ensureBridge()
