/**
 * 构建入口：把「每次都要手敲 + 手记」的几件事固化下来。
 *
 * 用法：
 *   node scripts/dev/build.js win                 # Windows 安装包（完整向导）
 *   node scripts/dev/build.js win --backup        # 构建前额外备份 targets/cep/ui
 *   node scripts/dev/build.js cep                 # 只重建 CEP 面板产物
 *   node scripts/dev/build.js win --dry           # 只打印环境与将要执行的命令
 *
 * 固化掉的三件事：
 *   ① 删除守卫豁免：vue.config.js 把 CEP 的 outputDir 指到 targets/cep/ui，
 *      构建会清空重建该目录，正常执行会撞上安全删除守卫。这里统一注入
 *      CODEBUDDY_SAFE_DELETE_ENABLED=0，不必每次手写前缀。
 *   ② 暴露面报告：先报告 targets/cep/ui 里有多少受控文件、有没有未跟踪文件 ——
 *      受控的都能 git 恢复，未跟踪的一旦被清掉就没了，必须先看见再决定。
 *   ③ 产物定位：构建成功后直接给出最新 exe 的绝对路径、体积、时间与 sha256，
 *      免去手工翻 dist_electron；失败则回显末尾日志而不是让人滚屏。
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const CEP_UI = path.join(ROOT, 'targets', 'cep', 'ui')
const DIST = path.join(ROOT, 'dist_electron')
const BACKUP_ROOT = path.join(ROOT, '.bak')

/** 失败时回显的日志尾部行数 */
const TAIL_LINES = 40

function parseArgv (argv) {
  const out = { mode: null, backup: false, dry: false, help: false }
  for (const a of argv) {
    if (a === '--backup') { out.backup = true; continue }
    if (a === '--dry' || a === '-n') { out.dry = true; continue }
    if (a === '-h' || a === '--help') { out.help = true; continue }
    if (!out.mode) { out.mode = a }
  }
  return out
}

function usage () {
  console.log('')
  console.log('  iSparta-next · 构建入口')
  console.log('')
  console.log('  用法：node scripts/dev/build.js <win|cep> [--backup] [--dry]')
  console.log('')
  console.log('    win        Windows 安装包（npm run build:windows，会自动豁免删除守卫）')
  console.log('    cep        只重建 CEP 面板产物（npm run build:cep → targets/cep/ui）')
  console.log('    --backup   win 模式构建前把 targets/cep/ui 备份到 .bak/（默认只报告不备份）')
  console.log('    --dry      只打印环境与命令，不真的执行')
  console.log('')
}

function hr (title) {
  console.log('')
  console.log('  ── ' + title + ' ' + '─'.repeat(Math.max(0, 52 - title.length)))
}

function mb (bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function stamp () {
  const d = new Date()
  const p = function (n, w) { return String(n).padStart(w || 2, '0') }
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
    p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
}

function git (args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch (e) {
    return ''
  }
}

/** 统一注入构建所需环境变量 */
function buildEnv (extra) {
  const nodeOptions = [process.env.NODE_OPTIONS, '--openssl-legacy-provider'].filter(Boolean).join(' ')
  return Object.assign({}, process.env, {
    NODE_OPTIONS: nodeOptions,
    CODEBUDDY_SAFE_DELETE_ENABLED: '0'
  }, extra || {})
}

/**
 * Windows 下不能直接 spawn .cmd/.bat（Node 18.20+ 起为 CVE-2024-27980 会抛
 * EINVAL），必须过一层 shell；这里传的是固定字面量参数，不存在引号注入问题。
 */
function spawnTool (cmd, args, opts) {
  if (process.platform === 'win32') {
    return spawn([cmd].concat(args).join(' '), Object.assign({ shell: true }, opts))
  }
  return spawn(cmd, args, opts)
}

/** 跑一条命令，输出实时透传，同时留一份尾部日志用于失败回显 */
function run (cmd, args, env) {
  return new Promise(function (resolve) {
    console.log('  $ ' + cmd + ' ' + args.join(' '))
    console.log('')
    const child = spawnTool(cmd, args, { cwd: ROOT, env: env, stdio: ['ignore', 'pipe', 'pipe'] })
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
    child.on('error', function (err) {
      resolve({ code: 1, tail: tail.slice(-TAIL_LINES).concat(['[spawn error] ' + err.message]) })
    })
    child.on('exit', function (code) {
      resolve({ code: code === null ? 1 : code, tail: tail.slice(-TAIL_LINES) })
    })
  })
}

function reportExposure () {
  hr('清理暴露面 · targets/cep/ui')
  const tracked = git(['ls-files', 'targets/cep/ui']).split('\n').filter(Boolean).length
  const porcelain = git(['status', '--porcelain', '--untracked-files=all', '--', 'targets/cep/ui'])
    .split('\n').filter(Boolean)
  const untracked = porcelain.filter(function (l) { return l.startsWith('??') }).map(function (l) { return l.slice(3) })
  const modified = porcelain.filter(function (l) { return !l.startsWith('??') }).length

  console.log('  vue.config.js 把 CEP 的 outputDir 指到该目录 → 构建会清空重建。')
  console.log('  受控文件 ' + tracked + ' 个（可用 git 恢复）；已改动 ' + modified + ' 个。')
  if (untracked.length === 0) {
    console.log('  未跟踪文件：无 —— 即使被清掉也能完整 git 恢复。')
  } else {
    console.log('  ⚠ 未跟踪文件 ' + untracked.length + ' 个（被清掉即不可恢复）：')
    untracked.slice(0, 20).forEach(function (f) { console.log('      ' + f) })
    if (untracked.length > 20) { console.log('      … 另有 ' + (untracked.length - 20) + ' 个') }
  }
  return untracked.length
}

function backupCepUi () {
  const dest = path.join(BACKUP_ROOT, 'cep-ui-' + stamp())
  fs.mkdirSync(BACKUP_ROOT, { recursive: true })
  fs.cpSync(CEP_UI, dest, { recursive: true })
  console.log('  已备份 → ' + path.relative(ROOT, dest))
}

function sha256 (file) {
  try {
    const h = crypto.createHash('sha256')
    h.update(fs.readFileSync(file))
    return h.digest('hex')
  } catch (e) {
    return '(计算失败)'
  }
}

function newestInstaller () {
  if (!fs.existsSync(DIST)) { return null }
  let best = null
  for (const name of fs.readdirSync(DIST)) {
    if (!/\.exe$/i.test(name)) { continue }
    const full = path.join(DIST, name)
    const st = fs.statSync(full)
    if (!st.isFile()) { continue }
    // 注意：比较用的 mtimeMs 必须一并存进 best —— 只存 mtime(Date) 会让
    // best.mtimeMs 恒为 undefined，比较永远为假，于是永远选中目录里的第一个文件。
    if (!best || st.mtimeMs > best.mtimeMs) {
      best = { full: full, name: name, size: st.size, mtime: st.mtime, mtimeMs: st.mtimeMs }
    }
  }
  return best
}

function reportArtifact () {
  hr('产物')
  const exe = newestInstaller()
  if (!exe) {
    console.log('  dist_electron/ 下没有 .exe —— 构建可能提前失败，先看上面的日志。')
    return
  }
  console.log('  文件    ' + exe.full)
  console.log('  体积    ' + mb(exe.size))
  console.log('  时间    ' + exe.mtime.toLocaleString())
  console.log('  版本    ' + (git(['describe', '--tags', '--abbrev=0']) || '').trim())
  console.log('  sha256  ' + sha256(exe.full))
  console.log('')
  console.log('  双击即可测试安装：向导应出现「安装模式」页与只含桌面版 / AE 扩展两张卡片的组件页。')
}

function reportFail (res) {
  hr('失败 · 日志末尾')
  res.tail.forEach(function (l) { console.log('  | ' + l) })
  console.log('')
  console.log('  完整日志：见调用方重定向的 build.log / build.err')
}

async function buildWin (opt) {
  hr('环境')
  console.log('  node            ' + process.version)
  console.log('  CODEBUDDY_SAFE_DELETE_ENABLED=0   （构建会清空 targets/cep/ui，需豁免守卫）')
  console.log('  NODE_OPTIONS    --openssl-legacy-provider')

  const untracked = reportExposure()
  if (opt.backup) {
    backupCepUi()
  } else if (untracked > 0) {
    console.log('')
    console.log('  ⚠ 有未跟踪文件但没加 --backup。若它们重要，先 Ctrl+C 并改用：')
    console.log('      node scripts/dev/build.js win --backup')
    console.log('      （全部在 git 里的话不用管，git checkout -- targets/cep/ui 即可恢复）')
  }

  if (opt.dry) {
    hr('dry run')
    console.log('  将执行：' + npmCmd + ' run build:windows')
    console.log('  产物目录：' + DIST)
    return 0
  }

  hr('构建')
  const started = Date.now()
  const res = await run(npmCmd, ['run', 'build:windows'], buildEnv())
  const cost = Math.round((Date.now() - started) / 1000)
  console.log('')
  console.log('  退出码 ' + res.code + ' · 耗时 ' + cost + 's')
  if (res.code !== 0) {
    reportFail(res)
    return res.code
  }
  reportArtifact()
  return 0
}

async function buildCep (opt) {
  hr('环境')
  console.log('  node            ' + process.version)
  console.log('  目标目录        targets/cep/ui')

  if (opt.dry) {
    hr('dry run')
    console.log('  将执行：' + npmCmd + ' run build:cep')
    return 0
  }

  hr('构建')
  const res = await run(npmCmd, ['run', 'build:cep'], buildEnv())
  if (res.code !== 0) {
    console.log('')
    console.log('  退出码 ' + res.code)
    reportFail(res)
    return res.code
  }

  hr('产物')
  const bundle = path.join(CEP_UI, 'js', 'index.js')
  if (fs.existsSync(bundle)) {
    const st = fs.statSync(bundle)
    console.log('  js/index.js     ' + mb(st.size) + ' · ' + st.mtime.toLocaleString())
  } else {
    console.log('  ! 没找到 targets/cep/ui/js/index.js —— 检查 vue.config.js 的 outputDir 与 entry。')
  }

  const porcelain = git(['status', '--porcelain', '--', 'targets/cep/ui']).split('\n').filter(Boolean)
  if (porcelain.length === 0) {
    console.log('  与 HEAD 一致，无漂移。')
  } else {
    console.log('  与 HEAD 有差异 ' + porcelain.length + ' 项 —— 需要的话随源码一起提交，')
    console.log('  否则 targets/cep/ui 会与 src/ 悄悄脱节（历史上有过这种漂移）。')
    porcelain.slice(0, 12).forEach(function (l) { console.log('      ' + l) })
    if (porcelain.length > 12) { console.log('      … 另有 ' + (porcelain.length - 12) + ' 项') }
  }
  return 0
}

async function main () {
  const opt = parseArgv(process.argv.slice(2))
  if (opt.help || !opt.mode) {
    usage()
    process.exit(opt.help ? 0 : 1)
  }
  if (opt.mode !== 'win' && opt.mode !== 'cep') {
    console.log('  未知目标：' + opt.mode)
    usage()
    process.exit(1)
  }
  const code = opt.mode === 'win' ? await buildWin(opt) : await buildCep(opt)
  console.log('')
  process.exit(code)
}

main().catch(function (e) {
  console.error('[build] 意外失败：' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
