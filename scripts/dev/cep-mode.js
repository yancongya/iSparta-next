/**
 * CEP 开发/真实版模式切换（仅 Windows，用户明确授权新建——见 AGENTS.md §8 例外）
 *
 * ⭐ v2（2026-11-25）：开发版改用独立 bundle id `io.github.isparta-next.dev`，
 * 与系统级真实安装 `io.github.isparta-next` 彻底分离。两者在 AE 扩展菜单里是
 * 两个独立条目，各自加载、互不竞争、互不覆盖。这消除了旧方案的三个痛点：
 *  ① 不再违反「同 ID 双副本不可长期共存」铁律（AGENTS §8.1）；
 *  ② 不再靠 manifest mtime 抢加载，也不再有「胜出副本加载失败无回退」的风险；
 *  ③ 源码 targets/cep/CSXS/manifest.xml 永不改写，打包/打包守卫零污染。
 *
 * 用户级开发位现在是一个「真实目录」，内部结构：
 *   io.github.isparta-next.dev/
 *     CSXS/manifest.xml   ← 脚本生成（独立 ID/菜单名/MainPath），每次 dev 覆盖
 *     dev-hmr.html        ← 从源码拷贝（跳转 8082 HMR，不可达回退 ./ui/index.html）
 *     ui, jsx, lib, bin, css, js, index.html 等 ← junction/hardlink 指向源码 targets/cep
 *
 * 用法：
 *   node scripts/dev/cep-mode.js status    # 只读：报告两份扩展各自状态（安全，随时可跑）
 *   node scripts/dev/cep-mode.js dev       # 建/刷新开发位（独立 ID）+ 改 MainPath + 起 HMR
 *   node scripts/dev/cep-mode.js restore   # 删整个开发位（不动系统级、不动源码 manifest）
 *
 * 关键约定（详见 docs/CEP-DEV-SWITCH.md）：
 *  - 开发位 ID 与生产 ID 不同 → 可长期共存；restore = 删开发目录，系统级始终原封不动。
 *  - 源码 manifest 永不改写；dev manifest 由本脚本从生产 manifest 派生到开发位。
 *  - 判断加载来源看 status 或 bug 行为，不要看面板标题版本号（APP_VERSION 编译内联、会漂移）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = path.join(__dirname, '..', '..')
const EXT_ID = 'io.github.isparta-next'          // 生产 / 系统级（只读参照）
const DEV_EXT_ID = 'io.github.isparta-next.dev'  // 开发位（用户级，独立 ID）
const USER_EXT = path.join(process.env.APPDATA || '', 'Adobe', 'CEP', 'extensions', DEV_EXT_ID)
const SYSTEM_EXT = path.join(
  process.env['CommonProgramFiles(x86)'] || 'C:\\Program Files (x86)\\Common Files',
  'Adobe', 'CEP', 'extensions', EXT_ID
)
const SOURCE = path.join(ROOT, 'targets', 'cep')
const MANIFEST = path.join(SOURCE, 'CSXS', 'manifest.xml')
const SYSTEM_MANIFEST = path.join(SYSTEM_EXT, 'CSXS', 'manifest.xml')
const DEV_MANIFEST = path.join(USER_EXT, 'CSXS', 'manifest.xml')
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'

// 开发位中要做成「指向源码」的项。目录用 junction，散文件用 hardlink（同盘）或 copy。
const LINK_DIRS = ['ui', 'jsx', 'lib', 'bin', 'css', 'js']
const LINK_FILES = ['index.html', 'dev-hmr.html']

// Windows 上 Node 不能直接 spawn .cmd（CVE-2024-27980），必须过 shell —— AGENTS §1.1
function spawnTool (cmd, args, opts) {
  if (process.platform === 'win32') {
    return spawn([cmd].concat(args).join(' '), Object.assign({ shell: true }, opts))
  }
  return spawn(cmd, args, opts)
}

function exists (p) { try { fs.lstatSync(p); return true } catch (e) { return false } }

/** 返回 'junction' | 'dir' | 'file' | 'missing'；junction 的 target 一并给出 */
function linkInfo (p) {
  try {
    const st = fs.lstatSync(p)
    if (st.isSymbolicLink() || (st.isDirectory() && st.isJunction && st.isJunction())) {
      let target = ''
      try { target = fs.readlinkSync(p) } catch (e) { /* 非 symlink 形态的 junction */ }
      return { kind: 'junction', target: target }
    }
    if (st.isDirectory()) { return { kind: 'dir', target: '' } }
    return { kind: 'file', target: '' }
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
    const bundleId = (xml.match(/ExtensionBundleId="([^"]*)"/) || [])[1] || '?'
    const bundleVer = (xml.match(/ExtensionBundleVersion="([^"]*)"/) || [])[1] || '?'
    const menu = (xml.match(/<Menu>([^<]*)<\/Menu>/) || [])[1] || '?'
    const mtime = fs.statSync(file).mtime
    return { mainPath: mainPath, bundleId: bundleId, bundleVer: bundleVer, menu: menu, mtime: mtime, mtimeStr: mtime.toISOString() }
  } catch (e) { return null }
}

function hr (title) {
  console.log('')
  console.log('  ── ' + title + ' ' + '─'.repeat(Math.max(0, 50 - title.length * 2)))
}

/**
 * 从生产 manifest 派生开发版 manifest：只换 ID / 菜单名 / MainPath，其余结构原样保留。
 * 这样生产 manifest 的任何改动（Host 版本、CEF 参数等）都能自动继承到开发位。
 */
function buildDevManifest () {
  const prod = fs.readFileSync(MANIFEST, 'utf8')
  let out = prod
  // BundleId 与所有 <Extension Id>（两处）
  out = out.split(EXT_ID).join(DEV_EXT_ID)
  // 菜单名：AE 扩展菜单里显示为可区分的条目
  out = out.replace(/<Menu>[^<]*<\/Menu>/, '<Menu>' + EXT_ID + ' · DEV</Menu>')
  // 开发位入口：dev-hmr.html（探测 8082，不可达回退 ui/index.html）
  out = out.replace(/<MainPath>[^<]*<\/MainPath>/, '<MainPath>./dev-hmr.html</MainPath>')
  return out
}

/** 建/刷新开发位的资源链接；manifest 单独写。重复调用幂等。 */
function stageDevBundle () {
  fs.mkdirSync(path.join(USER_EXT, 'CSXS'), { recursive: true })
  // 1) 独立 manifest（每次覆盖，保证与当前源码同步）
  fs.writeFileSync(DEV_MANIFEST, buildDevManifest())
  console.log('  ✓ 写入独立开发 manifest: ' + DEV_MANIFEST)

  // 2) 子目录 → junction 到源码（不存在才建；已存在则跳过）
  for (const name of LINK_DIRS) {
    const src = path.join(SOURCE, name)
    const dst = path.join(USER_EXT, name)
    if (!exists(src)) { console.log('  · 源码无 ' + name + '，跳过'); continue }
    if (exists(dst)) {
      const info = linkInfo(dst)
      if (info.kind === 'junction' && path.resolve(info.target || '').toLowerCase() === path.resolve(src).toLowerCase()) {
        console.log('  · ' + name + ' junction 已就绪，跳过')
      } else {
        console.log('  ! ' + name + ' 已存在且非期望链接，跳过（未覆盖）: ' + info.kind)
      }
      continue
    }
    fs.symlinkSync(src, dst, 'junction')
    console.log('  ✓ junction ' + name + ' → ' + src)
  }

  // 3) 散文件 → 从源码拷贝（junction 只能是目录）
  for (const name of LINK_FILES) {
    const src = path.join(SOURCE, name)
    const dst = path.join(USER_EXT, name)
    if (!exists(src)) { continue }
    fs.copyFileSync(src, dst)
    console.log('  ✓ 拷贝 ' + name)
  }
}

function hr2 (title) { console.log('\n  ' + title) }

function cmdStatus () {
  const user = linkInfo(USER_EXT)
  const system = linkInfo(SYSTEM_EXT)
  const um = readManifest(DEV_MANIFEST)
  const sm = system.kind === 'missing' ? null : readManifest(SYSTEM_MANIFEST)
  const srcm = readManifest(MANIFEST)

  console.log('')
  console.log('  iSparta-next · CEP 模式状态（v2 独立 ID）')

  hr('系统级 · 真实版（一体安装，生产 ID）')
  console.log('  ID        ' + EXT_ID)
  console.log('  路径      ' + SYSTEM_EXT)
  console.log('  存在      ' + (system.kind !== 'missing'))
  if (sm) { console.log('  MainPath  ' + sm.mainPath + '   bundleVer=' + sm.bundleVer); console.log('  manifest  ' + sm.mtimeStr) }

  hr('用户级 · 开发位（独立 DEV ID）')
  console.log('  ID        ' + DEV_EXT_ID)
  console.log('  路径      ' + USER_EXT)
  console.log('  形态      ' + user.kind + (user.target ? '  → ' + user.target : ''))
  if (um) { console.log('  Menu      ' + um.menu); console.log('  MainPath  ' + um.mainPath + '   bundleVer=' + um.bundleVer) }

  hr('源码侧 targets/cep（生产 manifest，永不被 dev 改写）')
  if (srcm) { console.log('  ID        ' + srcm.bundleId); console.log('  MainPath  ' + srcm.mainPath + '   bundleVer=' + srcm.bundleVer) }

  hr('判定：AE 扩展菜单')
  if (system.kind !== 'missing') console.log('  ⇒ 菜单「' + EXT_ID + '」= 系统级真实版（独立条目）')
  if (user.kind !== 'missing') console.log('  ⇒ 菜单「io.github.isparta-next · DEV」= 用户级开发位（独立条目）')
  if (system.kind === 'missing' && user.kind === 'missing') console.log('  ⇒ 两份都不存在，AE 不会出现 iSparta 扩展')
  console.log('')
  console.log('  两个 ID 各自独立加载、互不竞争；dev 加载失败不影响真实版。')
  console.log('  判断加载来源看 status 或 bug 行为，不要看面板标题版本号（会漂移）。')
  console.log('')
}

function fail (msg) { console.error('  ✗ ' + msg); process.exitCode = 1 }

function cmdDev () {
  if (process.platform !== 'win32') { fail('本脚本仅支持 Windows'); return }

  const user = linkInfo(USER_EXT)
  // 守卫：开发位若存在但不是「本脚本建的真实目录形态」（如旧的 junction 或残留实体），拒绝盲目覆盖
  if (user.kind === 'junction') {
    fail('开发位路径存在 junction（疑似旧方案残留）：' + USER_EXT +
      '\n    请先跑 node scripts/dev/cep-mode.js restore，再重试。')
    return
  }

  stageDevBundle()
  console.log('  · 起 HMR 服务（:8082，serve:cep 不改源码 manifest）…')
  console.log('  · CEP 无 Ctrl+R：改完 src/** 自动热更；刷新面板 = 关面板再开')
  console.log('  · AE 菜单里新增独立条目「io.github.isparta-next · DEV」，与真实版共存')
  const child = spawnTool(npmCmd, ['run', 'serve:cep'], { cwd: ROOT, stdio: 'inherit', env: process.env })
  child.on('exit', function (code) { process.exitCode = code || 0 })
}

function cmdRestore () {
  if (process.platform !== 'win32') { fail('本脚本仅支持 Windows'); return }
  const user = linkInfo(USER_EXT)

  if (user.kind === 'missing') {
    console.log('  · 开发位本就不存在，无需删除')
  } else if (user.kind === 'junction') {
    fail('开发位是 junction（旧方案残留），按铁律不自动删除；请人工确认后删除：' + USER_EXT)
    return
  } else {
    // 删整个开发位真实目录：先删内部 junction，再递归删目录，避免误删 junction 指向的源码
    try {
      for (const name of LINK_DIRS) {
        const p = path.join(USER_EXT, name)
        const info = linkInfo(p)
        if (info.kind === 'junction') fs.unlinkSync(p)
      }
      fs.rmSync(USER_EXT, { recursive: true, force: true })
      console.log('  ✓ 已删除开发位目录：' + USER_EXT)
    } catch (e) {
      fail('删开发位失败：' + e.message + '\n    请手动删除：' + USER_EXT)
      return
    }
  }

  hr('完成')
  console.log('  系统级真实版（' + EXT_ID + '）全程未被触碰，仍是日常版本。')
  console.log('  源码 targets/cep/CSXS/manifest.xml 也未被改写。')
  console.log('  → 请在 AE 里关面板再开一次（DEV 菜单项消失）。')
  console.log('')
}

function usage () {
  console.log('')
  console.log('  iSparta-next · CEP 模式切换 v2（独立 DEV ID，仅 Windows）')
  console.log('')
  console.log('  用法：node scripts/dev/cep-mode.js <status|dev|restore>')
  console.log('')
  console.log('    status    只读：报告真实版 / 开发位两份扩展的状态')
  console.log('    dev       建/刷新开发位（' + DEV_EXT_ID + '）+ 起 HMR(:8082)')
  console.log('    restore   删整个开发位（不动系统级、不动源码 manifest）')
  console.log('')
  console.log('  真实版 ID: ' + EXT_ID + '    开发位 ID: ' + DEV_EXT_ID)
  console.log('  两个 ID 各为独立菜单项、互不竞争；源码 manifest 永不改写。')
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
