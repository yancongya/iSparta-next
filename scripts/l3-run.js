/**
 * L3 本地链路测试（Node + fixture，不启 Electron UI）
 * 用法：node scripts/l3-run.js
 * 会按用例切换 fixture 模式，校验 checkUpdate + 真实 HTTP 栈。
 */
const http = require('http')
const https = require('https')
const path = require('path')
const { spawn } = require('child_process')
const { pathToFileURL } = require('url')

const ROOT = path.join(__dirname, '..')
const FIXTURE = path.join(__dirname, 'fixture-github.js')
const PORT = 8124
const BASE = 'http://127.0.0.1:' + PORT
const TIMEOUT_MS = 3000

let passed = 0
let failed = 0
const failures = []

function ok (name, cond, detail) {
  if (cond) {
    passed += 1
    console.log('  PASS', name)
  } else {
    failed += 1
    failures.push({ name, detail })
    console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
  }
}

function httpRequest (method, url, timeoutMs, headers) {
  return new Promise(function (resolve, reject) {
    var settled = false
    var timer = null
    function finish (fn, arg) {
      if (settled) { return }
      settled = true
      if (timer) { clearTimeout(timer) }
      fn(arg)
    }
    var mod = String(url).indexOf('http://') === 0 ? http : https
    var hreq = mod.request(url, {
      method: method,
      headers: Object.assign({ 'User-Agent': 'isparta-next-updater', Accept: '*/*' }, headers || {})
    }, function (res) {
      var raw = res.headers ? res.headers.location : undefined
      var location = Array.isArray(raw) ? raw[0] : (raw || null)
      if (method === 'HEAD') {
        res.resume()
        finish(resolve, { status: res.statusCode, location: location, text: '' })
        return
      }
      var body = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { body += c })
      res.on('end', function () { finish(resolve, { status: res.statusCode, location: location, text: body }) })
      res.on('error', function (e) { finish(reject, e) })
    })
    var ms = timeoutMs || TIMEOUT_MS
    timer = setTimeout(function () {
      try { hreq.destroy() } catch (e) { /* ignore */ }
      finish(reject, new Error('timeout'))
    }, ms)
    hreq.on('timeout', function () { try { hreq.destroy() } catch (e) {} })
    hreq.on('error', function (e) { finish(reject, e) })
    hreq.end()
  })
}

function sleep (ms) {
  return new Promise(function (r) { setTimeout(r, ms) })
}

function startFixture (mode, version) {
  return new Promise(function (resolve, reject) {
    const child = spawn(process.execPath, [FIXTURE], {
      env: Object.assign({}, process.env, {
        FIXTURE_MODE: mode,
        FIXTURE_PORT: String(PORT),
        FIXTURE_VERSION: version || '9.9.9',
        FIXTURE_CURRENT: '3.3.4'
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let ready = false
    const timer = setTimeout(function () {
      if (!ready) {
        child.kill()
        reject(new Error('fixture start timeout mode=' + mode))
      }
    }, 4000)
    function onData (buf) {
      const s = String(buf)
      if (!ready && /fixture github on/.test(s)) {
        ready = true
        clearTimeout(timer)
        resolve(child)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
  })
}

function stopFixture (child) {
  return new Promise(function (resolve) {
    if (!child) { return resolve() }
    child.once('exit', function () { resolve() })
    child.kill()
    setTimeout(function () {
      try { child.kill() } catch (e) { /* ignore */ }
      resolve()
    }, 500)
  })
}

async function check (mod, env, payload) {
  return mod.checkUpdate(Object.assign({
    env: env,
    currentVersion: env.ISPARTA_FORCE_VERSION || '3.3.4',
    platform: 'win32',
    arch: 'x64',
    now: Date.now(),
    timeoutMs: TIMEOUT_MS,
    force: true,
    enabled: true,
    lastCheckAt: 0,
    skipVersion: '',
    cachedResult: null,
    fetchHead: async function (url, ms) {
      var r = await httpRequest('HEAD', url, ms || TIMEOUT_MS)
      return { status: r.status, location: r.location }
    },
    fetchJson: async function (url, ms) {
      var r = await httpRequest('GET', url, ms || TIMEOUT_MS, { Accept: 'application/vnd.github+json' })
      var json = null
      try { json = JSON.parse(r.text) } catch (e) { json = null }
      return { status: r.status, json: json }
    }
  }, payload || {}))
}

async function withFixture (mode, fn) {
  const child = await startFixture(mode)
  try {
    await sleep(80)
    await fn()
  } finally {
    await stopFixture(child)
    await sleep(50)
  }
}

async function main () {
  const modPath = pathToFileURL(path.join(ROOT, 'src', 'util', 'updateCheck.js')).href
  const mod = await import(modPath)
  console.log('L3 fixture link tests against', BASE)

  const baseEnv = {
    ISPARTA_UPDATE_BASE_URL: BASE,
    ISPARTA_UPDATE_API_URL: BASE + '/api',
    ISPARTA_UPDATE_REPO: 'yancongya/iSparta-next',
    ISPARTA_FORCE_VERSION: '3.3.4'
  }

  // 1 available
  await withFixture('available', async () => {
    const r = await check(mod, baseEnv)
    ok('C1 available', r.state === 'available' && r.latest === '9.9.9' && r.assetMissing === false, r)
    ok('C1 url', /isparta-next-win-x64\.exe$/.test(r.downloadUrl), r.downloadUrl)
    ok('C1 notes', r.notes && r.notes.indexOf('fixture') >= 0 && r.notes.indexOf('chore(release)') < 0, r.notes)
  })

  // 2 latest
  await withFixture('latest', async () => {
    const r = await check(mod, baseEnv)
    ok('C2 latest', r.state === 'latest', r.state)
  })

  // 3 prerelease same-core less than release
  await withFixture('prerelease', async () => {
    const env = Object.assign({}, baseEnv, { ISPARTA_FORCE_VERSION: '9.10.0' })
    const r = await check(mod, env)
    ok('C3 prerelease not newer', r.state === 'latest', { state: r.state, latest: r.latest })
  })

  // 4 offline
  await withFixture('offline', async () => {
    const r = await check(mod, baseEnv)
    ok('C4 offline', r.state === 'offline' || r.state === 'error' || r.state === 'rate-limit', r.state)
  })

  // 5 rate-limit (API 403 after HEAD fail) — use rate-limit mode
  await withFixture('rate-limit', async () => {
    // HEAD will still "work" in rate-limit mode? fixture rate-limit only on API.
    // Force HEAD fail by using a base that still hits fixture but mode returns...
    // In rate-limit mode HEAD latest still 302 to vX - so we need HEAD to fail.
    // Point BASE to closed port for HEAD... better: custom env with bad base + API to fixture.
    const env = {
      ISPARTA_UPDATE_BASE_URL: 'http://127.0.0.1:9',
      ISPARTA_UPDATE_API_URL: BASE + '/api',
      ISPARTA_UPDATE_REPO: 'yancongya/iSparta-next',
      ISPARTA_FORCE_VERSION: '3.3.4'
    }
    const r = await check(mod, env)
    ok('C5 rate-limit', r.state === 'rate-limit', r)
  })

  // 6 asset missing
  await withFixture('asset-missing', async () => {
    const r = await check(mod, baseEnv)
    ok('C6 assetMissing', r.state === 'available' && r.assetMissing === true, r)
  })

  // 7 timeout
  await withFixture('timeout', async () => {
    const t0 = Date.now()
    const r = await check(mod, Object.assign({}, baseEnv), { timeoutMs: 600 })
    const dt = Date.now() - t0
    ok('C7 timeout offline', r.state === 'offline', r.state)
    // HEAD + API 兜底各超时一次，应明显小于两次 3s 默认超时
    ok('C7 timeout bound', dt < 2500, dt)
  })

  // 8 mac branch
  await withFixture('available', async () => {
    const r = await mod.checkUpdate({
      env: baseEnv,
      currentVersion: '3.3.4',
      platform: 'darwin',
      arch: 'arm64',
      now: Date.now(),
      timeoutMs: TIMEOUT_MS,
      force: true,
      enabled: true,
      lastCheckAt: 0,
      skipVersion: '',
      cachedResult: null,
      fetchHead: async function (url) {
        var res = await httpRequest('HEAD', url, TIMEOUT_MS)
        return { status: res.status, location: res.location }
      },
      fetchJson: async function (url) {
        var res = await httpRequest('GET', url, TIMEOUT_MS)
        return { status: res.status, json: null }
      }
    })
    ok('C8 mac', r.needsGatekeeperHint === true && /mac-arm64\.zip$/.test(r.downloadUrl), r)
  })

  // 9 throttle with live fixture — first check then second without force
  await withFixture('available', async () => {
    const first = await check(mod, baseEnv)
    ok('C9a first available', first.state === 'available', first.state)
    const second = await check(mod, baseEnv, {
      force: false,
      lastCheckAt: Date.now(),
      cachedResult: first
    })
    ok('C9b throttled', second.throttled === true && second.state === 'available', second)
  })

  // 10 skip
  await withFixture('available', async () => {
    const r = await check(mod, baseEnv, { skipVersion: '9.9.9' })
    ok('C10 skipped', r.state === 'skipped', r)
  })

  // 11 disabled
  await withFixture('available', async () => {
    const r = await check(mod, baseEnv, { enabled: false })
    ok('C11 disabled', r.state === 'disabled', r.state)
  })

  // 12 whitelist
  ok('C12 allow github', mod.isAllowedExternalUrl(
    'https://github.com/yancongya/iSparta-next/releases/latest', {}) === true)
  ok('C12 deny evil', mod.isAllowedExternalUrl('https://evil.example/x', {}) === false)
  ok('C12 deny traversal', mod.isAllowedExternalUrl(
    'https://github.com/yancongya/iSparta-next/../evil', {}) === false)
  ok('C12 allow fixture http', mod.isAllowedExternalUrl(
    BASE + '/yancongya/iSparta-next/releases', baseEnv) === true)

  // 13 http fixture already covered by all above using BASE http://

  // notes via API fallback
  await withFixture('available', async () => {
    const env = {
      ISPARTA_UPDATE_BASE_URL: 'http://127.0.0.1:9',
      ISPARTA_UPDATE_API_URL: BASE + '/api',
      ISPARTA_UPDATE_REPO: 'yancongya/iSparta-next',
      ISPARTA_FORCE_VERSION: '3.3.4'
    }
    const r = await check(mod, env)
    ok('C-notes api fallback', r.state === 'available' && typeof r.notes === 'string' && r.notes.indexOf('fixture') >= 0, r)
  })

  console.log('\nL3 Result:', passed, 'passed,', failed, 'failed')
  if (failed) {
    failures.forEach(function (f) { console.log(' -', f.name, JSON.stringify(f.detail)) })
    process.exitCode = 1
  }
}

main().catch(function (e) {
  console.error(e)
  process.exitCode = 1
})
