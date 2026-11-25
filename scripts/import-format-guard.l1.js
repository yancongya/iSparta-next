/**
 * L1：导入格式 / 输出目录预检守卫
 * 用法：node scripts/import-format-guard.l1.js
 *
 * 背景（本轮真机反馈，三个同源问题）：
 *   1) 拖 WebP 进来提示「没有找到可识别的图片」——WebP 只是输出格式、不能当源，
 *      应给专门说明；
 *   2) 导入 GIF 后输出格式只有 APNG/WEBP、却提示「已自动加 _gif 后缀」——
 *      formatStatic 在 UI 层藏了 GIF，但 options.outputFormat 里 GIF 还在（半成品特判）。
 *      修复：三格式一视同仁，撞源统一走「后缀胶囊 → 三选弹窗」，不再藏选项；
 *   3) 选了「输出到目录」仍提示旧目录产物已存在——预检查旧 outputPath、
 *      processor 却写新目录。修复：预检目录覆盖，两边对齐。
 *
 * 语义部分在 vm 沙箱里跑真实 outputConflict.js（bridge 形状 path），静态部分守文案与调用形态。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { bridgePath } = require('./bridge-path')

const ROOT = path.join(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const moduleBody = (file) => read(file)
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/gm, '')
  .replace(/^export /gm, '')

let passed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else {
    console.error('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
    process.exitCode = 1
  }
}

console.log('L1 导入格式 / 输出目录预检守卫')

// ---------- 1) classifyOutputConflicts 的目录覆盖（语义） ----------
function loadConflict (paths) {
  const ctx = vm.createContext({ path: bridgePath(paths), console })
  for (const f of ['src/util/outputName.js', 'src/util/pathUtil.js', 'src/util/outputConflict.js']) {
    vm.runInContext(moduleBody(f), ctx, { filename: f })
  }
  return ctx
}

for (const [platform, paths] of [['macOS', path.posix], ['Windows', path.win32]]) {
  const ctx = loadConflict(paths)
  const oldDir = paths.join('old')
  const newDir = paths.join('new', '输出')
  const item = {
    basic: { outputPath: oldDir, fileList: [paths.join(oldDir, 'cool.png')] },
    options: { outputName: 'cool', outputFormat: ['APNG', 'GIF', 'WEBP'] }
  }
  // 新目录里只有 cool.webp 已存在；旧目录里只有 cool.png 已存在。
  // 传覆盖目录 → 只报新目录的 webp；不传 → 只报旧目录的 png。
  const exists = (f) => {
    const norm = String(f).replace(/\\/g, '/').toLowerCase()
    return norm === String(paths.join(newDir, 'cool.webp')).replace(/\\/g, '/').toLowerCase()
  }
  const withOverride = ctx.classifyOutputConflicts([item], exists, newDir)
  ok(platform + ' 目录覆盖：命中新目录的 webp',
    withOverride.existing.length === 1 &&
    /new/.test(withOverride.existing[0].path) && /\.webp$/.test(withOverride.existing[0].path),
    withOverride)
  ok(platform + ' 目录覆盖：不误报旧目录产物',
    !withOverride.existing.some((r) => /old/.test(r.path)), withOverride)

  // 旧目录的 cool.png 是源文件（归 source），所以用非源的 cool.gif 验证旧 outputPath 仍生效。
  const legacyGif = ctx.classifyOutputConflicts([item], (f) => /cool\.gif$/.test(String(f)))
  ok(platform + ' 不传覆盖：仍用 item 自带 outputPath（向后兼容）',
    legacyGif.existing.length === 1 && /old/.test(legacyGif.existing[0].path) &&
    /\.gif$/.test(legacyGif.existing[0].path), legacyGif)

  // 撞源判定在覆盖目录下同样生效（用户把输出目录选成源目录 → 仍要弹三选）。
  const sourceInNew = {
    basic: { outputPath: oldDir, fileList: [paths.join(newDir, 'cool.gif')] },
    options: { outputName: 'cool', outputFormat: ['APNG', 'GIF', 'WEBP'] }
  }
  const hitSource = ctx.classifyOutputConflicts([sourceInNew], () => false, newDir)
  ok(platform + ' 目录覆盖：新目录命中源文件仍归 source',
    hitSource.source.length === 1 && hitSource.source[0].format === 'GIF', hitSource)
}

// ---------- 2) WebP 输入专门提示 ----------
{
  const home = read('src/ui-next/views/Home.vue')
  ok('Home 导入失败分支识别 .webp', /hasWebp = srcNames\.some/.test(home) && /\.webp\$/i.test(home))
  ok('Home WebP 走专门文案而非通用兜底',
    /\$t\('noticeWebpInputTitle'\)/.test(home) && /\$t\('noticeWebpInputTip'\)/.test(home))
  ok('Home 主入口文件选择对话框不再列出 webp 扩展名',
    /extensions: \['png', 'gif'\]/.test(home) && !/extensions: \[[^\]]*webp/.test(home))
  // 两个选文件入口（Home 主入口 + 任务列表「打开文件夹」Ctrl+点）必须一致，都不得列 webp。
  // 上一批去 webp 只改了 Home，projectList 漏改——真机在该入口仍能选到 webp，故锁死。
  const plist = read('src/components/projectList/projectList.vue')
  ok('projectList 任务列表入口文件对话框不再列出 webp',
    /extensions: \['png', 'gif'\]/.test(plist) && !/extensions: \[[^\]]*webp/.test(plist))
  ok('两个选文件入口过滤器一致（均无 webp）',
    /extensions: \['png', 'gif'\]/.test(home) && /extensions: \['png', 'gif'\]/.test(plist))
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    const src = read('src/locales/' + loc + '.js')
    for (const key of ['noticeWebpInputTitle', 'noticeWebpInputTip']) {
      ok(loc + ' 缺 key: ' + key, src.indexOf('"' + key + '"') >= 0)
    }
  }
}

// ---------- 2b) 导入提示补充粘贴/拖拽说明（三语两处） ----------
// 用户反馈：只讲「点击选择目录/Ctrl+点选文件」不够，应补充也能粘贴/拖入文件。
// 桌面 supportsFileImport 下 onDrop/onPaste 在任务态同样可用，故这两句文案都该带提示。
{
  // 每语两句各自的「粘贴/拖入」特征（简中/繁中/英文）
  const hintPattern = {
    'zh-cn': /粘贴|拖入/,
    'zh-tw': /貼上|拖入/,
    'en-us': /paste|drop/i
  }
  const readLoc = (loc) => {
    const src = read('src/locales/' + loc + '.js')
    const grab = (key) => {
      const m = src.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]*)"'))
      return m ? m[1] : ''
    }
    return { uploadRule: grab('uploadRule'), openFolderHint: grab('openFolderHint') }
  }
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    const t = readLoc(loc)
    ok(loc + ' uploadRule 含粘贴/拖入说明', hintPattern[loc].test(t.uploadRule), t.uploadRule)
    ok(loc + ' openFolderHint 含粘贴/拖入说明', hintPattern[loc].test(t.openFolderHint), t.openFolderHint)
  }
}

// ---------- 3) 三格式一视同仁：formatStatic 不再藏 GIF ----------
{
  const setting = read('src/components/setting/setting.vue')
  const start = setting.indexOf('formatStatic () {')
  assert(start >= 0, '找不到 formatStatic')
  const body = setting.slice(start, setting.indexOf('\n    },', start))
  ok('formatStatic 直接返回三种格式，无 GIF 特判',
    /return OUTPUT_FORMATS\.slice\(\)/.test(body) && !/OUTPUT_FORMATS\.filter/.test(body) &&
    !/allGif/.test(body), body.slice(0, 160))
}

// ---------- 4) 预检目录透传：store / setting / outputConflict 三处 ----------
{
  const store = read('src/store/index.js')
  const sStart = store.indexOf('  async preflightOutputs (context, items) {')
  assert(sStart >= 0, '找不到 preflightOutputs')
  const sBody = store.slice(sStart, store.indexOf('\n  },', sStart))
  ok('store 从 payload 提取 sameOutputPath', /sameOutputPath = payload/.test(sBody), sBody.slice(0, 300))
  ok('store 把目录传给 classifyOutputConflicts',
    /classifyOutputConflicts\(list,[\s\S]*?sameOutputPath\)/.test(sBody))
  // mock 短路必须在 conflict scan 之前（沿用既有契约）
  ok('mock env 短路仍在预检扫描前',
    sBody.indexOf('if (isMockEnv()) { return true }') < sBody.indexOf('classifyOutputConflicts('))

  const setting = read('src/components/setting/setting.vue')
  ok('setting 预检传 { items, sameOutputPath }',
    /preflightPayload = sameOutputPath[\s\S]{0,200}sameOutputPath: sameOutputPath/.test(setting) &&
    /dispatch\('preflightOutputs', preflightPayload\)/.test(setting))
}

console.log('\nimport format guard L1:', passed, 'passed')
if (process.exitCode) console.error('存在失败项')
