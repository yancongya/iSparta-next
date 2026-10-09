/**
 * 打独立 AE 扩展 zip（可选分发；主路径为 NSIS 一体安装）。
 * 先 prepare-cep-payload，再打成 dist/isparta-next-cep-<version>-<plat>-x64.zip
 * zip 根目录为 io.github.isparta-next/，可直接解压到 CEP extensions。
 *
 * 用法：
 *   node scripts/pack-cep-zip.js              # = --platform win
 *   node scripts/pack-cep-zip.js --platform mac
 *
 * --platform 的意义不只是文件名：**安装辅助文件按平台取子集**。
 * Windows 包带 Add Keys.reg + 安装方法-Windows.txt，
 * macOS 包带 install-as-admin + 安装方法-macOS.txt；
 * 混装会让人在 mac 上双击 .reg、或在 Windows 上跑 bash 脚本。
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const {
  EXT_ID,
  copyTree,
  SKIP_COPY
} = require('../src/util/cep-payload-common')

const root = path.join(__dirname, '..')
const payloadRoot = path.join(root, 'build', 'cep-payload')
const payloadExt = path.join(payloadRoot, EXT_ID)

/** 各平台在 zip 里保留的安装辅助文件（其余剔除） */
const PLATFORM_INSTALL_FILES = {
  win: ['Add Keys.reg', '安装方法-Windows.txt'],
  mac: ['install-as-admin', '安装方法-macOS.txt']
}

function parsePlatform (argv) {
  const i = argv.indexOf('--platform')
  const v = (i >= 0 ? argv[i + 1] : '') || ''
  const p = v.toLowerCase()
  if (p !== 'win' && p !== 'mac') {
    console.error('pack-cep-zip FAIL --platform 只能是 win 或 mac，收到：' + (v || '(空)'))
    process.exit(1)
  }
  return p
}

/**
 * 从 payload 复制出一份「按平台裁剪过」的临时扩展目录。
 * 不能直接改 payload —— 它同时被 extraResources（桌面安装包）复用，
 * 在这里删文件会让桌面安装包里的扩展也少东西。
 */
function stagePlatformExt (platform, dest) {
  const keep = new Set(PLATFORM_INSTALL_FILES[platform])
  fs.rmSync(dest, { recursive: true, force: true })

  const walk = (from, to) => {
    const st = fs.statSync(from)
    if (st.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
      return
    }
    fs.mkdirSync(to, { recursive: true })
    for (const name of fs.readdirSync(from)) {
      if (SKIP_COPY.has(name)) continue
      if (name === 'install' && path.resolve(from) === path.resolve(payloadExt)) {
        // 安装辅助：只保留本平台的那几份。
        // 注意这里的 from/to 是「payloadExt → dest」这一层，
        // 所以 install 的**源和目标都要再拼一段 install/**：
        //   源 = <payload>/install/<file>
        //   目标 = <dest>/install/<file>
        // 少拼一段的后果是文件落到扩展根目录（实测过一次），或整个 install/ 被清空。
        const toInstall = path.join(to, 'install')
        fs.mkdirSync(toInstall, { recursive: true })
        for (const f of keep) {
          const src = path.join(from, 'install', f)
          if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(toInstall, f)) }
        }
        continue
      }
      walk(path.join(from, name), path.join(to, name))
    }
  }
  walk(payloadExt, dest)

  // 清理可能残留的空 install 目录（平台文件都缺失时）
  const installDir = path.join(dest, 'install')
  if (fs.existsSync(installDir) && !fs.readdirSync(installDir).length) {
    fs.rmSync(installDir, { recursive: true, force: true })
  }
}

/**
 * 列出 zip 内条目名。
 *
 * ⚠ 不能直接把 PowerShell 的 stdout 当 UTF-8 读：控制台代码页是 GBK，
 *   中文文件名会被转成乱码，导致 endsWith('安装方法-Windows.txt') 永远不成立，
 *   把正确的包误判成「混入别平台文件」。故让 PowerShell 把结果**写成 UTF-8 文件**
 *   再由 Node 读。非 Windows 平台返回空数组（跳过校验，不阻塞打包）。
 */
function listZip (zipPath) {
  if (process.platform !== 'win32') return []
  const outFile = path.join(os.tmpdir(), `isparta-zip-list-${process.pid}.txt`)
  const ps =
    `$ErrorActionPreference='Stop';` +
    `Add-Type -A System.IO.Compression.FileSystem;` +
    `$z=[IO.Compression.ZipFile]::OpenRead('${zipPath}');` +
    `$lines=@($z.Entries | ForEach-Object { $_.FullName });` +
    `$z.Dispose();` +
    `[IO.File]::WriteAllLines('${outFile}', $lines, (New-Object Text.UTF8Encoding $false))`
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore' })
    return fs.readFileSync(outFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
  } catch (e) {
    console.warn('pack-cep-zip WARN 无法列出 zip 条目，跳过平台校验：' + (e && e.message))
    return []
  } finally {
    try { fs.unlinkSync(outFile) } catch (e) { /* ignore */ }
  }
}

function main () {
  const platform = parsePlatform(process.argv)

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
  const zipPath = path.join(outDir, `isparta-next-cep-${pkg.version}-${platform}-x64.zip`)
  if (fs.existsSync(zipPath)) fs.rmSync(zipPath)

  // 按平台裁剪一份临时扩展目录，再压缩
  const stageRoot = path.join(os.tmpdir(), 'isparta-pack-cep', platform)
  stagePlatformExt(platform, path.join(stageRoot, EXT_ID))

  const ps = `Compress-Archive -Path '${path.join(stageRoot, EXT_ID)}' -DestinationPath '${zipPath}' -Force`
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
  fs.rmSync(stageRoot, { recursive: true, force: true })

  const size = fs.statSync(zipPath).size
  console.log('pack-cep-zip OK')
  console.log('  platform', platform)
  console.log('  zip     ', path.relative(root, zipPath), `(${size} bytes)`)
  console.log('  附带    ', PLATFORM_INSTALL_FILES[platform].join(', ') || '(无)')

  const entries = listZip(zipPath)
  if (entries.length) {
    const installEntries = entries.filter((e) => e.includes('install/') || e.includes('install\\'))
    const stray = installEntries.filter((e) =>
      !PLATFORM_INSTALL_FILES[platform].some((f) => e.endsWith(f)))
    if (stray.length) {
      console.error('pack-cep-zip FAIL zip 内混入别平台的安装辅助：', stray)
      process.exit(1)
    }
    // 反向校验：本平台该带的文件必须真的在 zip 里
    const missing = PLATFORM_INSTALL_FILES[platform].filter((f) =>
      !entries.some((e) => e.endsWith(f)))
    if (missing.length) {
      console.error('pack-cep-zip FAIL zip 缺少本平台安装辅助：', missing)
      process.exit(1)
    }
    console.log('  校验   ', installEntries.map((e) => e.split(/[\\/]/).pop()).join(', '))
  }

  if (platform === 'win') {
    console.log('  解压到 %APPDATA%\\Adobe\\CEP\\extensions\\ 后重启 AE')
  } else {
    console.log('  解压到 ~/Library/Application Support/Adobe/CEP/extensions/ 后重启 AE')
  }
}

main()
