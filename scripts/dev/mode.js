/** 本地模式工具，不改全局配置：node scripts/dev/mode.js web|desktop|cep install|clean|preview [--apply] */
const path = require('path')
const { spawnSync } = require('child_process')
const root = path.resolve(__dirname, '../..')
const [mode, action, ...flags] = process.argv.slice(2)
if (!['web', 'desktop', 'cep'].includes(mode) || !['install', 'clean', 'preview'].includes(action) ||
    flags.some(f => f !== '--apply') || (flags.length && action !== 'clean')) {
  console.error('用法：node scripts/dev/mode.js web|desktop|cep install|clean|preview [--apply（仅 clean）]')
  process.exit(1)
}
const env = { ...process.env }
function run (cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npm'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
if (action === 'clean') {
  run(process.execPath, ['scripts/dev/clean-build.js', ...(mode === 'desktop' ? [] : ['--without-electron']), ...flags])
} else if (action === 'preview') {
  run(process.execPath, ['scripts/dev/preview.js', mode])
} else {
  if (mode !== 'desktop') {
    env.ELECTRON_SKIP_BINARY_DOWNLOAD = '1'
    env.ISPARTA_UI_ONLY = '1'
  } else {
    delete env.ELECTRON_SKIP_BINARY_DOWNLOAD
    delete env.ISPARTA_UI_ONLY
  }
  run('npm', ['install'])
  // 已安装的包不会重新执行 postinstall，显式恢复先前清理的运行时。
  if (mode === 'desktop') run(process.execPath, ['node_modules/electron/install.js'])
}
