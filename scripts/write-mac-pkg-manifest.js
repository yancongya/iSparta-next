/** Separate pkg update channel; electron-builder's latest-mac.yml remains for zip builds. */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const root = path.join(__dirname, '..')
const version = require(path.join(root, 'package.json')).version
const releaseDir = path.join(root, 'release')
const files = ['x64', 'arm64'].map((arch) => {
  const url = `isparta-next-${version}-mac-${arch}.pkg`
  const full = path.join(releaseDir, url)
  if (!fs.existsSync(full)) throw new Error(`Missing macOS installer: ${full}`)
  return {
    url,
    size: fs.statSync(full).size,
    sha512: crypto.createHash('sha512').update(fs.readFileSync(full)).digest('base64')
  }
})
const lines = [`version: ${version}`, 'files:']
for (const file of files) {
  lines.push(`  - url: ${file.url}`, `    sha512: ${file.sha512}`, `    size: ${file.size}`)
}
const out = path.join(releaseDir, 'latest-mac-pkg.yml')
fs.writeFileSync(out, lines.join('\n') + '\n')
console.log(`macOS pkg manifest: ${out}`)
