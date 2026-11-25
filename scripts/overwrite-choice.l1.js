/**
 * L1：覆盖源文件的三选行为（直接覆盖 / 加后缀另存 / 取消）
 * 用法：node scripts/overwrite-choice.l1.js
 *
 * 背景：预检弹窗必须让用户在「直接覆盖源文件」和「加后缀另存」之间选，
 * 只给「仍要覆盖并开始」一条路是错的（点了其实落的是 cool_1.png，语义不符）。
 * 本脚本在 vm 沙箱里跑 store 的 preflightOutputs，用假的 notice.confirm
 * 依次回传三种答案，断言 dispatch 出去的后果正确。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const { bridgePath } = require('./bridge-path')

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const moduleBody = (file) => read(file)
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/gm, '')
  .replace(/^export /gm, '')

const storeSource = read('src/store/index.js')
const start = storeSource.indexOf('  async preflightOutputs (context, items) {')
assert(start >= 0, 'store 里找不到 preflightOutputs')
// 切到方法收尾的 `  }`（含花括号本身），否则取出来的片段缺右括号
const end = storeSource.indexOf('\n  },', start)
assert(end > start, 'store 里 preflightOutputs 没有正常收尾')
const body = storeSource.slice(start, end + 4)

let passed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else {
    console.error('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
    process.exitCode = 1
  }
}

async function runWith (paths, choice, existsFn) {
  const warnings = []
  const exists = existsFn || (() => false)
  const ctx = vm.createContext({
    // 注入 bridge 形状的 path（只有 join/dirname/basename/sep），
    // 与真机 renderer 拿到的完全一致：越界调用（如 path.extname）会在这里立刻炸，
    // 而不是等真机才发现。详见 scripts/bridge-path.js。
    path: bridgePath(paths),
    console,
    isMockEnv: () => false,
    fs: { existsSync: exists },
    notice: { confirm: async () => choice, warning: (title, body) => warnings.push({ title, body }) },
    i18n: { t: (k, p) => (p ? k + ':' + JSON.stringify(p) : k) }
  })
  for (const file of ['src/util/outputName.js', 'src/util/pathUtil.js', 'src/util/outputConflict.js']) {
    vm.runInContext(moduleBody(file), ctx, { filename: file })
  }
  vm.runInContext('this.preflight = ({' + body + '}).preflightOutputs', ctx)
  const calls = []
  const dir = paths.join('dir')
  const item = {
    basic: { outputPath: dir, fileList: [paths.join(dir, 'cool.png')] },
    options: { outputName: 'cool', outputFormat: ['APNG', 'GIF'] }
  }
  const allowed = await ctx.preflight(
    { dispatch: (type, payload) => calls.push({ type, payload }), rootState: { items: [item] } },
    [item]
  )
  return { allowed, calls, item, warnings }
}

async function main () {
  console.log('L1 覆盖源文件三选（直接覆盖 / 加后缀另存 / 取消）')
  for (const [platform, paths] of [['macOS', path.posix], ['Windows', path.win32]]) {
    // ---- 选「直接覆盖源文件」→ 写授权标记，不改产物名 ----
    {
      const { allowed, calls, item } = await runWith(paths, 'overwrite')
      ok(platform + ' 直接覆盖：预检放行', allowed === true, { allowed })
      const ow = calls.find((c) => c.type === 'setSourceOverwrite')
      ok(platform + ' 直接覆盖：写 overwriteSource=true', !!ow && ow.payload.value === true, { ow })
      ok(platform + ' 直接覆盖：标记挂在撞源的那个任务上', !!ow && ow.payload.item === item)
      ok(platform + ' 直接覆盖：不改产物名', !calls.find((c) => c.type === 'applyNameOverride'), { calls })
    }
    // ---- 选「加后缀另存」→ 按格式写实际产物名，不给覆盖授权 ----
    {
      const { allowed, calls } = await runWith(paths, true)
      ok(platform + ' 另存：预检放行', allowed === true, { allowed })
      const ov = calls.find((c) => c.type === 'applyNameOverride')
      ok(platform + ' 另存：写 actual 产物名', !!ov && ov.payload.name === 'cool_1', { ov })
      ok(platform + ' 另存：只改撞源的那个格式', !!ov && ov.payload.format === 'APNG', { ov })
      ok(platform + ' 另存：不给覆盖授权', !calls.find((c) => c.type === 'setSourceOverwrite' && c.payload.value === true), { calls })
    }
    // ---- 取消 → 放弃启动，一个副作用都不留 ----
    {
      const { allowed, calls } = await runWith(paths, false)
      ok(platform + ' 取消：预检不放行', allowed === false, { allowed })
      ok(platform + ' 取消：不写任何状态', calls.length === 0, { calls })
    }
    // ---- 改名后的目标若已存在，也要纳入「目标已存在」提示（不静默覆盖）----
    {
      const renamedFile = paths.join('dir', 'cool_1.png')
      const { warnings } = await runWith(paths, true, (f) => f === renamedFile)
      ok(platform + ' 另存：改名目标已存在时给 warning', warnings.length === 1 && String(warnings[0].body).indexOf('cool_1.png') >= 0, { warnings })
    }
  }

  // ---- 弹窗文案三语齐全（直接覆盖 / 另存为 / 多项另存）----
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    const src = read('src/locales/' + loc + '.js')
    for (const key of ['overwriteDirect', 'overwriteRenameOne', 'overwriteRenameMany', 'noticeOverwriteSourceBody']) {
      ok(loc + ' 缺 key: ' + key, src.indexOf('"' + key + '"') >= 0)
    }
    ok(loc + ' 不该再有旧的「仍要覆盖」单按钮文案', src.indexOf('"overwriteConfirm"') < 0)
  }

  console.log('\noverwrite choice L1:', passed, 'passed')
  if (process.exitCode) console.error('存在失败项')
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
