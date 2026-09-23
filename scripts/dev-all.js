/**
 * 一键启动开发预览：
 *   landing:8080 + 桌面 Web:8081 + CEP:8082
 * 用法：
 *   node scripts/dev-all.js           # 三端
 *   node scripts/dev-all.js --electron # 再加 electron:serve
 *   node scripts/dev-all.js --only landing,web
 * Ctrl+C 结束全部。
 */
const { spawn } = require('child_process')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const argv = process.argv.slice(2)
const wantElectron = argv.indexOf('--electron') >= 0
var only = null
var onlyIdx = argv.indexOf('--only')
if (onlyIdx >= 0 && argv[onlyIdx + 1]) {
  only = String(argv[onlyIdx + 1]).split(',').map(function (s) { return s.trim() }).filter(Boolean)
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const kids = []

function run (name, cmd, args) {
  if (only && only.indexOf(name) < 0) { return }
  console.log('[dev-all] start ' + name + ': ' + cmd + ' ' + args.join(' '))
  const child = spawn(cmd, args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    shell: process.platform === 'win32'
  })
  kids.push(child)
  function pipe (stream, tag) {
    stream.on('data', function (d) {
      String(d).split(/\r?\n/).forEach(function (line) {
        if (line) { console.log('[' + tag + '] ' + line) }
      })
    })
  }
  pipe(child.stdout, name)
  pipe(child.stderr, name)
  child.on('exit', function (code) {
    console.log('[dev-all] exit ' + name + ' code=' + code)
  })
}

function shutdown () {
  kids.forEach(function (c) {
    try { c.kill('SIGTERM') } catch (e) { /* ignore */ }
  })
  setTimeout(function () { process.exit(0) }, 300)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

run('landing', process.execPath, [path.join(ROOT, 'scripts', 'serve-landing.js')])
run('web', npmCmd, ['run', 'serve'])
run('cep', npmCmd, ['run', 'dev:cep'])
if (wantElectron) {
  run('electron', npmCmd, ['run', 'dev'])
}

console.log('[dev-all] landing http://127.0.0.1:8080 | web http://127.0.0.1:8081 | cep HMR http://127.0.0.1:8082')
console.log('[dev-all] CEP 默认 HMR；收工 npm run dev:cep:off')

