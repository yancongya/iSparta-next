/**
 * CEP 开发/真实版模式切换（仅 Windows，用户明确授权新建——见 AGENTS.md §8 例外）
 *
 * 背景：AE 的 CEP 会在「系统级」与「用户级」两个目录扫描同一 bundle id 的扩展，
 * 同名时按 Adobe 规则决胜：① manifest 版本高者 ② manifest 修改时间新者 ③ 先找到者。
 * 本项目的系统级副本（一体安装）与用户级挂载（开发）都把 ExtensionBundleVersion
 * 固定为 0.1.0，因此实际由「manifest 修改时间」决定加载哪份——这正是切换的杠杆。
 *
 * 用法：
 *   node scripts/dev/cep-mode.js status    # 只读：当前到底会加载哪份（安全，随时可跑）
 *   node scripts/dev/cep-mode.js dev       # 切到开发版：建 junction + 改 MainPath + 起 HMR
 *   node scripts/dev/cep-mode.js restore   # 切回真实版：删 junction + MainPath 复位（不碰系统级）
 *
 * 关键铁律（详见 docs/CEP-DEV-SWITCH.md）：
 *  - 关闭开发模式必须以「删 junction」为准，不是只跑 npm run dev:cep:off。
 *    只 off 不删 junction → CEP 仍加载用户级，而且可能是 targets/cep/ui 的旧产物。
 *  - 开发挂载存在期间，绝对不要跑一体安装 / 面板内检查更新（NSIS 会因双副本冲突）。
 *  - 判断「当前用哪份」看本脚本 status 或 bug 行为，不要看面板标题的版本号
 *    （标题是编译进 bundle 的 APP_VERSION，不是运行时探测，会漂移）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const EXT_ID = 'io.github.isparta-next'
const USER_EXT = path.join(process.env.APPDATA || '', 'Adobe', 'CEP', 'extensions', EXT_ID)
const SYSTEM_EXT = path.join(
  process.env['CommonProgramFiles(x86)'] || 'C:\\Program Files (x86)\\Common Files',
  'Adobe', 'CEP', 'extensions', EXT_ID
)
const SOURCE = path.join(ROOT, 'targets', 'cep')
const MANIFEST = path.join(SOURCE, 'CSXS', 'manifest.xml')
const SYSTEM_MANIFEST = path.join(SYSTEM_EXT, 'CSXS', 'manifest.xml')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// Windows 上 Node 不能直接 spawn .cmd（CVE-2024-27980），必须过 shell —— AGENTS §1.1
function spawnTool (cmd, args, opts) {
  if (process.platform === 'win32') {
    return spawn([cmd].concat(args).join(' '), Object.assign({ shell: true }, opts))
  }
  return spawn(cmd, args, opts)
}

function exists (p) { try { fs.lstatSync(p); return true } catch (e) { return false } }

/** 返回 'junction' | 'dir' | 'missing'；junction 的 target 一并给出 */
function linkInfo (p) {
  try {
    const st = fs.lstatSync(p)
    if (st.isSymbolicLink() || (st.isDirectory() && st.isJunction?.())) {
      let target = ''
      try { target = fs.readlinkSync(p) } catch (e) { /* 非 symlink 形态的 junction */ }
      return { kind: 'junction', target: target }
    }
    if (st.isDirectory()) { return { kind: 'dir', target: '' } }
    return { kind: 'other', target: '' }
  } catch (e) { return { kind: 'missing', target: '' } }
}

function readVersionJson (dir) {
  const p = path.join(dir, 'version.json')
  try {
    const j = JSON.parse(fs.readFileSync(p, 'utf8'))
    return { version: j.version || '?', source: j.source || '', installedAt: j.installedAt || '' }
  } catch (e) { return null }
}

function readManifest (file) {
  try {
    const xml = fs.readFileSync(file, 'utf8')
    const mainPath = (xml.match(/<MainPath>([^<]*)<\/MainPath>/) || [])[1] || '?'
    const bundleVer = (xml.match(/ExtensionBundleVersion="([^"]*)"/) || [])[1] || '?'
    const mtime = fs.statSync(file).mtime
    return { mainPath: mainPath, bundleVer: bundleVer, mtime: mtime, mtimeStr: mtime.toISOString() }
  } catch (e) { return null }
}

function hr (title) {
  console.log('')
  console.log('  ── ' + title + ' ' + '─'.repeat(Math.max(0, 50 - title.length * 2)))
}

/**
 * 判定 CEP 实际会加载哪份。规则对齐 Adobe Cookbook：
 *  同 bundle id → ① manifest 版本高 ② manifest 修改时间新 ③ 查找顺序(system 先于 user)
 * 本仓库两边 bundleVersion 都是 0.1.0，故落到 ②。
 */
function decide (user, system) {
  if (user.kind === 'missing' && system.kind === 'missing') {
    return { label: '无扩展', reason: '系统级与用户级都没有该扩展，AE 面板不会出现' }
  }
  if (user.kind === 'missing') {
    return { label: '系统级（真实版）', reason: '用户级无副本，CEP 只会扫描到系统级' }
  }
  if (system.kind === 'missing') {
    return { label: '用户级', reason: '系统级无副本，CEP 只会扫描到用户级（开发/残留）' }
  }
  // 两边都在 → 按 Adobe 规则决胜
  const um = readManifest(path.join(USER_EXT, 'CSXS', 'manifest.xml'))
  const sm = readManifest(SYSTEM_MANIFEST)
  if (um && sm) {
    const uv = String(um.bundleVer)
    const sv = String(sm.bundleVer)
    if (uv !== sv) {
      const cmp = compareVer(uv, sv)
      if (cmp > 0) { return { label: '用户级', reason: 'manifest 版本 ' + uv + ' > 系统级 ' + sv } }
      if (cmp < 0) { return { label: '系统级（真实版）', reason: 'manifest 版本 ' + sv + ' > 用户级 ' + uv } }
    }
    // 版本相同 → 比修改时间
    if (um.mtime.getTime() > sm.mtime.getTime()) {
      return { label: '用户级', reason: 'manifest 版本同为 ' + uv + '，用户级修改时间更新（' + um.mtimeStr + '）' }
    }
    if (um.mtime.getTime() < sm.mtime.getTime()) {
      return { label: '系统级（真实版）', reason: 'manifest 版本同为 ' + uv + '，系统级修改时间更新（' + sm.mtimeStr + '）' }
    }
    return { label: '系统级（真实版）', reason: '版本与时间都相同，CEP 取先找到的（system 先于 user）' }
  }
  return { label: '无法确定', reason: '有一侧 manifest 读不到，无法套用 Adobe 决胜规则' }
}

function compareVer (a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) { return d > 0 ? 1 : -1 }
  }
  return 0
}

function cmdStatus () {
  const user = linkInfo(USER_EXT)
  const system = linkInfo(SYSTEM_EXT)
  const verdict = decide(user, system)
  const uv = user.kind === 'missing' ? null : readVersionJson(USER_EXT)
  const sv = system.kind === 'missing' ? null : readVersionJson(SYSTEM_EXT)
  const um = readManifest(MANIFEST)
  const sm = system.kind === 'missing' ? null : readManifest(SYSTEM_MANIFEST)

  console.log('')
  console.log('  iSparta-next · CEP 模式状态')
  hr('系统级（真实版 / 一体安装）')
  console.log('  路径      ' + SYSTEM_EXT)
  console.log('  存在      ' + (system.kind !== 'missing'))
  if (sv) { console.log('  版本      ' + sv.version + (sv.source ? '  (source=' + sv.source + ')' : '')) }
  if (sm) { console.log('  MainPath  ' + sm.mainPath + '   bundleVer=' + sm.bundleVer); console.log('  manifest  ' + sm.mtimeStr) }

  hr('用户级（开发挂载位）')
  console.log('  路径      ' + USER_EXT)
  console.log('  形态      ' + user.kind + (user.target ? '  → ' + user.target : ''))
  if (uv) { console.log('  版本      ' + uv.version) }
  if (user.kind !== 'missing' && um) { console.log('  MainPath  ' + um.mainPath + '   bundleVer=' + um.bundleVer); console.log('  manifest  ' + um.mtimeStr) }

  hr('源码侧 targets/cep')
  if (um) { console.log('  MainPath  ' + um.mainPath + '   bundleVer=' + um.bundleVer); console.log('  manifest  ' + um.mtimeStr) }

  hr('判定：AE 会加载')
  console.log('  ⇒ ' + verdict.label)
  console.log('  ' + verdict.reason)
  console.log('')
  console.log('  提示：判断加载来源请看这里或 bug 行为，不要看面板标题的版本号（会漂移）。')
  console.log('')
}

function fail (msg) { console.error('  ✗ ' + msg); process.exitCode = 1 }

function cmdDev () {
  if (process.platform !== 'win32') { fail('本脚本仅支持 Windows'); return }
  const user = linkInfo(USER_EXT)
  const system = linkInfo(SYSTEM_EXT)

  // 守卫 1：用户级若已是 junction 且指向源码 → 幂等，直接进入起服务
  if (user.kind === 'junction') {
    const t = path.resolve(user.target || '')
    const src = path.resolve(SOURCE)
    if (t.toLowerCase() === src.toLowerCase()) {
      console.log('  · 用户级 junction 已指向源码，跳过建链')
    } else {
      fail('用户级已存在 junction，但指向别处：' + (user.target || '(未知)') + '\n    请先人工确认后手动删除，本脚本不覆盖。')
      return
    }
  } else if (user.kind === 'dir') {
    fail('用户级存在实体目录（非 junction），拒绝覆盖：' + USER_EXT + '\n    这通常是要保留的副本，请先人工处理。')
    return
  } else if (user.kind === 'other') {
    fail('用户级路径存在但形态异常，拒绝覆盖：' + USER_EXT)
    return
  } else {
    // 守卫 2：系统级如果也在，必须提醒（同 ID 共存期间禁更新 NSIS）
    if (system.kind !== 'missing') {
      console.log('  ! 检测到系统级真实版仍在。开发挂载存在期间：')
      console.log('    · 不要点「检查更新」或跑一体安装（NSIS 会因同 ID 双副本冲突）')
      console.log('    · 收工务必跑 restore 删 junction 后再更新')
    }
    fs.mkdirSync(path.dirname(USER_EXT), { recursive: true })
    // junction 用 type 'junction'，无需管理员权限
    fs.symlinkSync(SOURCE, USER_EXT, 'junction')
    console.log('  ✓ 已建 junction: ' + USER_EXT + ' → ' + SOURCE)
  }

  console.log('  · 现在切 manifest 到 dev-hmr.html 并启动 HMR（8082）…')
  console.log('  · CEP 无 Ctrl+R：改完 src/** 自动热更；刷新面板 = 关面板再开')
  const child = spawnTool(npmCmd, ['run', 'dev:cep'], { cwd: ROOT, stdio: 'inherit', env: process.env })
  child.on('exit', function (code) { process.exitCode = code || 0 })
}

function cmdRestore () {
  if (process.platform !== 'win32') { fail('本脚本仅支持 Windows'); return }
  const user = linkInfo(USER_EXT)

  // 1) 先把 manifest 复位（MainPath → ui/index.html）
  console.log('  · 复位 manifest MainPath → ./ui/index.html')
  const child = spawnTool(npmCmd, ['run', 'dev:cep:off'], { cwd: ROOT, stdio: 'inherit', env: process.env })
  child.on('exit', function (code) {
    if (code) { fail('dev:cep:off 失败，未删 junction，请人工排查'); process.exitCode = code; return }

    // 2) 关键：删 junction —— 只 off 不删等于没切回（CEP 仍读用户级）
    if (user.kind === 'junction') {
      try {
        fs.unlinkSync(USER_EXT)
        console.log('  ✓ 已删除用户级 junction：' + USER_EXT)
      } catch (e) { fail('删 junction 失败：' + e.message + '\n    请手动删除：' + USER_EXT); return }
    } else if (user.kind === 'missing') {
      console.log('  · 用户级本就无副本，无需删除')
    } else {
      fail('用户级形态为 ' + user.kind + '（非 junction），为安全起见未删除，请人工确认：' + USER_EXT)
      return
    }

    hr('完成')
    console.log('  当前 AE 应回到系统级真实版（3.10.1）。')
    console.log('  → 请在 AE 里关面板再开一次以生效。')
    console.log('  → 之后可正常点「检查更新」拉取新版。')
    console.log('')
  })
}

function usage () {
  console.log('')
  console.log('  iSparta-next · CEP 模式切换（仅 Windows）')
  console.log('')
  console.log('  用法：node scripts/dev/cep-mode.js <status|dev|restore>')
  console.log('')
  console.log('    status    只读：报告当前 CEP 会加载哪份（安全，随时可跑）')
  console.log('    dev       切到开发版：建 junction + 改 MainPath + 起 HMR(:8082)')
  console.log('    restore   切回真实版：删 junction + MainPath 复位（不动系统级）')
  console.log('')
  console.log('  判断加载来源看 status 或 bug 行为，别看面板标题版本号（会漂移）。')
  console.log('')
}

function main () {
  const cmd = process.argv[2]
  if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') { usage(); return }
  if (cmd === 'status') { cmdStatus(); return }
  if (cmd === 'dev') { cmdDev(); return }
  if (cmd === 'restore') { cmdRestore(); return }
  fail('未知命令：' + cmd)
  usage()
}

main()
