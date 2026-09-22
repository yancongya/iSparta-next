/**
 * 出包体积门禁：单文件或目录（release/）内安装包超限则失败。
 * 用法：
 *   node scripts/audit-bundle-size.js dist_electron/isparta-next-3.3.17-win-x64.exe
 *   node scripts/audit-bundle-size.js --dir release
 *   node scripts/audit-bundle-size.js --artifact-path <file>
 * 环境变量 ISPARTA_SIZE_LIMIT_MB 可覆盖默认上限（MiB）。
 */
const fs = require('fs')
const path = require('path')

const ARTIFACT_EXTS = new Set([
  '.exe',
  '.dmg',
  '.zip',
  '.appimage',
  '.deb',
  '.rpm',
  '.tar.gz',
  '.tgz',
  '.7z'
])

// 默认上限（MiB）：当前 win64 安装包约 83MB（含 public/bin 编码器），留出合理余量
const DEFAULT_LIMITS_MB = {
  default: 150,
  '.exe': 150,
  '.dmg': 200,
  '.zip': 200,
  '.appimage': 200,
  '.deb': 200,
  '.rpm': 200,
  '.tar.gz': 200,
  '.tgz': 200,
  '.7z': 200
}

function formatMiB (bytes) {
  return (bytes / 1024 / 1024).toFixed(1) + ' MiB'
}

function extOf (name) {
  const lower = String(name).toLowerCase()
  if (lower.endsWith('.tar.gz')) { return '.tar.gz' }
  return path.extname(lower)
}

function resolveLimit (ext) {
  const override = Number(process.env.ISPARTA_SIZE_LIMIT_MB)
  if (Number.isFinite(override) && override > 0) { return override }
  return DEFAULT_LIMITS_MB[ext] || DEFAULT_LIMITS_MB.default
}

function parseArgs (argv) {
  const out = { dir: null, files: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dir' || a === '--artifact-path') {
      const v = argv[++i]
      if (!v) {
        console.error('Missing value for ' + a)
        process.exit(2)
      }
      if (a === '--dir') { out.dir = v } else { out.files.push(v) }
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/audit-bundle-size.js [--dir <dir>] [--artifact-path <file>] [file...]')
      process.exit(0)
    } else if (!a.startsWith('-')) {
      out.files.push(a)
    }
  }
  return out
}

function collectArtifacts (args) {
  const found = []
  if (args.dir) {
    const abs = path.resolve(args.dir)
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      console.error('Not a directory: ' + abs)
      process.exit(2)
    }
    for (const name of fs.readdirSync(abs)) {
      const ext = extOf(name)
      if (ARTIFACT_EXTS.has(ext) && !name.toLowerCase().endsWith('.blockmap')) {
        found.push(path.join(abs, name))
      }
    }
  }
  for (const f of args.files) {
    found.push(path.resolve(f))
  }
  return found
}

function main () {
  const args = parseArgs(process.argv.slice(2))
  const artifacts = collectArtifacts(args)
  if (!artifacts.length) {
    console.error('No artifacts to audit. Pass a file, or --dir with installers.')
    process.exit(2)
  }

  let failed = 0
  for (const abs of artifacts) {
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      console.error('Missing artifact: ' + abs)
      failed++
      continue
    }
    const ext = extOf(path.basename(abs))
    const limit = resolveLimit(ext)
    const size = fs.statSync(abs).size
    const sizeMiB = size / 1024 / 1024
    const ok = sizeMiB <= limit
    console.log((ok ? 'OK  ' : 'FAIL') + '  ' + path.basename(abs))
    console.log('      type=' + (ext || '<none>') + '  size=' + formatMiB(size) + '  limit=' + limit + ' MiB')
    if (!ok) {
      failed++
      console.error('      exceeds limit by ' + (sizeMiB - limit).toFixed(1) + ' MiB')
    }
  }

  if (failed) {
    console.error('')
    console.error('Bundle size audit failed: ' + failed + ' artifact(s) over limit.')
    process.exit(1)
  }
  console.log('')
  console.log('Bundle size audit passed (' + artifacts.length + ' artifact(s)).')
}

main()
