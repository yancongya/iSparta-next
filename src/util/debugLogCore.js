/**
 * 本地调试日志 HTTP 服务：纯逻辑核心（桌面主进程 / CEP 面板共用一份源码）。
 *
 * 参考 AE-Image-Toolkit 的 logging-core + debug-log-server，但本文件刻意不 import
 * electron / cep / node http：http 模块与日志快照都从参数注入，因此可直接 L1 单测，
 * 也能被桌面主进程（require('http')）与 CEP renderer（window.require('http')）复用。
 *
 * 安全边界（勿放宽，详见 docs/BRIDGE.md）：
 * - 只绑回环 127.0.0.1；端口由调用方传（桌面 48764 / CEP 48765，避开参考项目 48763）。
 * - 精确 Host 校验 + 拒 Origin + 拒跨站 Sec-Fetch-Site；不返回任何 CORS 许可头。
 * - 只读 GET /logs，不接受查询参数；拒绝其他方法与路径。
 * - 响应 JSON + no-store + nosniff + same-origin，不把日志当 HTML 输出。
 * - 限流 10 req/s、最多 16 连接、请求/头部超时 5s；关闭时回收所有 socket。
 * - 快照先脱敏：Bearer / api_key / token / password / 本地绝对路径。
 * - 仅本机读取、无进程身份认证——不可信多用户机器或跨机器访问不适用。
 */

export const DEFAULT_HOST = '127.0.0.1'
export const LOG_LIMIT = 300
export const REQUESTS_PER_SECOND = 10
export const MAX_CONNECTIONS = 16
export const REQ_TIMEOUT_MS = 5000

/** 生成 {id,t,ts,level,category,msg,detail} 日志条目的脱敏副本；不改原对象 */
export function sanitizeEntries (entries, limit) {
  const cap = Math.max(1, Number(limit) || LOG_LIMIT)
  const list = Array.isArray(entries) ? entries : []
  return list.slice(-cap).map(function (e) {
    const row = e || {}
    return {
      id: row.id,
      t: row.t,
      ts: row.ts,
      level: redact(String(row.level == null ? '' : row.level)),
      category: redact(String(row.category == null ? '' : row.category)),
      msg: redact(String(row.msg == null ? '' : row.msg)),
      detail: redact(String(row.detail == null ? '' : row.detail))
    }
  })
}

/** 脱敏：敏感键值 + Bearer + Windows/Unix 本地路径（与日志核心同一套规则） */
export function redact (value) {
  return String(value == null ? '' : value).slice(0, 4000)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [已隐藏]')
    .replace(/\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|authorization)\s*[:=]\s*["']?[^\s,"'}]+/gi, '$1=[已隐藏]')
    .replace(/\b[A-Za-z]:\\(?:[^\\\s]+\\)*([^\\\s]+)/g, '[本地路径]\\$1')
    .replace(/\/(?:[^/\s]+\/)+([^/\s]+)/g, '[本地路径]/$1')
}

/**
 * 纯请求判定：返回 { status, error } 或 null（放行）。
 * headers 是 node 的 request.headers（值可能 string|string[]|undefined）。
 */
export function classifyRequest (req, address) {
  const headers = (req && req.headers) || {}
  const host = headers.host
  const origin = headers.origin
  const site = headers['sec-fetch-site']
  if (origin !== undefined) return { status: 403, error: 'local_clients_only' }
  if (site && !['none', 'same-origin'].includes(String(site))) return { status: 403, error: 'local_clients_only' }
  if (host !== address) return { status: 403, error: 'local_clients_only' }
  const method = String((req && req.method) || 'GET').toUpperCase()
  if (method !== 'GET') return { status: 405, error: 'read_only' }
  const url = String((req && req.url) || '/')
  if (url !== '/logs') return { status: 404, error: 'not_found' }
  return null
}

/** 安全响应头（所有响应都带，含错误分支） */
export function applySecurityHeaders (setHeader) {
  setHeader('Content-Type', 'application/json; charset=utf-8')
  setHeader('Cache-Control', 'no-store')
  setHeader('X-Content-Type-Options', 'nosniff')
  setHeader('Cross-Origin-Resource-Policy', 'same-origin')
  setHeader('Connection', 'close')
}

/**
 * 创建 HTTP 服务。http 模块由调用方注入（桌面 require('http') / CEP window.require('http')）。
 * getSnapshot() 返回原始日志数组；每次请求现取现脱敏，不受 UI 筛选影响。
 * 返回 { start(onError) -> Promise<url>, stop(), getStatus() }。
 */
export function createDebugLogServer (http, getSnapshot, port, host, options) {
  const opts = options || {}
  const bindHost = host || DEFAULT_HOST
  const bindPort = Number(port) || 48764
  const url = 'http://' + bindHost + ':' + bindPort + '/logs'
  const sessionId = String(Date.now()) + '-' + Math.random().toString(36).slice(2)
  const sessionStartedAt = new Date().toISOString()
  const limit = Math.max(1, Number(opts.logLimit) || LOG_LIMIT)

  const sockets = {}
  let socketCount = 0
  let closed = false
  let listening = false
  let address = ''
  let windowStart = 0
  let requestCount = 0
  let starting = null
  let rejectStart = null
  let onFailure = function () {}

  const server = http.createServer(function (req, res) {
    applySecurityHeaders(function (k, v) { res.setHeader(k, v) })
    const fail = function (status, error) {
      res.statusCode = status
      res.end(JSON.stringify({ success: false, data: null, error: error }))
    }
    if (closed) { fail(503, 'debug_disabled'); return }
    const bad = classifyRequest(req, address)
    if (bad) { fail(bad.status, bad.error); return }
    const now = Date.now()
    if (now - windowStart >= 1000) { windowStart = now; requestCount = 0 }
    if (++requestCount > REQUESTS_PER_SECOND) { fail(429, 'rate_limited'); return }
    try {
      const entries = sanitizeEntries(typeof getSnapshot === 'function' ? getSnapshot() : [], limit)
      res.end(JSON.stringify({
        success: true,
        data: entries,
        error: null,
        metadata: {
          sessionId: sessionId,
          sessionStartedAt: sessionStartedAt,
          capturedAt: new Date().toISOString(),
          count: entries.length
        }
      }))
    } catch (e) {
      fail(500, 'snapshot_unavailable')
    }
  })

  server.maxConnections = MAX_CONNECTIONS
  server.maxHeadersCount = 20
  server.headersTimeout = REQ_TIMEOUT_MS
  server.requestTimeout = REQ_TIMEOUT_MS
  server.setTimeout(REQ_TIMEOUT_MS, function (socket) { socket.destroy() })
  server.on('connection', function (socket) {
    if (closed) { socket.destroy(); return }
    const key = String(socketCount++)
    sockets[key] = socket
    socket.once('close', function () { delete sockets[key] })
  })
  server.on('clientError', function (_e, socket) { socket.destroy() })

  const stop = function () {
    if (closed) return
    closed = true
    if (rejectStart) rejectStart(new Error('Debug server closed'))
    if (listening && typeof server.close === 'function') server.close()
    Object.keys(sockets).forEach(function (k) {
      try { sockets[k].destroy() } catch (e) { /* ignore */ }
    })
    sockets && Object.keys(sockets).forEach(function (k) { delete sockets[k] })
  }
  server.on('error', function (error) {
    if (rejectStart) rejectStart(error)
    if (listening) { try { onFailure(error) } catch (e) { /* ignore */ } }
    stop()
  })

  return {
    start: function (onError) {
      if (starting) return starting
      if (closed) return Promise.reject(new Error('Debug server closed'))
      if (typeof onError === 'function') onFailure = onError
      starting = new Promise(function (resolve, reject) {
        rejectStart = reject
        server.listen(bindPort, bindHost, function () {
          if (closed) { try { server.close() } catch (e) { /* ignore */ } return }
          const info = typeof server.address === 'function' ? server.address() : null
          if (!info || typeof info === 'string') { reject(new Error('Invalid debug address')); stop(); return }
          listening = true
          address = bindHost + ':' + (info.port || bindPort)
          resolve('http://' + address + '/logs')
        })
      })
      return starting
    },
    stop: stop,
    getStatus: function () {
      return { listening: listening, url: listening ? 'http://' + address + '/logs' : '', closed: closed }
    },
    // 暴露给 L1：不启监听即可测请求判定与响应
    _url: url
  }
}
