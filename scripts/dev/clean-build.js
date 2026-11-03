/** 固定白名单构建清理；默认预览，--apply 释放空间，--cache-only 供构建子阶段使用。 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '../..')
const args = process.argv.slice(2)
if (args.some(a => !['--apply', '--cache-only', '--without-electron'].includes(a))) throw new Error('仅支持 --apply / --cache-only / --without-electron')
const targets = ['node_modules/.cache']
if (args.includes('--without-electron')) targets.push('node_modules/electron/dist', 'node_modules/electron/path.txt')
if (!args.includes('--cache-only')) {
  targets.push('build/cep-payload')
  // 保留 exe/pkg/zip/AppImage、更新清单及完整 .app：它们可能仍需交付或组装 pkg。
  for (const name of ['index.js', 'background.js', 'preload.js', 'package.json', 'bundled', 'win-unpacked', 'linux-unpacked']) {
    targets.push('dist_electron/' + name)
  }
}
function size (file) {
  const st = fs.lstatSync(file)
  // 不遍历 Electron.app 内部的框架链接；删除目录时也只删除链接本身。
  if (st.isSymbolicLink()) return st.size
  return st.isDirectory() ? fs.readdirSync(file).reduce((n, f) => n + size(path.join(file, f)), 0) : st.size
}
let total = 0
const plans = []
for (const rel of targets) {
  const file = path.join(root, rel)
  // 防止父目录链接将白名单路径导向仓库外。
  let parent = path.dirname(file)
  while (parent !== root) {
    if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink()) throw new Error('拒绝链接父目录：' + parent)
    parent = path.dirname(parent)
  }
  if (!fs.existsSync(file)) continue
  if (fs.lstatSync(file).isSymbolicLink()) throw new Error('拒绝链接目标：' + rel)
  const tracked = execFileSync('git', ['ls-files', '--', rel], { cwd: root, encoding: 'utf8' })
  if (tracked.trim()) throw new Error('拒绝删除受控文件：' + rel)
  const bytes = size(file)
  plans.push({ file, rel, bytes })
  total += bytes
}
for (const p of plans) console.log(`${args.includes('--apply') ? '清理' : '预览'} ${p.rel}: ${(p.bytes / 1048576).toFixed(2)} MiB`)
if (args.includes('--apply')) {
  for (const p of plans) fs.rmSync(p.file, { recursive: true, force: true })
}
console.log(`${args.includes('--apply') ? '已清理' : '可清理'} ${(total / 1048576).toFixed(2)} MiB`)
