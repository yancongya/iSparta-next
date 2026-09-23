/**
 * 出包前自检：图标 / 安装向导图 / electron-builder 引用 / 编码器目录 / AE CEP payload / NSIS 钩子。
 * 用法：node scripts/doctor-packaging.js
 * 失败退出码 1；成功打印清单。
 * 保证 payload 存在才出包：CEP 源或暂存不完整时 FAIL。
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const errors = []
const warns = []

function exists (rel) {
  return fs.existsSync(path.join(root, rel))
}

function sizeOf (rel) {
  try { return fs.statSync(path.join(root, rel)).size } catch (e) { return 0 }
}

function need (rel, why) {
  if (!exists(rel)) {
    errors.push(`缺少 ${rel}（${why}）`)
    return false
  }
  if (sizeOf(rel) < 32) {
    errors.push(`${rel} 几乎为空（${why}）`)
    return false
  }
  return true
}

// 品牌图标链
need('public/icons/icon-brand.svg', '图标唯一源')
need('public/icons/icon.png', 'Linux / 窗口兜底')
need('public/icons/icon.ico', 'Windows exe')
need('public/icons/icon.icns', 'macOS')
need('public/icons/icon-256.png', '向导 / apple-touch')
need('public/icons/icon-32.png', 'favicon')

// NSIS 向导
need('build/installerSidebar.bmp', 'NSIS 侧栏 164×314')
need('build/installerHeader.bmp', 'NSIS 页眉 150×57')
need('public/favicon.ico', 'Web favicon')

// electron-builder 路径（与 electron-builder.yml 对齐）
;[
  './public/icons/icon.ico',
  './public/icons/icon.icns',
  './build/installerSidebar.bmp',
  './build/installerHeader.bmp'
].forEach((p) => need(p.replace(/^\.\//, ''), 'electron-builder 引用'))

// 各平台编码器目录（存在即可，缺文件只警告）
;['win64', 'mac', 'linux', 'win32'].forEach((pf) => {
  const dir = `public/bin/${pf}`
  if (!exists(dir)) {
    warns.push(`无 ${dir}/（目标平台若包含该 OS 需自备编码器）`)
    return
  }
  try {
    const files = fs.readdirSync(path.join(root, dir))
    if (!files.length) warns.push(`${dir}/ 为空`)
  } catch (e) {
    warns.push(`${dir}/ 不可读`)
  }
})

// ---- W3：AE CEP 一体安装 payload / NSIS 钩子 ----
need('targets/cep/CSXS/manifest.xml', 'CEP 扩展清单')
need('targets/cep/index.html', 'CEP 面板入口')
need('targets/cep/jsx/hostscript.jsx', 'AE 导出脚本')
need('targets/cep/lib/cep-bridge.js', 'CEP 桥')
need('build/installer.nsh', 'NSIS 组件页 / 安装卸载钩子')

// 编码器子集：targets/cep/bin 优先，否则 public/bin
const WIN_TOOLS = ['apngasm.exe', 'apngquant.exe', 'apngopt.exe', 'cwebp.exe', 'webpmux.exe']
function hasWinTools (dirRel) {
  return WIN_TOOLS.filter((t) => exists(path.join(dirRel, t)) && sizeOf(path.join(dirRel, t)) > 0)
}
const stagedWin = hasWinTools('targets/cep/bin/win64')
const publicWin = hasWinTools('public/bin/win64')
if (!stagedWin.length && !publicWin.length) {
  errors.push('缺少 win64 编码器子集（targets/cep/bin/win64 或 public/bin/win64：' + WIN_TOOLS.join('/') + '）')
} else if (!stagedWin.length && publicWin.length && publicWin.length < WIN_TOOLS.length) {
  warns.push(`public/bin/win64 仅 ${publicWin.length}/${WIN_TOOLS.length} 个小工具`)
}

// 暂存 payload（build/cep-payload）：出包必须存在且完整
const payloadExt = 'build/cep-payload/io.github.isparta-next'
const payloadOk = need(payloadExt + '/CSXS/manifest.xml', 'CEP 暂存 payload') &&
  need(payloadExt + '/index.html', 'CEP 暂存 payload') &&
  need(payloadExt + '/version.json', 'CEP 版本清单')
if (!payloadOk) {
  errors.push('CEP 暂存 payload 不完整，请先运行 node scripts/prepare-cep-payload.js')
}
const payloadWin = hasWinTools(payloadExt + '/bin/win64')
if (payloadOk && !payloadWin.length) {
  warns.push('暂存 payload 无 win64 编码器（安装后 AE 面板无法编码）')
}

// electron-builder.yml 必须挂上 extraResources + nsis.include
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (pkg.name !== 'isparta-next') {
    warns.push(`package.json name=${pkg.name}（约定 isparta-next）`)
  }
  const eb = fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8')
  if (!/executableName:\s*isparta-next/.test(eb)) {
    warns.push('electron-builder.yml executableName 不是 isparta-next')
  }
  if (!/shortcutName:\s*iSparta-next/.test(eb) && !/shortcutName:\s*isparta-next/.test(eb)) {
    warns.push('nsis.shortcutName 建议显式固定为 iSparta-next')
  }
  if (!/extraResources:/.test(eb)) {
    errors.push('electron-builder.yml 缺少 extraResources（CEP payload）')
  }
  if (!/include:\s*\.\/build\/installer\.nsh/.test(eb) && !/include:\s*build\/installer\.nsh/.test(eb)) {
    errors.push('electron-builder.yml nsis.include 未指向 build/installer.nsh')
  }
  if (!/artifactName:\s*isparta-next-\$\{version\}/.test(eb)) {
    warns.push('artifactName 建议保持 isparta-next-${version}-…（electron-updater 依赖）')
  }
} catch (e) {
  errors.push('无法读取 package.json / electron-builder.yml：' + e.message)
}

console.log('doctor-packaging')
if (warns.length) {
  warns.forEach((w) => console.log('  WARN', w))
}
if (errors.length) {
  errors.forEach((e) => console.log('  FAIL', e))
  console.log(`Result: ${errors.length} failed, ${warns.length} warnings`)
  process.exit(1)
}
console.log(`Result: OK (${warns.length} warnings)`)
