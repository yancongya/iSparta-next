/**
 * 暂存 AE CEP 扩展 payload 供 electron-builder extraResources / 独立 zip 使用。
 * 输出：build/cep-payload/io.github.isparta-next/
 *   - targets/cep/**（排除开发文档与空 bin 说明）
 *   - 编码器小工具子集（targets/cep/bin 优先，否则 public/bin）
 *   - install/ 安装辅助（Windows 的 Add Keys.reg、macOS 的 install-as-admin、
 *     以及两份平台安装说明）—— 独立 zip 按平台取子集，见 pack-cep-zip.js --platform
 *   - version.json 版本清单
 * 用法：node scripts/prepare-cep-payload.js
 * 失败退出码 1。
 */
const fs = require('fs')
const path = require('path')
const {
  EXT_ID,
  WIN_TOOLS,
  MAC_TOOLS,
  NIX_TOOLS,
  SKIP_COPY,
  copyFile,
  copyTree,
  writeVersionJson,
  readExtensionBundleVersion,
  buildVersionDoc
} = require('../src/util/cep-payload-common')

const root = path.join(__dirname, '..')
const srcCep = path.join(root, 'targets', 'cep')
const outRoot = path.join(root, 'build', 'cep-payload')
const outExt = path.join(outRoot, EXT_ID)

function fail (msg) {
  console.error('prepare-cep-payload FAIL', msg)
  process.exit(1)
}

function listFiles (dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter((n) => !SKIP_COPY.has(n) && !n.endsWith('.md'))
}

function stageBinaries () {
  const platforms = [
    { id: 'win64', tools: WIN_TOOLS, fallback: path.join(root, 'public', 'bin', 'win64') },
    { id: 'win32', tools: WIN_TOOLS, fallback: path.join(root, 'public', 'bin', 'win32') },
    { id: 'mac', tools: MAC_TOOLS, fallback: path.join(root, 'public', 'bin', 'mac') },
    { id: 'linux', tools: NIX_TOOLS, fallback: path.join(root, 'public', 'bin', 'linux') }
  ]
  const staged = []
  for (const p of platforms) {
    const preferred = path.join(srcCep, 'bin', p.id)
    const dest = path.join(outExt, 'bin', p.id)
    fs.mkdirSync(dest, { recursive: true })
    for (const tool of p.tools) {
      const fromPreferred = path.join(preferred, tool)
      const fromFallback = path.join(p.fallback, tool)
      let from = null
      if (fs.existsSync(fromPreferred) && fs.statSync(fromPreferred).size > 0) {
        from = fromPreferred
      } else if (fs.existsSync(fromFallback) && fs.statSync(fromFallback).size > 0) {
        from = fromFallback
      }
      if (!from) continue
      copyFile(from, path.join(dest, tool))
      staged.push(`${p.id}/${tool}`)
    }
  }
  return staged
}

function stageInstallHelpers () {
  // 安装辅助文件（注册表 / defaults 脚本 + 两份平台安装说明）随扩展一起分发。
  // 放在 payload 的 install/ 下，打 zip 时由 pack-cep-zip.js --platform 取子集：
  // Windows 包不该带 install-as-admin，macOS 包不该带 Add Keys.reg。
  const src = path.join(root, 'public', 'install')
  const dest = path.join(outExt, 'install')
  if (!fs.existsSync(src)) {
    console.warn('prepare-cep-payload WARN 缺少 public/install（独立 zip 将不含安装辅助）')
    return []
  }
  fs.mkdirSync(dest, { recursive: true })
  const staged = []
  for (const name of fs.readdirSync(src)) {
    if (SKIP_COPY.has(name)) continue
    const from = path.join(src, name)
    if (!fs.statSync(from).isFile()) continue
    copyFile(from, path.join(dest, name))
    staged.push(name)
  }
  return staged
}

function stageVersionJson (stagedBins) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const manifestPath = path.join(srcCep, 'CSXS', 'manifest.xml')
  const extBundleVersion = readExtensionBundleVersion(manifestPath, pkg.version)
  // 文档组装在 cep-payload-common.buildVersionDoc（唯一来源）：
  //   prepare / CI zip 播种共用，字段与 NSIS、cepSync 自检刷新对齐。
  //   install 元数据按 win32/darwin 分列的注释见 buildVersionDoc。
  return writeVersionJson(outExt, buildVersionDoc({
    version: pkg.version,
    extensionBundleVersion: extBundleVersion,
    binaries: stagedBins
  }))
}

function main () {
  if (!fs.existsSync(path.join(srcCep, 'CSXS', 'manifest.xml'))) {
    fail('缺少 targets/cep/CSXS/manifest.xml')
  }
  if (!fs.existsSync(path.join(srcCep, 'index.html'))) {
    fail('缺少 targets/cep/index.html')
  }

  fs.rmSync(outRoot, { recursive: true, force: true })
  fs.mkdirSync(outExt, { recursive: true })

  // 主体：manifest / UI / jsx / lib / bin/README
  for (const name of fs.readdirSync(srcCep)) {
    if (SKIP_COPY.has(name)) continue
    // bin 由 stageBinaries 重新挑选，避免空 README 以外的残留
    if (name === 'bin') continue
    // 顶层 install 只由 stageInstallHelpers 从 public/install 播种，
    // 不从 targets/cep 拷，防止两处内容漂移
    if (name === 'install') continue
    copyTree(path.join(srcCep, name), path.join(outExt, name))
  }

  // 防御：vue-cli 会把 public/install 整棵复制进 outputDir（targets/cep/ui），
  // 形成 ui/install 污染——安装辅助只允许存在于 payload 根 install/，出现即剔除
  const pollutedUiInstall = path.join(outExt, 'ui', 'install')
  if (fs.existsSync(pollutedUiInstall)) {
    console.warn('prepare-cep-payload WARN 剔除 targets/cep/ui/install 污染产物（public/install 被复制进 outputDir）')
    fs.rmSync(pollutedUiInstall, { recursive: true, force: true })
  }
  // 保留 bin 说明（不含二进制本体）
  if (fs.existsSync(path.join(srcCep, 'bin', 'README.md'))) {
    copyFile(path.join(srcCep, 'bin', 'README.md'), path.join(outExt, 'bin', 'README.md'))
  }

  // 扩展显示名带版本号：AE「窗口→扩展」菜单可见（payload 内改，不污染源码）
  try {
    const pkgVer = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version
    const mfOut = path.join(outExt, 'CSXS', 'manifest.xml')
    if (fs.existsSync(mfOut) && pkgVer) {
      let xml = fs.readFileSync(mfOut, 'utf8')
      xml = xml.replace(/<Menu>[^<]*<\/Menu>/, '<Menu>iSparta-next ' + pkgVer + '<\/Menu>')
      fs.writeFileSync(mfOut, xml)
      console.log('  menu    iSparta-next ' + pkgVer)
    }
  } catch (eMenu) {
    console.warn('prepare-cep-payload WARN manifest Menu 版本注入失败', eMenu && eMenu.message)
  }

  const stagedBins = stageBinaries()
  const stagedInstall = stageInstallHelpers()
  const win64 = stagedBins.filter((s) => s.startsWith('win64/'))
  if (!win64.length) {
    console.warn('prepare-cep-payload WARN 未暂存 win64 编码器（请拷贝 public/bin/win64 子集或 targets/cep/bin/win64）')
  }

  const doc = stageVersionJson(stagedBins)
  console.log('prepare-cep-payload OK')
  console.log('  out   ', path.relative(root, outExt))
  console.log('  version', doc.version, '/ ext', doc.extensionBundleVersion)
  console.log('  bins  ', stagedBins.length ? stagedBins.join(', ') : '(none)')
  console.log('  install', stagedInstall.length ? stagedInstall.join(', ') : '(none)')
}

main()
