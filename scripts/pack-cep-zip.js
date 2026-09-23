/**
 * 打独立 AE 扩展 zip（可选分发；主路径为 NSIS 一体安装）。
 * 先 prepare-cep-payload，再打成 dist/isparta-next-cep-<version>-win-x64.zip
 * zip 根目录为 io.github.isparta-next/，可直接解压到 CEP extensions。
 * 用法：node scripts/pack-cep-zip.js
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '..')
const EXT_ID = 'io.github.isparta-next'
const payloadRoot = path.join(root, 'build', 'cep-payload')
const payloadExt = path.join(payloadRoot, EXT_ID)

function main () {
  execFileSync(process.execPath, [path.join(__dirname, 'prepare-cep-payload.js')], {
    cwd: root,
    stdio: 'inherit'
  })
  if (!fs.existsSync(path.join(payloadExt, 'CSXS', 'manifest.xml'))) {
    console.error('pack-cep-zip FAIL payload 不完整：', payloadExt)
    process.exit(1)
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const outDir = path.join(root, 'dist')
  fs.mkdirSync(outDir, { recursive: true })
  const zipPath = path.join(outDir, `isparta-next-cep-${pkg.version}-win-x64.zip`)
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  // Windows：Compress-Archive；zip 根含扩展目录名
  const ps = `Compress-Archive -Path '${payloadExt}' -DestinationPath '${zipPath}' -Force`
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })

  const size = fs.statSync(zipPath).size
  console.log('pack-cep-zip OK')
  console.log('  zip  ', path.relative(root, zipPath), `(${size} bytes)`)
  console.log('  解压到 %APPDATA%\\Adobe\\CEP\\extensions\\ 后重启 AE')
}

main()
