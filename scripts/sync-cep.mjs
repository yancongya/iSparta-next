#!/usr/bin/env node
/**
 * sync-cep.mjs — 把构建好的 CEP 扩展（targets/cep/ui）同步到本机 AE 扩展目录。
 *
 * 为什么需要它：iSparta 的 CEP 面板是「独立部署」到 AE 扩展目录的，构建产物
 * （targets/cep/ui）和 AE 实际加载的扩展不是同一份。改了面板代码若点「热更新」自测，
 * 跑的其实是旧扩展目录里的旧面板 —— 这正是「静默安装 / loading 时序」修了却测不出来的
 * 结构性陷阱。本脚本让「构建 → 同步 → 在 AE 里重测」成为一条明确命令。
 *
 * 用法：
 *   npm run build:cep        # 先生成 targets/cep/ui
 *   npm run sync:cep         # 同步到本机两个扩展目录（用户级 + 系统级）
 *
 * 自定义目标（逗号分隔，覆盖默认）：
 *   ISPARTA_CEP_DEST="D:/ae-ext/io.github.isparta-next" npm run sync:cep
 *
 * 开发期根治方案（推荐）：把 AE 扩展目录软链到 targets/cep/ui，运行面板永远等于源码：
 *   mklink /D "C:\Users\<you>\AppData\Roaming\Adobe\CEP\extensions\io.github.isparta-next" "<repo>\targets\cep\ui"
 *   （mac/Linux：ln -s <repo>/targets/cep/ui <extdir>）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src = path.join(root, 'targets', 'cep', 'ui')

const envDirs = process.env.ISPARTA_CEP_DEST
const defaultDirs = [
  path.join(process.env.APPDATA || '', 'Adobe', 'CEP', 'extensions', 'io.github.isparta-next'),
  'C:\\Program Files (x86)\\Common Files\\Adobe\\CEP\\extensions\\io.github.isparta-next'
]
const dests = (envDirs ? envDirs.split(',').map((s) => s.trim()).filter(Boolean) : defaultDirs)
  .filter(Boolean)

function copyEntry (from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'node_modules') { continue }
    const s = path.join(from, entry.name)
    const d = path.join(to, entry.name)
    fs.cpSync(s, d, { recursive: true })
  }
}

if (!fs.existsSync(src)) {
  console.error('[sync-cep] 源目录不存在：', src)
  console.error('[sync-cep] 请先执行 `npm run build:cep` 生成 targets/cep/ui')
  process.exit(1)
}

let ok = 0
for (const to of dests) {
  try {
    copyEntry(src, to)
    console.log('[sync-cep] 已同步 →', to)
    ok++
  } catch (e) {
    console.error('[sync-cep] 同步失败：', to, '\n  ', e && e.message)
  }
}

if (ok === 0) {
  console.error('[sync-cep] 没有可同步的目标目录（APPDATA 未设置且无 ISPARTA_CEP_DEST）')
  process.exit(1)
}
console.log(`[sync-cep] 完成（${ok}/${dests.length}）`)
