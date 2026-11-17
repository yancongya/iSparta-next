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
const http = require('http')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = path.join(__dirname, '..')
const SRC_DIR = path.join(ROOT, 'docs', 'screenshots')
const DST_DIR = path.join(ROOT, 'landing', 'assets', 'shots')

const CHECK_ONLY = process.argv.includes('--check')
const CAPTURE_ARG = process.argv.find((arg) => arg === '--capture' || /^--capture=(desktop|cep)$/.test(arg))
const CAPTURE = !!CAPTURE_ARG
const CAPTURE_WORKER = process.argv.includes('--capture-worker')
const CAPTURE_TARGET = CAPTURE_ARG && CAPTURE_ARG.includes('=') ? CAPTURE_ARG.split('=')[1] : (process.env.ISPARTA_CAPTURE_TARGET || '')

const SHOTS = [
  ['desktop-workspace-hd', 'desktop', 1728, 1296],
  ['desktop-settings-general', 'desktop', 984, 741],
  ['desktop-settings-update', 'desktop', 986, 793],
  ['desktop-empty', 'desktop', 984, 741],
  ['cep-task-list', 'cep', 1728, 1296],
  ['cep-comp-tree', 'cep', 1728, 1296],
  ['cep-output-settings', 'cep', 1728, 1296]
]
const ACTIVE_SHOTS = CAPTURE_TARGET ? SHOTS.filter((shot) => shot[1] === CAPTURE_TARGET) : SHOTS

function probe (port, marker) {
  return new Promise((resolve) => {
    const req = http.get({ hostname: '127.0.0.1', port, path: port === 8080 ? '/mockup.html' : '/', timeout: 3000 }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => resolve(res.statusCode === 200 && body.includes(marker)))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

async function captureFromBrowser () {
  let checks = [false, false, false]
  const deadline = Date.now() + 300000
  do {
    checks = await Promise.all([
      probe(8080, 'ISPARTA-NEXT / LIVE UI MOCKUP'),
      CAPTURE_TARGET === 'cep' || probe(8081, '<title>iSparta-next</title>'),
      CAPTURE_TARGET === 'desktop' || probe(8082, '<title>iSparta</title>')
    ])
    if (checks.every(Boolean)) break
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } while (Date.now() < deadline)
  if (checks.some((ok) => !ok)) {
    throw new Error('截图需要本仓库的 8080/8081/8082 预览服务。先运行 npm run dev:all，并确认端口未顺延。')
  }
  const electronExe = require('electron')
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-shots-'))
  try {
    await new Promise((resolve, reject) => {
    const env = { ...process.env, ISPARTA_CAPTURE_DIR: tempDir, ISPARTA_CAPTURE_TARGET: CAPTURE_TARGET }
    delete env.ELECTRON_RUN_AS_NODE
    const child = spawn(electronExe, [__filename, '--capture-worker'], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    child.stdout.on('data', (d) => process.stdout.write(d))
    child.stderr.on('data', (d) => process.stderr.write(d))
    child.on('error', reject)
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error('截图采集失败，退出码 ' + code)))
    })
    for (const [name] of ACTIVE_SHOTS) {
      const source = path.join(tempDir, name + '.webp')
      if (!fs.existsSync(source)) throw new Error('缺少采集结果：' + name)
    }
    for (const [name] of ACTIVE_SHOTS) fs.copyFileSync(path.join(tempDir, name + '.webp'), path.join(SRC_DIR, name + '.webp'))
  } finally {
    for (const [name] of ACTIVE_SHOTS) {
      const file = path.join(tempDir, name + '.webp')
      if (fs.existsSync(file)) fs.unlinkSync(file)
    }
    fs.rmdirSync(tempDir)
  }
}

async function runCaptureWorker () {
  const { app, BrowserWindow } = require('electron')
  app.on('window-all-closed', () => {})
  await app.whenReady()
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  async function frameReady (win, port) {
    for (let i = 0; i < 100; i++) {
      const frame = win.webContents.mainFrame.frames.find((f) => f.url.includes(':' + port + '/'))
      if (frame) {
        const ready = await frame.executeJavaScript('!!document.querySelector(".ib")').catch(() => false)
        if (ready) return frame
      }
      await pause(100)
    }
    throw new Error('预览框架未就绪：' + port)
  }
  async function setupScene (frame, scene) {
    const action = `(async () => {
      const scene = ${JSON.stringify(scene)};
      const store = window.__ispartaStore;
      if (!store) throw new Error('mock store 未就绪');
      if (scene === 'desktop-empty') store.state.items.splice(0);
      if (scene === 'desktop-settings-general' || scene === 'desktop-settings-update') {
        const vm = document.querySelector('.globalsetting').__vue__;
        vm.dialogFormVisible = true;
        vm.activeTab = scene === 'desktop-settings-update' ? 'about' : 'output';
      }
      if (scene === 'cep-comp-tree') document.querySelector('.ib-rail__btn--layers').click();
      if (scene === 'cep-output-settings') {
        store.state.items[0].isSelected = true;
        document.querySelector('.ib-rail__btn--end').click();
        await new Promise(resolve => setTimeout(resolve, 0));
        document.querySelector('.ib-set-overlay .mod-setting').__vue__.activeTab = 'output';
      }
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}';
      document.head.appendChild(style);
      return { count: store.state.items.length, scene };
    })()`
    return frame.executeJavaScript(action)
  }
  try {
    for (const [name, target, width, height] of ACTIVE_SHOTS) {
      const win = new BrowserWindow({ width, height, show: true, resizable: false, useContentSize: true,
        webPreferences: { backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } })
      const version = require('../package.json').version
      await win.loadURL('http://127.0.0.1:8080/mockup.html?target=' + target + '&scene=' + name + '&version=' + encodeURIComponent(version))
      const frame = await frameReady(win, target === 'cep' ? 8082 : 8081)
      const result = await setupScene(frame, name)
      if (target === 'cep' && result.count !== 6) throw new Error('CEP 示例合成数量异常：' + result.count)
      await pause(350)
      const png = (await win.webContents.capturePage()).toPNG().toString('base64')
      const dataUrl = await win.webContents.executeJavaScript(`new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = ${width}; canvas.height = ${height};
          canvas.getContext('2d').drawImage(img, 0, 0); resolve(canvas.toDataURL('image/webp', .88)); };
        img.onerror = reject; img.src = 'data:image/png;base64,${png}';
      })`)
      if (!dataUrl.startsWith('data:image/webp;base64,')) throw new Error('浏览器未提供 WebP 编码：' + name)
      fs.writeFileSync(path.join(process.env.ISPARTA_CAPTURE_DIR, name + '.webp'), Buffer.from(dataUrl.split(',')[1], 'base64'))
      console.log('[capture] ' + name + ' · ' + width + '×' + height)
      win.destroy()
    }
    app.quit()
  } catch (e) {
    console.error('[capture] ' + e.stack)
    app.exit(1)
  }
}

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

if (CAPTURE_WORKER) {
  runCaptureWorker()
} else if (CAPTURE) {
  captureFromBrowser().then(main).catch((e) => { console.error('[capture] ' + e.message); process.exitCode = 1 })
} else {
  main()
}
