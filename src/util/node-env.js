// 统一取 Node/Electron 能力：优先 window.ispartaAPI（preload）
// 桥接口冻结与签名契约见 docs/BRIDGE.md（改此处形状需同步 preload 与该文档）
/* global window */
function api () {
  if (typeof window !== 'undefined' && window.ispartaAPI) {
    return window.ispartaAPI
  }
  return null
}

export function getFs () {
  const a = api()
  if (a) { return a.fs }
  throw new Error('ispartaAPI.fs missing: preload not loaded?')
}

export function getPath () {
  const a = api()
  if (a) { return a.path }
  throw new Error('ispartaAPI.path missing: preload not loaded?')
}

export function getOs () {
  const a = api()
  if (a) { return a.os }
  throw new Error('ispartaAPI.os missing: preload not loaded?')
}

export function getStorage () {
  const a = api()
  if (a) { return a.storage }
  throw new Error('ispartaAPI.storage missing: preload not loaded?')
}

export function getIpc () {
  const a = api()
  if (a) { return a.ipc }
  throw new Error('ispartaAPI.ipc missing: preload not loaded?')
}

/**
 * 是否纯浏览器 mock 环境（桌面 mockup :8081 / CEP mockup :8082 / 落地页 demo）。
 * 单一真相源：processor 的模拟转换、store 的覆盖预检豁免都读这里，避免各处各写判据。
 * 判据与 mock-bridge 安装标志一致（installMockBridge 会置 __ispartaMockBridge=true）；
 * 落地页 demo 构建另用构建标志兜底。真实 Electron / CEP 宿主下二者皆假，恒走真实链路。
 */
export function isMockEnv () {
  if (process.env.VUE_APP_LANDING_DEMO === '1') return true
  return typeof window !== 'undefined' && window.__ispartaMockBridge === true
}

export const ipc = {
  invoke: (...args) => getIpc().invoke(...args),
  send: (...args) => getIpc().send(...args),
  on: (...args) => getIpc().on(...args)
}
export const fs = {
  existsSync: (...a) => getFs().existsSync(...a),
  ensureFileSync: (...a) => getFs().ensureFileSync(...a),
  ensureDirSync: (...a) => getFs().ensureDirSync(...a),
  readFileSync: (...a) => getFs().readFileSync(...a),
  writeFileSync: (...a) => getFs().writeFileSync(...a),
  readdirSync: (...a) => getFs().readdirSync(...a),
  lstatSync: (...a) => getFs().lstatSync(...a),
  copy: (...a) => getFs().copy(...a),
  copySync: (...a) => getFs().copySync(...a),
  writeFile: (...a) => getFs().writeFile(...a),
  remove: (...a) => getFs().remove(...a),
  statSize: (p) => {
    const r = getFs().statSize && getFs().statSize(p)
    // 失败返回 -1，避免把缺文件当成 0 字节从而误判“未超限”
    return (r && r.ok) ? r.size : -1
  }
}
export const path = {
  join: (...a) => getPath().join(...a),
  dirname: (...a) => getPath().dirname(...a),
  basename: (...a) => getPath().basename(...a),
  get sep () { return getPath().sep }
}
export const os = {
  tmpdir: (...a) => getOs().tmpdir(...a),
  cpus: (...a) => getOs().cpus(...a)
}
export const storage = {
  setStoragePath: (...a) => getStorage().setStoragePath(...a),
  getItem: (...a) => getStorage().getItem(...a),
  setItem: (...a) => getStorage().setItem(...a)
}

export function getProcessBridge () {
  const a = api()
  if (a && a.process) { return a.process }
  throw new Error('ispartaAPI.process missing: preload not loaded?')
}

export function getChildProcess () {
  const a = api()
  if (a && a.childProcess) { return a.childProcess }
  throw new Error('ispartaAPI.childProcess missing: preload not loaded?')
}

/** 本地调试日志桥：桌面 preload / CEP cep-bridge 均提供同形 debugLog 组 */
export function getDebugLog () {
  const a = api()
  if (a && a.debugLog) { return a.debugLog }
  return null
}

/** RenderSmith forge（aerender）；懒加载，兼容脚本先后顺序 */
export function getAerender () {
  try {
    const a = api()
    if (a && a.aerender && typeof a.aerender.launch === 'function') { return a.aerender }
  } catch (e) { /* fall through */ }
  try {
    if (typeof window !== 'undefined') {
      if (window.ispartaForge && typeof window.ispartaForge.launch === 'function') {
        return window.ispartaForge
      }
      if (window.ispartaAPI && window.ispartaAPI.aerender &&
        typeof window.ispartaAPI.aerender.launch === 'function') {
        return window.ispartaAPI.aerender
      }
    }
  } catch (e2) { /* ignore */ }
  return null
}
