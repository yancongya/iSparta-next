/**
 * 真实 Electron / Node 验收：本地调试日志 HTTP 服务（主进程同源）。
 *
 * 用法：unset ELECTRON_RUN_AS_NODE && npx electron scripts/dev/verify-debug-log-server.cjs
 *   （WorkBuddy 环境自带 ELECTRON_RUN_AS_NODE=1，必须 unset，否则 Electron 被当纯 Node 跑）
 *
 * 覆盖（都是 L1 mock 与浏览器 mock 测不到的真实行为）：
 *   1) 真 require('http') + 共享 debugLogCore 起服务，端口 48774 只绑 127.0.0.1；
 *   2) 真 HTTP 请求 GET /logs 可读、返回脱敏日志 + metadata；
 *   3) 安全边界：拒 Origin / 跨站 / Host 不匹配 / 写方法 / 错路径；
 *   4) renderer feed 快照后进响应（模拟真实日志流）；
 *   5) 关闭后端口释放（同一端口可再次 bind），不留悬挂。
 *
 * 直接在主进程求值 core 源码（与 renderer / 主进程共用同一份文件），不起 BrowserWindow，
 * 用 node 的 http 客户端做真实回环请求；不写任何产物文件。
 */
const { app } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const vm = require('node:vm')
const http = require('node:http')

const ROOT = process.cwd()
app.setPath('userData', path.join(ROOT, '.tmp', 'verify-debug-log-server'))
app.disableHardwareAcceleration()

const results = []
function ok (name, cond, detail) {
  results.push({ name, pass: !!cond })
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : ''))
}

// 从共享 core 源码求值（纯逻辑，不 import electron）
const coreSrc = fs.readFileSync(path.join(ROOT, 'src/util/debugLogCore.js'), 'utf8')
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/^export\s+(const|function|let|var)\s/gm, '$1 ')
  .replace(/^export default[^\n]*\n?/gm, '')
const sandbox = { console, Date, Math, JSON, Array, Object, String, Number, RegExp, Error, Promise, setTimeout, clearTimeout }
vm.createContext(sandbox)
vm.runInContext(coreSrc + '\n;globalThis.__api={createDebugLogServer,DEFAULT_HOST,LOG_LIMIT};', sandbox)
const { createDebugLogServer, DEFAULT_HOST } = sandbox.__api

function request (opts, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(Object.assign({ host: '127.0.0.1', port: 48774, method: 'GET', path: '/logs', timeout: 3000 }, opts), function (res) {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { raw += c })
      res.on('end', function () {
        let json = null
        try { json = JSON.parse(raw) } catch (e) { /* non-json */ }
        resolve({ status: res.statusCode, headers: res.headers, body: raw, json: json })
      })
    })
    req.on('timeout', function () { req.destroy(new Error('timeout')) })
    req.on('error', reject)
    if (body !== undefined) req.write(body)
    req.end()
  })
}

app.on('ready', async () => {
  let server = null
  try {
    // feed 一份含敏感信息的日志，验证真响应用已脱敏
    let snapshot = [
      { id: 1, level: 'info', category: 'General', msg: '导入 1 项', detail: 'api_key=sk-secret-123' },
      { id: 2, level: 'warn', category: 'bridge', msg: 'Bearer abc.def', detail: '' }
    ]
    server = createDebugLogServer(http, () => snapshot, 48774, DEFAULT_HOST)
    const url = await server.start()
    ok('服务真监听并返回 url', url === 'http://127.0.0.1:48774/logs', url)
    ok('DEFAULT_HOST 是回环', DEFAULT_HOST === '127.0.0.1')

    // 合法请求
    const good = await request({})
    ok('GET /logs 200', good.status === 200, good.status)
    ok('JSON success + 2 条', good.json && good.json.success === true && good.json.data.length === 2, good.json && good.json.data.length)
    ok('响应已脱敏 api_key', good.body.indexOf('sk-secret-123') < 0 && good.body.indexOf('api_key=[已隐藏]') >= 0)
    ok('响应已脱敏 Bearer', good.body.indexOf('abc.def') < 0 && good.body.indexOf('Bearer [已隐藏]') >= 0)
    ok('安全头 no-store', good.headers['cache-control'] === 'no-store', good.headers['cache-control'])
    ok('metadata 齐全', !!(good.json.metadata.sessionId && good.json.metadata.capturedAt && good.json.metadata.count === 2))

    // feed 新快照后立即可读（真实场景下 renderer 节流推送）
    snapshot = [{ id: 3, level: 'ok', category: 'General', msg: '转换完成', detail: '' }]
    const afterFeed = await request({})
    ok('feed 后响应即时更新', afterFeed.json.data.length === 1 && afterFeed.json.data[0].msg === '转换完成', afterFeed.json.data)

    // 安全边界
    const badOrigin = await request({ headers: { origin: 'http://evil.example' } })
    ok('拒 Origin', badOrigin.status === 403 && badOrigin.json.error === 'local_clients_only', badOrigin.json)
    const badHost = await request({ headers: { host: 'localhost:48774' } })
    ok('拒 Host 不匹配', badHost.status === 403, badHost.json)
    const badMethod = await request({ method: 'POST' }, 'x=1')
    ok('拒写方法', badMethod.status === 405 && badMethod.json.error === 'read_only', badMethod.json)
    const badPath = await request({ path: '/eval' })
    ok('拒非 /logs 路径', badPath.status === 404, badPath.json)

    // 关闭后端口释放：先 stop，再用同一端口另起一个短命 server 验证可绑定
    server.stop()
    server = null
    const probe = http.createServer((_q, r) => r.end('ok'))
    const rebound = await new Promise((resolve) => {
      probe.once('error', (e) => resolve(false))
      probe.listen(48774, '127.0.0.1', () => resolve(true))
    })
    ok('关闭后端口可重新绑定', rebound)
    if (rebound) probe.close()

    const failed = results.filter((r) => !r.pass).length
    console.log('\n真实 Electron 调试日志服务验收:', results.length - failed, '/', results.length, 'passed')
  } catch (e) {
    console.error('验收异常:', e && e.stack || e)
    process.exitCode = 1
  } finally {
    try { if (server) server.stop() } catch (e) { /* ignore */ }
    app.quit()
  }
})
