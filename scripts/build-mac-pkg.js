#!/usr/bin/env node
/* Package the electron-builder macOS .app and its embedded CEP payload together. */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const arch = process.argv[process.argv.indexOf('--arch') + 1]
if (!['x64', 'arm64'].includes(arch)) {
  console.error('Usage: node scripts/build-mac-pkg.js --arch x64|arm64')
  process.exit(2)
}
if (process.platform !== 'darwin') {
  console.error('macOS pkg must be assembled on macOS')
  process.exit(2)
}
const version = require(path.join(root, 'package.json')).version
const appDir = path.join(root, 'dist_electron', arch === 'arm64' ? 'mac-arm64' : 'mac')
const app = path.join(appDir, 'iSparta-next.app')
const cep = path.join(app, 'Contents', 'Resources', 'cep', 'io.github.isparta-next')
if (!fs.existsSync(path.join(cep, 'CSXS', 'manifest.xml')) || !fs.existsSync(path.join(cep, 'version.json'))) {
  console.error('Packaged .app is missing its CEP payload:', cep)
  process.exit(1)
}
const out = path.join(root, 'dist_electron', `isparta-next-${version}-mac-${arch}.pkg`)
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-mac-pkg-'))
function run (command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} exited ${result.status}`)
}
try {
  const payload = path.join(temp, 'payload', 'Applications')
  fs.mkdirSync(payload, { recursive: true })
  fs.cpSync(app, path.join(payload, 'iSparta-next.app'), { recursive: true, preserveTimestamps: true })
  const component = path.join(temp, 'component.pkg')
  run('pkgbuild', ['--root', path.join(temp, 'payload'), '--scripts', path.join(root, 'scripts', 'mac-pkg'), '--identifier', 'io.github.isparta-next', '--version', version, '--install-location', '/', component])
  run('productbuild', ['--package', component, out])
  console.log(out)
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
