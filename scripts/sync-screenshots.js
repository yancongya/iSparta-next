/**
 * 截图同步：docs/screenshots/ → landing/assets/shots/
 *
 * 为什么需要：README 与落地页共用同一批实拍图。以前是手工复制两份
 * （public/screenshot/ 与 landing/assets/），已经漂移出 3 组字节级重复。
 * 现在 docs/screenshots/ 是**唯一真相源**，本脚本负责把它同步到落地页。
 *
 * 为什么源在 docs/ 而不是 public/：vue-cli 会把整个 public/ 原样复制进构建输出，
 * 放在那里等于把 README 用的截图白塞进每个用户的安装包（曾实测
 * dist_electron/win-unpacked/resources/app/screenshot/ 里有这几张 png）。
 *
 * 用法：
 *   node scripts/sync-screenshots.js          同步（landing 有则覆盖）
 *   node scripts/sync-screenshots.js --check  只校验，不写盘（CI / 提交前用）
 *
 * --check 语义：目标缺失或内容不一致 → 退出码 1，并列出差异。
 * 落地页目录本身是提交物，所以同步结果也要提交；--check 防的是「改了源图忘了同步」。
 */

'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'docs', 'screenshots')
const DST_DIR = path.join(ROOT, 'landing', 'assets', 'shots')

const CHECK_ONLY = process.argv.includes('--check')

/** 截图文件名规则：<端>-<界面>[-<细节>].webp，全小写连字符 */
const NAME_RE = /^(desktop|cep)-[a-z0-9]+(-[a-z0-9]+)*\.webp$/

function sha1 (buf) {
  return crypto.createHash('sha1').update(buf).digest('hex')
}

function listScreenshots (dir) {
  if (!fs.existsSync(dir)) { return [] }
  return fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.webp')).sort()
}

function main () {
  const files = listScreenshots(SRC_DIR)
  if (!files.length) {
    console.error('[sync-screenshots] 源目录没有 webp：' + path.relative(ROOT, SRC_DIR))
    process.exit(1)
  }

  // 命名规范自检：源图名不合规就直接失败，避免又滚出一批 desktop-lsit 式拼写
  const bad = files.filter((f) => !NAME_RE.test(f))
  if (bad.length) {
    console.error('[sync-screenshots] 文件名不合规（应为 desktop|cep-<界面>[-细节].webp）：')
    bad.forEach((f) => console.error('  - ' + f))
    process.exit(1)
  }

  if (!CHECK_ONLY) { fs.mkdirSync(DST_DIR, { recursive: true }) }

  const drift = []
  const missing = []

  files.forEach((name) => {
    const src = path.join(SRC_DIR, name)
    const dst = path.join(DST_DIR, name)
    const srcBuf = fs.readFileSync(src)

    if (!fs.existsSync(dst)) {
      missing.push(name)
      if (!CHECK_ONLY) { fs.writeFileSync(dst, srcBuf) }
      return
    }
    if (sha1(fs.readFileSync(dst)) !== sha1(srcBuf)) {
      drift.push(name)
      if (!CHECK_ONLY) { fs.writeFileSync(dst, srcBuf) }
    }
  })

  // 目标里多余的旧文件（改名后残留）也要清掉，否则落地页会一直引用旧图
  const stale = []
  if (fs.existsSync(DST_DIR)) {
    fs.readdirSync(DST_DIR).forEach((f) => {
      if (!files.includes(f)) {
        stale.push(f)
        if (!CHECK_ONLY) { fs.unlinkSync(path.join(DST_DIR, f)) }
      }
    })
  }

  const rel = path.relative(ROOT, DST_DIR)
  const wrote = []
  if (missing.length) { wrote.push('新增 ' + missing.length) }
  if (drift.length) { wrote.push('更新 ' + drift.length) }
  if (stale.length) { wrote.push('删除残留 ' + stale.length) }

  if (CHECK_ONLY) {
    if (missing.length || drift.length || stale.length) {
      console.error('[sync-screenshots] --check 失败，落地页与源图不一致：')
      missing.forEach((f) => console.error('  缺失: ' + f))
      drift.forEach((f) => console.error('  内容不同: ' + f))
      stale.forEach((f) => console.error('  残留旧文件: ' + f))
      console.error('  修复：node scripts/sync-screenshots.js')
      process.exit(1)
    }
    console.log('[sync-screenshots] --check 通过：' + files.length + ' 张与 ' + rel + ' 一致')
    return
  }

  console.log('[sync-screenshots] 源 ' + files.length + ' 张 → ' + rel +
    (wrote.length ? '（' + wrote.join('，') + '）' : '（无变化）'))
}

main()
