/**
 * L1：本地调试日志核心 + 控制器守卫（纯 Node，不启浏览器、不真监听端口）
 * 用法：node scripts/debug-log-core.l1.js
 *
 * 覆盖：脱敏规则、请求判定（Host/Origin/method/path）、安全头、限流、
 * 快照上限与 metadata、控制器状态机（starting→ready/error/unavailable、关闭防迟到）。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.join(__dirname, '..')
let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

// 把 ESM 模块剥成可在沙箱求值（无 import/export 依赖）
function loadModule (rel, names) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  const code = raw
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export\s+(const|function|let|var)\s/gm, '$1 ')
    .replace(/^export default[^\n]*\n?/gm, '')
  const sandbox = { module: { exports: {} }, exports: {}, console, Date, Math, JSON, Array, Object, String, Number, RegExp, Error, Promise }
  vm.createContext(sandbox)
  vm.runInContext(code + '\n;Object.assign(globalThis,{' + names.join(',') + '});', sandbox, { filename: rel })
  return sandbox
}

function run () {
  const core = loadModule('src/util/debugLogCore.js', [
    'DEFAULT_HOST', 'LOG_LIMIT', 'REQUESTS_PER_SECOND', 'MAX_CONNECTIONS', 'REQ_TIMEOUT_MS',
    'sanitizeEntries', 'redact', 'classifyRequest', 'applySecurityHeaders', 'createDebugLogServer'
  ])
  const ctrl = loadModule('src/util/debugLogController.js', ['createDebugLogController'])

  // ---- 脱敏 ----
  ok('redact Bearer', (function () { var r = core.redact('token is Bearer abc.def-123=='); return r.indexOf('Bearer [已隐藏]') >= 0 && r.indexOf('abc.def') < 0 })())
  ok('redact api_key', core.redact('api_key=sk-live-123456').indexOf('api_key=[已隐藏]') >= 0)
  ok('redact password', core.redact('password: hunter2').indexOf('password=[已隐藏]') >= 0)
  ok('redact Windows 路径', !/C:\\Users\\secret\\file/.test(core.redact('C:\\Users\\secret\\file\\x.png')))
  ok('redact 普通文本保留', core.redact('转换完成') === '转换完成')

  // ---- 快照脱敏 + 上限 ----
  const many = []
  for (let i = 0; i < 350; i++) many.push({ id: i, level: 'info', category: 'General', msg: 'line ' + i, detail: 'Bearer tok.abc' })
  const snap = core.sanitizeEntries(many, 300)
  ok('快照封顶 300', snap.length === 300 && snap[0].id === 50, snap.length)
  ok('快照逐条脱敏', snap[0].detail.indexOf('Bearer [已隐藏]') >= 0, snap[0].detail)
  ok('快照不改原对象', many[349].detail === 'Bearer tok.abc')

  // ---- 请求判定 ----
  const address = '127.0.0.1:48764'
  const good = { headers: { host: address }, method: 'GET', url: '/logs' }
  ok('合法回环 GET /logs 放行', core.classifyRequest(good, address) === null)
  ok('拒 Origin', core.classifyRequest({ headers: { host: address, origin: 'http://evil' }, method: 'GET', url: '/logs' }, address).error === 'local_clients_only')
  ok('拒跨站 Sec-Fetch-Site', core.classifyRequest({ headers: { host: address, 'sec-fetch-site': 'cross-site' }, method: 'GET', url: '/logs' }, address).error === 'local_clients_only')
  ok('拒 Host 不匹配', core.classifyRequest({ headers: { host: '127.0.0.1:9999' }, method: 'GET', url: '/logs' }, address).error === 'local_clients_only')
  ok('拒写方法', core.classifyRequest({ headers: { host: address }, method: 'POST', url: '/logs' }, address).error === 'read_only')
  ok('拒其他路径', core.classifyRequest({ headers: { host: address }, method: 'GET', url: '/eval' }, address).error === 'not_found')

  // ---- 安全头 ----
  const headers = {}
  core.applySecurityHeaders(function (k, v) { headers[k] = v })
  ok('no-store', headers['Cache-Control'] === 'no-store')
  ok('nosniff', headers['X-Content-Type-Options'] === 'nosniff')
  ok('same-origin', headers['Cross-Origin-Resource-Policy'] === 'same-origin')
  ok('无 CORS 许可头', headers['Access-Control-Allow-Origin'] === undefined)

  // ---- server 工厂（mock http，不真监听）----
  let captured = null
  const fakeHttp = {
    createServer: function (handler) {
      captured = { handler: handler, listeners: {}, state: {} }
      return {
        setTimeout: function () {},
        on: function (ev, fn) { captured.listeners[ev] = fn },
        address: function () { return { port: 48764 } },
        listen: function (p, h, cb) { captured.state = { p, h }; cb() },
        close: function () { captured.state.closed = true }
      }
    }
  }
  const server = core.createDebugLogServer(fakeHttp, function () { return [{ level: 'warn', category: 'General', msg: 'api_key=secret123' }] }, 48764)

  // ---- 控制器状态机 ----
  function fakeServer (mode) {
    return {
      stopped: false,
      start: function () {
        if (mode === 'error') return Promise.reject(Object.assign(new Error('busy'), { code: 'EADDRINUSE' }))
        return Promise.resolve('http://127.0.0.1:48764/logs')
      },
      stop: function () { this.stopped = true }
    }
  }
  return Promise.resolve().then(async function () {
    // ---- server 工厂（先 start 才有 address，再测请求）----
    const startedUrl = await server.start()
    ok('server 只绑回环', captured.state.h === '127.0.0.1' && captured.state.p === 48764, captured.state)
    ok('server 返回 url', startedUrl === 'http://127.0.0.1:48764/logs', startedUrl)
    const res = { headers: {}, statusCode: 200, setHeader: function (k, v) { this.headers[k] = v }, end: function (b) { this.body = b } }
    captured.handler({ headers: { host: '127.0.0.1:48764' }, method: 'GET', url: '/logs' }, res)
    const payload = JSON.parse(res.body)
    ok('响应 success + data', payload.success === true && Array.isArray(payload.data), res.body)
    ok('响应 metadata 齐', !!payload.metadata.sessionId && !!payload.metadata.capturedAt && payload.metadata.count === 1, payload.metadata)
    ok('响应体已脱敏', payload.data[0].msg.indexOf('api_key=[已隐藏]') >= 0, payload.data[0].msg)
    // 限流：新一轮 11 次（前一次请求已计入，这里第 11 次必被拒）
    let limited = null
    for (let i = 0; i < 12; i++) {
      const r = { statusCode: 200, setHeader: function () {}, end: function (b) { if (b) limited = JSON.parse(b) } }
      r.end = function (b) { if (i === 11) limited = JSON.parse(b) }
      captured.handler({ headers: { host: '127.0.0.1:48764' }, method: 'GET', url: '/logs' }, r)
    }
    ok('限流 12 次被拒', limited && limited.error === 'rate_limited', limited)
    server.stop()

    {
      const c = ctrl.createDebugLogController({}, function () { return fakeServer('ok') })
      ok('controller 初始 off', c.getSnapshot().status === 'off' && !c.getSnapshot().enabled)
      const p = c.enable()
      ok('enable 先进 starting', c.getSnapshot().status === 'starting', c.getSnapshot())
      const r = await p
      ok('enable 完成 ready', r.status === 'ready' && r.enabled && !!r.url, r)
      c.disable()
      ok('disable 回 off', c.getSnapshot().status === 'off' && !c.getSnapshot().enabled)
    }
    {
      const c = ctrl.createDebugLogController({}, function () { return fakeServer('error') })
      const r = await c.enable()
      ok('端口占用 → error', r.status === 'error' && r.errorCode === 'EADDRINUSE', r)
      ok('error 时 enabled=false', r.enabled === false)
    }
    {
      const c = ctrl.createDebugLogController({}, function () { return null })
      const r = await c.enable()
      ok('无 Node → unavailable', r.status === 'unavailable' && !r.enabled, r)
    }
    {
      // 关闭后迟到的成功不得把状态改回 ready
      let resolveStart
      const slow = { start: function () { return new Promise(function (res) { resolveStart = res }) }, stop: function () {} }
      const c = ctrl.createDebugLogController({}, function () { return slow })
      const p = c.enable()
      c.disable()
      resolveStart('http://late')
      const r = await p
      ok('关闭后迟到成功作废', r === null && c.getSnapshot().status === 'off', { r, state: c.getSnapshot() })
    }
    // ---- 源码静态守卫 ----
    const coreSrc = fs.readFileSync(path.join(ROOT, 'src/util/debugLogCore.js'), 'utf8')
    const ctrlSrc = fs.readFileSync(path.join(ROOT, 'src/util/debugLogController.js'), 'utf8')
    ok('core 绑回环', /127\.0\.0\.1/.test(coreSrc) && !/0\.0\.0\.0/.test(coreSrc))
    ok('core 不 import electron/cep', !/require\(['"]electron['"]\)|from ['"]electron['"]/.test(coreSrc))
    ok('controller 有代次防护', /generation/.test(ctrlSrc) && /generation !== current/.test(ctrlSrc))

    console.log('\ndebug-log-core L1:', passed, 'passed,', failed, 'failed')
    if (failed) process.exitCode = 1
  })
}

run()
