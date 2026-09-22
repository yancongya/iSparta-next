/**
 * 出包前自检：图标 / 安装向导图 / electron-builder 引用 / 编码器目录。
 * 用法：node scripts/doctor-packaging.js
 * 失败退出码 1；成功打印清单。
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

// name / productName 一致性（改名漏改会进安装目录错位）
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
