/**
 * 体检入口：把「改完代码/准备出包前该跑的那几项」合成一条命令。
 *
 * 用法：
 *   node scripts/dev/check.js lint         # npm run lint（与 pre-commit 同一套）
 *   node scripts/dev/check.js pack         # npm run doctor:pack（出包前自检）
 *   node scripts/dev/check.js version      # npm run doctor:version（版本一致性守卫）
 *   node scripts/dev/check.js ports        # 8080–8099 监听占用 + 归属识别
 *   node scripts/dev/check.js cep          # CEP 兼容静态守卫（改桌面 UI/交互后必跑，见 AGENTS.md §8.6）
 *   node scripts/dev/check.js all          # lint + pack + version + cep + ports
 *
 * cep 为什么值得做：桌面与 CEP 共用大量源文件（component / tip / locales），桌面一处改动
 * 经常悄悄改变 CEP 行为。这里静态守住"共享源未分叉 + 宿主门控在 + 三语齐 + tip 归属域完整"，
 * 浏览器 mock 实测仍需人工按 AGENTS.md §8.6 / ACCEPTANCE-RUNBOOK.md G 章做，本命令不替代真机。
 *
 * ports 为什么值得单独做：
 *   桌面 dev :8081 / CEP :8082 / 落地页 :8080 / 引导台 :8090 会互相顺延抢占，
 *   残留的旧实例还会让「预览打开的是谁」变得说不清。这里把监听进程和归属一次
 *   摊开，并给出可直接执行的清理命令。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const { spawn, execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

/** 关注端口区间：本仓库所有 dev / 预览端口都落在这里 */
const PORT_FROM = 8080
const PORT_TO = 8099
const TAIL_LINES = 40

function parseArgv (argv) {
  const out = { cmd: null, help: false }
  for (const a of argv) {
    if (a === '-h' || a === '--help') { out.help = true; continue }
    if (!out.cmd) { out.cmd = a }
  }
  return out
}

function usage () {
  console.log('')
  console.log('  iSparta-next · 体检入口')
  console.log('')
  console.log('  用法：node scripts/dev/check.js <lint|pack|version|ports|cep|all>')
  console.log('')
  console.log('    lint     vue-cli 全仓 lint（pre-commit 也跑这个）')
  console.log('    pack     出包前自检：图标 / 向导图 / 编码器目录 / CEP payload / NSIS 钩子')
  console.log('    version  版本一致性：package.json / lock / release notes / CEP payload / mac 清单')
  console.log('    ports    ' + PORT_FROM + '–' + PORT_TO + ' 监听占用、所属进程与归属识别')
  console.log('    cep      CEP 兼容静态守卫：共享源 / 宿主门控 / 三语 / tip 归属域（改桌面 UI 后必跑）')
  console.log('    all      上面五项依次跑')
  console.log('')
}

function hr (title) {
  console.log('')
  console.log('  ── ' + title + ' ' + '─'.repeat(Math.max(0, 52 - title.length)))
}

function spawnTool (cmd, args, opts) {
  if (process.platform === 'win32') {
    return spawn([cmd].concat(args).join(' '), Object.assign({ shell: true }, opts))
  }
  return spawn(cmd, args, opts)
}

function run (cmd, args, env) {
  return new Promise(function (resolve) {
    console.log('  $ ' + cmd + ' ' + args.join(' '))
    console.log('')
    const child = spawnTool(cmd, args, { cwd: ROOT, env: env || process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    const tail = []
    const feed = function (buf, isErr) {
      const text = buf.toString()
      ;(isErr ? process.stderr : process.stdout).write(text)
      for (const line of text.split(/\r?\n/)) {
        if (line === '') { continue }
        tail.push(line)
        if (tail.length > 400) { tail.shift() }
      }
    }
    child.stdout.on('data', function (b) { feed(b, false) })
    child.stderr.on('data', function (b) { feed(b, true) })
    child.on('error', function (err) { resolve({ code: 1, tail: tail.slice(-TAIL_LINES).concat(['[spawn error] ' + err.message]) }) })
    child.on('exit', function (code) { resolve({ code: code === null ? 1 : code, tail: tail.slice(-TAIL_LINES) }) })
  })
}

function probe (port) {
  return new Promise(function (resolve) {
    const req = http.get({ host: '127.0.0.1', port: port, path: '/' }, function (res) {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { if (body.length < 200000) body += c })
      res.on('end', function () { resolve({ status: res.statusCode, body: body }) })
    })
    req.setTimeout(800, function () { req.destroy(); resolve(null) })
    req.on('error', function () { resolve(null) })
  })
}

/** 按页面独有标记判断这个端口上到底是谁 */
function identify (hit) {
  if (!hit) { return '（无 HTTP 应答）' }
  if (hit.body.indexOf('id="hero-stage"') >= 0) { return '落地页预览（scripts/serve-landing.js）' }
  if (hit.body.indexOf('id="dots"') >= 0) { return '引导页预览台（scripts/dev/serve-guide-preview.js）' }
  if (hit.body.indexOf('<title>iSparta-next</title>') >= 0) { return 'vue-cli · 桌面 Web/dev（npm run serve｜dev）' }
  if (hit.body.indexOf('<title>iSparta</title>') >= 0) { return 'vue-cli · CEP Web（npm run serve:cep）' }
  if (hit.body.indexOf('id="app"') >= 0) { return 'vue-cli 应用（标题不匹配，可能是旧版本）' }
  return '其他 HTTP 服务'
}

/** 同步取进程输出；显式 stdio 是必须的（否则在受限环境里 spawnSync 会 EBUSY） */
function capture (cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

function listeners () {
  const rows = []
  let out = ''
  try {
    if (process.platform === 'win32') {
      out = capture('netstat', ['-ano'])
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/^\s*TCP\s+(\S+):(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i)
        if (!m) { continue }
        const port = Number(m[2])
        if (port < PORT_FROM || port > PORT_TO) { continue }
        rows.push({ port: port, addr: m[1], pid: Number(m[3]) })
      }
    } else {
      out = capture('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'])
      for (const line of out.split('\n')) {
        const m = line.match(/^(.*?)\s+(\d+)\s+.*TCP\s+\S*:(\d+)\s+\(LISTEN\)/)
        if (!m) { continue }
        const port = Number(m[3])
        if (port < PORT_FROM || port > PORT_TO) { continue }
        rows.push({ port: port, addr: '-', pid: Number(m[2]), proc: m[1] })
      }
    }
  } catch (e) {
    // 以前这里静默吞掉，结果把「查不到」误报成「端口干净」——宁可报错也不许假阴性
    return { rows: [], error: e.message }
  }
  // 同一端口可能同时有 IPv4 / IPv6 两条，按 pid 去重
  const seen = {}
  const deduped = rows.filter(function (r) {
    const k = r.port + '|' + r.pid
    if (seen[k]) { return false }
    seen[k] = true
    return true
  }).sort(function (a, b) { return a.port - b.port })
  return { rows: deduped, error: null }
}

function pidName (pid) {
  try {
    if (process.platform === 'win32') {
      const csv = capture('tasklist', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH'])
      const m = csv.match(/^"([^"]+)"/)
      return m ? m[1].replace(/\.exe$/i, '') : '?'
    }
    return capture('ps', ['-p', String(pid), '-o', 'comm=']).trim()
  } catch (e) {
    return '?'
  }
}

async function checkPorts () {
  hr('端口 · ' + PORT_FROM + '–' + PORT_TO)
  const listed = listeners()
  if (listed.error) {
    console.log('  ✘ 查不到监听表：' + listed.error)
    console.log('    这个子命令需要能执行 netstat（Windows）/ lsof（macOS、Linux）。')
    return { code: 1, stray: 0 }
  }
  const rows = listed.rows
  if (rows.length === 0) {
    console.log('  干净：这个区间没有任何监听。')
    return { code: 0, stray: 0 }
  }
  console.log('  端口    进程            PID      归属')
  for (const r of rows) {
    const hit = await probe(r.port)
    const who = identify(hit)
    console.log('  :' + String(r.port).padEnd(6) + String(pidName(r.pid)).padEnd(15) +
      String(r.pid).padEnd(9) + who)
  }
  console.log('')
  console.log('  一键清理（按需挑 PID）：')
  rows.forEach(function (r) {
    console.log('    taskkill /PID ' + r.pid + ' /F        rem :' + r.port + ' ' + pidName(r.pid))
  })
  return { code: 0, stray: rows.length }
}

/**
 * CEP 兼容静态守卫：守住 §8.6 里"能用文本静态查"的部分。
 * 浏览器 mock / 真机实测不在这里——那是 AGENTS.md §8.6 第 3 步与验收手册 G 章的事。
 * 任何一项失败都返回 code 1，让 check.js all 一并失败。
 */
function checkCep () {
  hr('CEP 兼容静态守卫')
  const problems = []
  const read = function (rel) {
    const abs = path.join(ROOT, rel)
    if (!fs.existsSync(abs)) { problems.push('缺文件：' + rel); return '' }
    return fs.readFileSync(abs, 'utf8')
  }
  const expect = function (ok, msg) { if (!ok) { problems.push(msg) } }

  // 1) 共享源未分叉：CEP 两个入口都引同一 tip / i18n，且 CEP 侧不得出现平行组件副本
  const cepMain = read('src/cep/main.js')
  const cepSettings = read('src/cep/settings.js')
  expect(/import .*['"]\.\.\/ui-next\/tip['"]/.test(cepMain), 'src/cep/main.js 未引用共享 ui-next/tip')
  expect(/import .*['"]\.\.\/ui-next\/tip['"]/.test(cepSettings), 'src/cep/settings.js 未引用共享 ui-next/tip')
  expect(/import .*['"]\.\.\/i18n['"]/.test(cepMain), 'src/cep/main.js 未引用共享 i18n')
  const cepDir = path.join(ROOT, 'src', 'cep')
  if (fs.existsSync(cepDir)) {
    const dup = fs.readdirSync(cepDir).filter(function (f) {
      return /^(projectList|setting|projectList\.vue|setting\.vue)$/i.test(f)
    })
    expect(dup.length === 0, 'CEP 侧出现平行组件副本（应复用共享源）：' + dup.join(', '))
  }

  // 2) 宿主门控：桌面/CEP 分流的关键判定仍在（被误删会让 CEP 误显桌面专属 UI）
  const list = read('src/components/projectList/projectList.vue')
  expect(/showOutPath/.test(list), 'projectList.vue 缺 showOutPath 门控（CEP 路径/第三行分流）')
  expect(/showOutPath \? sourceNameOf\(project\) : displayTitleOf\(project, index\)/.test(list),
    'projectList.vue 合成名分流被改：CEP 应走 displayTitleOf 文本分支')
  const setting = read('src/components/setting/setting.vue')
  expect(/isCepHost|supportsCompImport/.test(setting), 'setting.vue 缺 CEP 宿主门控（isCepHost/supportsCompImport）')

  // 3) 三语 key 齐：以 zh-cn 为基准，zh-tw / en-us 不得缺 key
  const keySet = function (src) {
    const out = new Set()
    const re = /"([A-Za-z0-9_]+)"\s*:/g
    let m
    while ((m = re.exec(src)) !== null) { out.add(m[1]) }
    return out
  }
  const zh = keySet(read('src/locales/zh-cn.js'))
  const tw = keySet(read('src/locales/zh-tw.js'))
  const en = keySet(read('src/locales/en-us.js'))
  ;[['zh-tw', tw], ['en-us', en]].forEach(function (pair) {
    const missing = []
    zh.forEach(function (k) { if (!pair[1].has(k)) { missing.push(k) } })
    expect(missing.length === 0, pair[0] + ' 缺 key：' + missing.slice(0, 8).join(', ') + (missing.length > 8 ? ' …' : ''))
  })

  // 4) tip 单例归属域：任务条须打归属标记，指令须有恢复逻辑（防 CEP 详情被子树 tip 劫持）
  expect(/data-tip-owner/.test(list), 'projectList.vue 任务条缺 data-tip-owner 归属标记')
  const tip = read('src/ui-next/tip.js')
  expect(/function ownerOf/.test(tip) && /data-tip-owner/.test(tip), 'tip.js 缺 ownerOf 归属域判定')
  expect(/function onLeave/.test(tip) && /show\(from, from\._tip\.binding, evt\)/.test(tip),
    'tip.js 缺 onLeave 同域恢复详情逻辑')
  expect(/leave: \(evt\) => onLeave\(el, evt\)/.test(tip), 'tip.js 的 leave 未挂 onLeave（会退回单例被劫持）')

  if (problems.length === 0) {
    console.log('  CEP 兼容静态守卫：通过（共享源 / 宿主门控 / 三语 / tip 归属域）')
    console.log('  提醒：本检查不替代 mock 实测，收尾仍需按 AGENTS.md §8.6 在 :8082/?mock=1 逐项验证。')
    return { code: 0 }
  }
  console.log('  ✘ CEP 兼容静态守卫发现 ' + problems.length + ' 项问题：')
  problems.forEach(function (p) { console.log('    - ' + p) })
  return { code: 1 }
}

async function main () {
  const opt = parseArgv(process.argv.slice(2))
  const known = ['lint', 'pack', 'version', 'ports', 'cep', 'all']
  if (opt.help || !opt.cmd) {
    usage()
    process.exit(opt.help ? 0 : 1)
  }
  if (known.indexOf(opt.cmd) < 0) {
    console.log('  未知子命令：' + opt.cmd)
    usage()
    process.exit(1)
  }

  const results = []

  if (opt.cmd === 'lint' || opt.cmd === 'all') {
    hr('lint')
    const res = await run(npmCmd, ['run', 'lint'])
    console.log('')
    console.log('  lint ' + (res.code === 0 ? '通过' : '失败（退出码 ' + res.code + '）'))
    if (res.code !== 0) {
      hr('lint 日志末尾')
      res.tail.forEach(function (l) { console.log('  | ' + l) })
    }
    results.push({ name: 'lint', code: res.code })
  }

  if (opt.cmd === 'pack' || opt.cmd === 'all') {
    hr('出包自检 doctor:pack')
    const res = await run(npmCmd, ['run', 'doctor:pack'])
    console.log('')
    console.log('  doctor:pack ' + (res.code === 0 ? '通过' : '失败（退出码 ' + res.code + '）'))
    if (res.code !== 0) {
      hr('doctor:pack 日志末尾')
      res.tail.forEach(function (l) { console.log('  | ' + l) })
    }
    results.push({ name: 'doctor:pack', code: res.code })
  }

  if (opt.cmd === 'version' || opt.cmd === 'all') {
    hr('版本一致性 doctor:version')
    const res = await run(npmCmd, ['run', 'doctor:version'])
    console.log('')
    console.log('  doctor:version ' + (res.code === 0 ? '通过' : '失败（退出码 ' + res.code + '）'))
    if (res.code !== 0) {
      hr('doctor:version 日志末尾')
      res.tail.forEach(function (l) { console.log('  | ' + l) })
    }
    results.push({ name: 'doctor:version', code: res.code })
  }

  if (opt.cmd === 'ports' || opt.cmd === 'all') {
    const r = await checkPorts()
    results.push({ name: 'ports', code: r.code })
  }

  if (opt.cmd === 'cep' || opt.cmd === 'all') {
    const r = checkCep()
    results.push({ name: 'cep', code: r.code })
  }

  if (results.length > 1) {
    hr('汇总')
    results.forEach(function (r) {
      console.log('  ' + (r.code === 0 ? '✔' : '✘') + '  ' + r.name)
    })
  }
  console.log('')

  const failed = results.some(function (r) { return r.code !== 0 })
  process.exit(failed ? 1 : 0)
}

main().catch(function (e) {
  console.error('[check] 意外失败：' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
