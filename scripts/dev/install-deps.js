// Web/CEP UI 模式不需要为 Electron 重建原生依赖；默认安装及 CI 保持原行为。
const { spawnSync } = require('child_process')
if (process.env.ISPARTA_UI_ONLY === '1') {
  console.log('UI 模式：跳过 Electron 原生依赖安装')
} else {
  const entry = require.resolve('electron-builder/cli.js')
  const result = spawnSync(process.execPath, [entry, 'install-app-deps'], { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status === null ? 1 : result.status
}
