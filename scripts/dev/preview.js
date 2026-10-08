/**
 * 预览台统一入口：起服务 → 确认真的是它在应答 → 打开默认浏览器。
 *
 * 用法：
 *   node scripts/dev/preview.js guide              # 引导页预览台（:8090）
 *   node scripts/dev/preview.js landing            # 落地页（:8080）
 *   node scripts/dev/preview.js web                # 桌面 Web，纯浏览器（:8081）
 *   node scripts/dev/preview.js desktop            # 桌面端 electron:serve（:8081，会拉起窗口）
 *   node scripts/dev/preview.js cep                # CEP Web（:8082，不动 CEP 清单开关）
 *   node scripts/dev/preview.js landing --port 8085 --no-open
 *
 * 为什么不等「进程起来了」就算成功：
 *   ① vue-cli 的 dev server 在端口被占时会**自动顺延**（8081 → 8082 → 8083…），
 *      顺延链会撞上本预览台的端口，于是「打开 :8090 看到的是应用本体」这种误判
 *      极易发生，且很难自查；
 *   ② 反过来，邻近端口上若残留着上一次的实例，盲目扫端口会把「别人的实例」
 *      当成本次的成果 —— 请求 :8096 却报 :8097 就绪，说的根本不是同一个进程。
 *
 * 因此以**子进程自己打印的地址**为唯一真相源（本仓库两个静态服务与 vue-cli
 * 都会在监听成功后打印 URL），再补一次 HTTP 探活确认，然后才打印结论。
 */
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const nodeExe = process.execPath
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/** 无 --port 时的邻近端口复用范围（vue-cli 与本仓库静态服务都只会 +1） */
const PORT_SPAN = 5
/** 就绪轮询间隔；总超时给足 3 分钟（vue-cli 首包要等编译） */
const POLL_MS = 300
const READY_TIMEOUT_MS = 180000

/** 子进程自报地址：127.0.0.1（本仓库静态服务）/ localhost（vue-cli）/ 0.0.0.0 */
const URL_RE = /https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0):(\d+)/

const TARGETS = {
  guide: {
    label: '引导页预览台',
    port: 8090,
    marker: 'id="dots"',
    dynamicPort: true,
    cmd: [nodeExe, 'scripts/dev/serve-guide-preview.js'],
    note: '源目录 scripts/dev/guide-preview/'
  },
  landing: {
    label: '落地页',
    port: 8080,
    marker: 'id="hero-stage"',
    dynamicPort: true,
    cmd: [nodeExe, 'scripts/serve-landing.js'],
    note: '源目录 landing/'
  },
  web: {
    label: '桌面 Web（纯浏览器）',
    port: 8081,
    marker: '<title>iSparta-next</title>',
    cmd: [npmCmd, 'run', 'serve'],
    note: '不含 Electron 壳，改 UI 时最轻'
  },
  desktop: {
    label: '桌面端 dev（electron:serve）',
    port: 8081,
    marker: '<title>iSparta-next</title>',
    cmd: [npmCmd, 'run', 'dev'],
    note: '会拉起 Electron 窗口'
  },
  cep: {
    label: 'CEP Web',
    port: 8082,
    marker: '<title>iSparta</title>',
    cmd: [npmCmd, 'run', 'serve:cep'],
    note: '只预览界面，不改 CEP 清单；要真面板 HMR 用 scripts/dev/run-all-dev.cmd'
  }
}

function parseArgv (argv) {
  const out = { target: null, port: null, open: true, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--no-open') { out.open = false; continue }
    if (a === '--open') { out.open = true; continue }
    if (a === '--port' || a === '-p') { out.port = Number(argv[++i]) || null; continue }
    if (a === '-h' || a === '--help') { out.help = true; continue }
    if (!out.target && TARGETS[a]) { out.target = a; continue }
  }
  return out
}

function usage () {
  console.log('')
  console.log('  iSparta-next · 预览台入口')
  console.log('')
  console.log('  用法：node scripts/dev/preview.js <目标> [--port N] [--no-open]')
  console.log('')
  Object.keys(TARGETS).forEach(function (k) {
    const t = TARGETS[k]
    console.log('    ' + k.padEnd(9) + ':' + String(t.port).padEnd(6) + t.label + '  —— ' + t.note)
  })
  console.log('')
  console.log('  默认自动打开浏览器；--no-open 只起服务。Ctrl+C 结束。')
  console.log('')
}

/** 问一下这个端口上是谁在应答；连不上返回 null */
function probe (port) {
  return new Promise(function (resolve) {
    const req = http.get({ host: '127.0.0.1', port: port, path: '/' }, function (res) {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { if (body.length < 200000) body += c })
      res.on('end', function () { resolve({ status: res.statusCode, body: body }) })
    })
    req.setTimeout(1200, function () { req.destroy(); resolve(null) })
    req.on('error', function () { resolve(null) })
  })
}

function isOurs (target, hit) {
  if (!hit) { return false }
  if (target.marker) { return hit.body.indexOf(target.marker) >= 0 }
  return hit.status >= 200 && hit.status < 400
}

/** 给「被别的服务占用」加一句能看懂的解释 */
function describe (hit) {
  if (!hit) { return '无应答' }
  const t = hit.body.match(/<title>([^<]*)</)
  const name = t ? t[1].trim() : '无标题'
  if (hit.body.indexOf('<title>iSparta-next</title>') >= 0) { return '桌面 Web/dev（' + name + '）' }
  if (hit.body.indexOf('<title>iSparta</title>') >= 0) { return 'CEP Web（' + name + '）' }
  if (hit.body.indexOf('id="dots"') >= 0) { return '引导页预览台' }
  if (hit.body.indexOf('id="hero-stage"') >= 0) { return '落地页预览' }
  return 'HTTP ' + hit.status + ' · ' + name
}

function sleep (ms) {
  return new Promise(function (r) { setTimeout(r, ms) })
}

/** 等子进程自己把地址打出来 */
async function waitForReportedPort (read, deadline) {
  while (Date.now() < deadline) {
    const m = read().match(URL_RE)
    if (m) { return Number(m[1]) }
    await sleep(POLL_MS)
  }
  return null
}

/** 兜底：子进程没打地址时，按请求端口（含顺延）探活 */
async function waitForHttp (target, base, deadline) {
  while (Date.now() < deadline) {
    for (let p = base; p <= base + 3; p++) {
      if (isOurs(target, await probe(p))) { return p }
    }
    await sleep(POLL_MS)
  }
  return null
}

/** 地址已打印 ≠ 已经能服务，补一次探活再宣布 */
async function confirmUp (port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probe(port)) { return true }
    await sleep(POLL_MS)
  }
  return false
}

function openBrowser (url) {
  const plat = process.platform
  let cmd, args
  if (plat === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '', url] }
  else if (plat === 'darwin') { cmd = 'open'; args = [url] }
  else { cmd = 'xdg-open'; args = [url] }
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
  } catch (e) {
    console.log('[preview] 打不开浏览器（' + e.message + '），手动访问上面的地址即可')
  }
}

/**
 * Windows 下不能直接 spawn .cmd/.bat（Node 18.20+ 起为 CVE-2024-27980 会抛
 * EINVAL），必须过一层 shell；这里的参数都是固定字面量，无引号风险。
 */
function spawnTool (cmd, args, opts) {
  if (process.platform === 'win32') {
    return spawn([cmd].concat(args).join(' '), Object.assign({ shell: true }, opts))
  }
  return spawn(cmd, args, opts)
}

async function main () {
  const opt = parseArgv(process.argv.slice(2))
  if (opt.help || !opt.target) {
    usage()
    process.exit(opt.help ? 0 : 1)
  }

  const target = TARGETS[opt.target]
  const base = opt.port || target.port
  // 显式 --port 时只在「那一个端口」上复用，不做邻近扫描 ——
  // 否则请求 :8096 会被 :8097 上残留的实例吸走，与用户意图不符。
  const scanTo = opt.port ? base : base + PORT_SPAN

  console.log('')
  console.log('  iSparta-next · ' + target.label)
  console.log('  ────────────────────────────────────────')

  // ① 预检：端口上已经有人应答吗？
  //    只有「能证明是自己的实例」（有 marker 且 marker 命中）才复用；否则一律
  //    自己起 —— 否则相邻端口上任何一个 HTTP 服务都会被当成「已经有同一个预览台」。
  const canReuse = !!target.marker
  for (let p = base; p <= scanTo; p++) {
    const hit = await probe(p)
    if (!hit) { continue }
    if (canReuse && isOurs(target, hit)) {
      console.log('  :' + p + ' 已经有同一个预览台在跑 → 直接打开，不再起第二个')
      console.log('')
      if (opt.open) { openBrowser('http://127.0.0.1:' + p + '/') }
      process.exit(0)
    }
    console.log('  ! :' + p + ' 被别的服务占用（' + describe(hit) + '），起服务时可能自动顺延')
  }

  // ② 起服务
  const args = target.cmd.slice(1).concat(target.dynamicPort ? [String(base)] : [])
  const child = spawnTool(target.cmd[0], args, {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      NODE_OPTIONS: [process.env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' ')
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  })

  let childOut = ''
  child.stdout.on('data', function (c) { childOut += c.toString(); process.stdout.write(c) })
  child.stderr.on('data', function (c) { childOut += c.toString(); process.stderr.write(c) })

  let settled = false

  child.on('exit', function (code, signal) {
    if (!settled) {
      settled = true
      console.log('')
      console.log('  [preview] 服务在就绪前退出（code=' + code + (signal ? ', signal=' + signal : '') + '）')
      process.exit(code === null ? 1 : code)
    }
    process.exit(code === null ? 0 : code)
  })

  child.on('error', function (err) {
    settled = true
    console.log('')
    console.log('  [preview] 起不来：' + err.message)
    process.exit(1)
  })

  process.on('SIGINT', function () {
    console.log('')
    console.log('  [preview] 收到 Ctrl+C，正在结束…')
    try { child.kill() } catch (e) { /* 可能已退出 */ }
  })

  // ③ 等就绪：以子进程自报地址为准，超时才退回端口探活
  const deadline = Date.now() + READY_TIMEOUT_MS
  const spinner = ['-', '\\', '|', '/']
  let tick = 0
  const spin = setInterval(function () {
    process.stdout.write('\r  ' + spinner[tick++ % 4] + ' 等待就绪… ')
  }, 120)

  let port = await waitForReportedPort(function () { return childOut }, deadline)
  let viaFallback = false
  if (port === null) {
    port = await waitForHttp(target, base, Date.now() + 20000)
    viaFallback = true
  }
  if (port !== null) { await confirmUp(port, 15000) }
  clearInterval(spin)
  process.stdout.write('\r' + ' '.repeat(40) + '\r')

  if (port === null) {
    settled = true
    console.log('  [preview] 等待 ' + (READY_TIMEOUT_MS / 1000) + 's 仍未就绪，放弃。看上方服务日志定位。')
    try { child.kill() } catch (e) { /* ignore */ }
    process.exit(1)
  }

  console.log('')
  console.log('  ✔ 就绪：http://127.0.0.1:' + port + '/')
  if (viaFallback) {
    console.log('    （服务没打印地址，端口是按探活推出来的）')
  } else if (port !== base) {
    console.log('    （实际端口从 :' + base + ' 顺延到 :' + port + ' —— 原端口被占）')
  }
  console.log('    ' + target.note)
  console.log('    Ctrl+C 结束')
  console.log('')
  if (opt.open) { openBrowser('http://127.0.0.1:' + port + '/') }
}

main().catch(function (e) {
  console.error('[preview] 意外失败：' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
