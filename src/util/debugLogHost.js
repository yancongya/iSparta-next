/**
 * 本地调试日志：宿主适配层。
 *
 * 把「服务起在哪里」的差异收敛到一处，让 UI 只依赖共享的 debugLogController：
 * - 桌面：renderer 无 node http，服务起在主进程 → open 返回 IPC 代理，
 *   start 调 debugLog:start（主进程用共享 core + require('http')），feed 节流推日志。
 * - CEP：面板有 --enable-nodejs，renderer 直接 require('http') + 共享 core 起服务。
 * - mock / 落地页：无 node、无桥 → open 返回 null，控制器进入 unavailable（不伪造成功）。
 *
 * 日志快照读取统一走注入的 getSnapshot()（渲染层 log 模块），桌面侧经 feed 同步到主进程。
 */
import { getDebugLog } from './node-env'
import { isMockEnv } from './node-env'
import { createDebugLogServer, DEFAULT_HOST } from './debugLogCore'

export const DESKTOP_DEBUG_LOG_PORT = 48764
export const CEP_DEBUG_LOG_PORT = 48765

// 用户可配端口：模块级单例（两端各自 bundle 一份，互不干扰）。
// 由通用设置写入，openDebugLogServer 起服务时读取。未设置/非法一律回退宿主默认。
let configuredPort = 0

/** 端口规范化：1-65535 整数才有效，否则回退 fallback */
export function normalizeDebugLogPort (value, fallback) {
  const n = Number(value)
  return (isFinite(n) && n >= 1 && n <= 65535 && Math.floor(n) === n) ? n : fallback
}

/** 是否已有显式配置（用于区分「用户刚改的内存值」与「仅 storage 回退」） */
export function hasConfiguredPort () {
  return configuredPort > 0
}

/** 当前生效端口（优先用户配置，否则宿主默认） */
export function currentDebugLogPort (host) {
  const fallback = host === 'cep' ? CEP_DEBUG_LOG_PORT : DESKTOP_DEBUG_LOG_PORT
  return configuredPort || fallback
}

/** 写入端口（0/非法 → 清空回退默认）；返回最终生效端口 */
export function setDebugLogPort (value) {
  const host = detectHost()
  const fallback = host === 'cep' ? CEP_DEBUG_LOG_PORT : DESKTOP_DEBUG_LOG_PORT
  configuredPort = normalizeDebugLogPort(value, 0) || 0
  return configuredPort || fallback
}

/** 探测当前宿主能否提供本地 HTTP 服务 */
export function detectHost () {
  if (isMockEnv()) return 'unavailable'
  const bridge = getDebugLog()
  if (bridge) return 'desktop'
  // CEP： Cep 有全局 require（--enable-nodejs）。注意不能直接 typeof require ——
  // webpack 在浏览器 bundle 里会注入一个假的 require，故再用 cep 宿主信号确认。
  const cepHost = typeof window !== 'undefined' &&
    (window.__adobe_cep__ || window.cep || window.cep_node || window.ispartaCS || window.ispartaCepBridge)
  if (cepHost && cepHttp()) return 'cep'
  return 'unavailable'
}

/** 从 CEP 的 node require 里安全取 http；兼容 cep_node.require / 裸 require；取不到返回 null */
function cepHttp () {
  if (typeof window === 'undefined') return null
  const candidates = [window.cep_node && window.cep_node.require, window.require]
  for (let i = 0; i < candidates.length; i++) {
    const req = candidates[i]
    if (typeof req === 'function') {
      try {
        const http = req.call(window.cep_node || window, 'http')
        if (http && typeof http.createServer === 'function') return http
      } catch (e) { /* try next */ }
    }
  }
  return null
}

/**
 * 生成控制器 open(core) 所需的服务对象：{ start(onError) -> Promise<url>, stop() }。
 * getSnapshot 返回渲染层原始日志数组。返回 null 表示当前环境不支持（控制器转 unavailable）。
 */
export function openDebugLogServer (getSnapshot, subscribe) {
  const host = detectHost()
  if (host === 'desktop') {
    const bridge = getDebugLog()
    let latest = []
    // 桌面：日志快照节流推送到主进程（服务读主进程缓存，避免每请求跨进程）
    let timer = null
    const feed = function (entries) {
      latest = Array.isArray(entries) ? entries : []
      if (timer) return
      timer = setTimeout(function () {
        timer = null
        try { bridge.feed(latest) } catch (e) { /* ignore */ }
      }, 250)
    }
    feed(getSnapshot && getSnapshot())
    // 订阅渲染层日志变化，持续喂给主进程快照缓存
    if (typeof subscribe === 'function') {
      try { subscribe(function (entries) { feed(entries) }) } catch (e) { /* ignore */ }
    }
    return {
      start: function () {
        return Promise.resolve(bridge.start(currentDebugLogPort('desktop'))).then(function (r) {
          if (!r || !r.ok) {
            const err = new Error((r && r.error) || 'start failed')
            if (r && r.code) err.code = r.code
            throw err
          }
          return r.url
        })
      },
      stop: function () { try { bridge.stop() } catch (e) { /* ignore */ } }
    }
  }
  if (host === 'cep') {
    const http = cepHttp()
    if (!http) return null
    const server = createDebugLogServer(http, function () {
      return getSnapshot && getSnapshot()
    }, currentDebugLogPort('cep'), DEFAULT_HOST)
    return server
  }
  return null
}
