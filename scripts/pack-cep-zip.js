/**
 * 打独立 AE 扩展 zip（可选分发；主路径为 NSIS 一体安装）。
 * 先 prepare-cep-payload，再打成 dist/isparta-next-cep-<version>-<plat>-x64.zip
 *
 * zip 结构（BG Renderer 式顶层平铺，解压后一眼可见）：
 *   安装方法-<plat>.txt + 平台脚本   ← zip 顶层，与扩展文件夹同级
 *   io.github.isparta-next/          ← 扩展本体（不含 install/、不含开发版 README）
 *
 * 用法：
 *   node scripts/pack-cep-zip.js              # = --platform win
 *   node scripts/pack-cep-zip.js --platform mac
 *
 * --platform 的意义不只是文件名：**安装辅助文件按平台取子集**。
 * Windows 包带 Add Keys.reg + 安装方法-Windows.txt，
 * macOS 包带 install-as-admin + 安装扩展.command + 安装方法-macOS.txt；
 * 混装会让人在 mac 上双击 .reg、或在 Windows 上跑 bash 脚本。
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')
const JSZip = require('jszip')
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
  mac: ['install-as-admin', '安装扩展.command', '安装方法-macOS.txt']
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
 *
 * 两样东西**不进扩展文件夹**（由 main 播种到 zip 顶层）：
 *   - install/       安装辅助 → 平铺 zip 顶层（BG Renderer 式，解压即见）
 *   - README.md      targets/cep 开发文档（junction/npm/F: 路径），不该给最终用户
 */
function stagePlatformExt (dest) {
  fs.rmSync(dest, { recursive: true, force: true })

  const walk = (from, to) => {
    const st = fs.statSync(from)
    if (st.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.copyFileSync(from, to)
      return
    }
    fs.mkdirSync(to, { recursive: true })
    const atRoot = path.resolve(from) === path.resolve(payloadExt)
    for (const name of fs.readdirSync(from)) {
      if (SKIP_COPY.has(name)) continue
      if (name === 'install' && path.basename(from) === 'ui') {
        // ui/install 是 vue-cli 把 public/install 复制进 outputDir 的污染产物
        // （安装辅助只允许在 zip 顶层），出现即整棵跳过
        console.warn('pack-cep-zip WARN 跳过 targets/cep/ui/install 污染目录')
        continue
      }
      if (atRoot && name === 'install') continue
      if (atRoot && name === 'README.md') continue
      walk(path.join(from, name), path.join(to, name))
    }
  }
  walk(payloadExt, dest)
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

async function main () {
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

  // 按平台裁剪一份临时扩展目录，安装辅助平铺 stage 顶层（= zip 顶层）
  const stageRoot = path.join(os.tmpdir(), 'isparta-pack-cep', platform)
  stagePlatformExt(path.join(stageRoot, EXT_ID))

  const topFiles = PLATFORM_INSTALL_FILES[platform]
  const installSrc = path.join(payloadExt, 'install')
  for (const f of topFiles) {
    const src = path.join(installSrc, f)
    if (!fs.existsSync(src)) {
      console.error('pack-cep-zip FAIL 安装辅助缺失：' + src)
      process.exit(1)
    }
    fs.copyFileSync(src, path.join(stageRoot, f))
  }

  // 用 jszip 而非 Compress-Archive：PowerShell 压缩不写 unix 权限位，
  // macOS 解压后 install-as-admin / 双击 .command 会丢可执行位（0755），
  // 用户就得手动 chmod —— 这正是「双击可用」要解决的问题。
  const zip = new JSZip()
  const addTree = (dir, rel) => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP_COPY.has(name)) continue
      const abs = path.join(dir, name)
      const r = rel ? `${rel}/${name}` : name
      const st = fs.statSync(abs)
      if (st.isDirectory()) {
        zip.file(`${r}/`, Buffer.alloc(0), { unixPermissions: 0o40775, dir: true })
        addTree(abs, r)
      } else {
        zip.file(r, fs.readFileSync(abs), { unixPermissions: 0o100644 })
      }
    }
  }
  addTree(path.join(stageRoot, EXT_ID), EXT_ID)
  // 顶层安装辅助：脚本必须带可执行位，文档/注册表 0644
  for (const f of topFiles) {
    const exec = f === 'install-as-admin' || f.endsWith('.command')
    zip.file(f, fs.readFileSync(path.join(stageRoot, f)), {
      unixPermissions: exec ? 0o100755 : 0o100644
    })
  }
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    platform: 'UNIX',
    compression: 'DEFLATE'
  })
  fs.writeFileSync(zipPath, buf)
  fs.rmSync(stageRoot, { recursive: true, force: true })

  const size = fs.statSync(zipPath).size
  console.log('pack-cep-zip OK')
  console.log('  platform', platform)
  console.log('  zip     ', path.relative(root, zipPath), `(${size} bytes)`)
  console.log('  附带    ', PLATFORM_INSTALL_FILES[platform].join(', ') || '(无)')

  const entries = listZip(zipPath)
  if (entries.length) {
    // ui/install 污染独立拦截：即使文件名恰好是本平台辅助文件，
    // 位于 ui/ 下也说明 public/install 被 vue-cli 复制进了 outputDir
    const uiPollution = entries.filter((e) => /(^|[\\/])ui[\\/]install([\\/]|$)/.test(e))
    if (uiPollution.length) {
      console.error('pack-cep-zip FAIL zip 内存在 ui/install 污染（public/install 被复制进 outputDir）：', uiPollution)
      process.exit(1)
    }
    // install/ 目录不该出现在包里：安装辅助是 zip 顶层平铺（BG Renderer 式），
    // 藏进 io.github.isparta-next/install/ 会让用户解压后第一眼看不到
    const installDir = entries.filter((e) => /(^|[\\/])install[\\/]/.test(e))
    if (installDir.length) {
      console.error('pack-cep-zip FAIL zip 内出现 install/ 目录（应平铺 zip 顶层）：', installDir)
      process.exit(1)
    }
    // 别平台文件混装拦截
    const OTHER_PLATFORM_FILES = {
      win: ['安装方法-macOS.txt', 'install-as-admin', '安装扩展.command'],
      mac: ['安装方法-Windows.txt', 'Add Keys.reg']
    }
    const stray = OTHER_PLATFORM_FILES[platform].filter((f) =>
      entries.some((e) => e.endsWith(f)))
    if (stray.length) {
      console.error('pack-cep-zip FAIL zip 内混入别平台的安装辅助：', stray)
      process.exit(1)
    }
    // 反向校验：本平台该带的文件必须平铺在 zip 顶层
    const missing = PLATFORM_INSTALL_FILES[platform].filter((f) =>
      !entries.includes(f))
    if (missing.length) {
      console.error('pack-cep-zip FAIL zip 顶层缺少安装辅助：', missing)
      process.exit(1)
    }
    // 扩展文件夹里不许再有安装辅助 / 开发版 README
    const nested = entries.filter((e) =>
      e.startsWith(`${EXT_ID}/`) &&
      (e.startsWith(`${EXT_ID}/install`) || e === `${EXT_ID}/README.md`))
    if (nested.length) {
      console.error('pack-cep-zip FAIL 扩展文件夹内混入 install/ 或开发版 README：', nested)
      process.exit(1)
    }
    console.log('  校验   ', PLATFORM_INSTALL_FILES[platform].join(', ') + '（zip 顶层）')
  }

  if (platform === 'win') {
    console.log('  解压后：io.github.isparta-next 拷到 C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions\\，再看顶层「安装方法-Windows.txt」')
  } else {
    console.log('  解压后：io.github.isparta-next 拷到 ~/Library/Application Support/Adobe/CEP/extensions/，再看顶层「安装方法-macOS.txt」')
  }
}

main().catch((e) => {
  console.error('pack-cep-zip FAIL', e && e.message)
  process.exit(1)
})
