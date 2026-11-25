/**
 * L1：跨任务同名产物的冲突检测、三选、以及「另存只本次有效」的生命周期
 * 用法：node scripts/cross-item-conflict.l1.js
 *
 * 背景：两个任务同输出名 + 同输出目录时，非撞源的格式（如 WEBP）会落到同一文件。
 * 旧 seen 去重把第二个直接吞掉，预检全盲、后者静默覆盖前者（6 产物变 5 个）。
 * 修复后：跨任务同名走与撞源同款三选弹窗；「另存」写一次性 transient 字段，
 * 下次 preflight 入口清除 → 任务名回基础名 → 跨任务冲突重新识别、重新弹窗。
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

let passed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else {
    console.error('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
    process.exitCode = 1
  }
}

function makeCtx (paths, existsFn, answers) {
  const exists = existsFn || (() => false)
  const queue = (answers || []).slice()
  const confirmCalls = []
  const warnings = []
  const ctx = vm.createContext({
    // bridge 形状 path：只有 join/dirname/basename/sep，与真机 renderer 一致
    path: bridgePath(paths),
    console,
    isMockEnv: () => false,
    fs: { existsSync: exists },
    notice: {
      confirm: async (opts) => {
        confirmCalls.push(opts)
        return queue.length ? queue.shift() : false
      },
      warning: (title, body) => warnings.push({ title, body })
    },
    i18n: { t: (k, p) => (p ? k + ':' + JSON.stringify(p) : k) }
  })
  for (const file of ['src/util/outputName.js', 'src/util/pathUtil.js', 'src/util/outputConflict.js']) {
    vm.runInContext(moduleBody(file), ctx, { filename: file })
  }
  return { ctx, confirmCalls, warnings, queue }
}

function loadPreflight (ctx) {
  const src = read('src/store/index.js')
  const start = src.indexOf('  async preflightOutputs (context, items) {')
  assert(start >= 0, 'store 里找不到 preflightOutputs')
  const end = src.indexOf('\n  },', start)
  assert(end > start, 'store 里 preflightOutputs 没有正常收尾')
  vm.runInContext('this.preflight = ({' + src.slice(start, end + 4) + '}).preflightOutputs', ctx)
  return ctx.preflight
}

/** 复刻真机 case：两个同名任务、三格式、同一输出目录，各自撞源格式不同 */
function pair (paths, dir) {
  return [
    {
      basic: { outputPath: dir, fileList: [paths.join(dir, 'cool.png')] },
      options: { outputName: 'cool', conflictFormat: 'APNG', outputFormat: ['APNG', 'GIF', 'WEBP'] }
    },
    {
      basic: { outputPath: 'other', fileList: [paths.join('other', 'cool.gif')] },
      options: { outputName: 'cool', conflictFormat: 'GIF', outputFormat: ['APNG', 'GIF', 'WEBP'] }
    }
  ]
}

/**
 * dispatch 同时做真实状态变更（模拟 store mutation），这样连续两次预检能验证
 * 「第一次另存写临时名 → 第二次入口清除 → 重新识别冲突」的完整生命周期。
 */
function runPreflight (ctx, items, dir, calls) {
  const dispatch = (type, payload) => {
    calls.push({ type, payload })
    if (type === 'applyTransientName' && payload && payload.item && payload.format) {
      const b = payload.item.basic || (payload.item.basic = {})
      if (!b.transientNameOverride) b.transientNameOverride = {}
      b.transientNameOverride[payload.format] = payload.name
    } else if (type === 'clearTransientNames') {
      items.forEach((it) => { if (it && it.basic) it.basic.transientNameOverride = {} })
    } else if (type === 'setSourceOverwrite' && payload && payload.item) {
      payload.item.basic.overwriteSource = payload.value !== false
    }
  }
  return ctx.preflight({ dispatch, rootState: { items } }, { items, sameOutputPath: dir })
}

async function main () {
  console.log('L1 跨任务同名产物冲突（三选 + 一次性另存生命周期）')

  for (const [platform, paths] of [['macOS', path.posix], ['Windows', path.win32]]) {
    const dir = paths.join('dir')
    const items = pair(paths, dir)

    // ---- 分类：同名跨任务进 crossItem，不再被 seen 吞掉 ----
    {
      const { ctx } = makeCtx(paths)
      const r = ctx.classifyOutputConflicts(items, () => false, dir)
      ok(platform + ' 跨任务同名进 crossItem', r.crossItem.length === 1, r)
      ok(platform + ' 冲突格式是 WEBP', r.crossItem[0] && r.crossItem[0].format === 'WEBP', r.crossItem)
      ok(platform + ' 冲突行挂后一个任务', r.crossItem[0] && r.crossItem[0].item === items[1], r.crossItem)
      ok(platform + ' 撞源仍被识别（任务①的 APNG）', r.source.length === 1, r.source)
      ok(platform + ' crossItem 不误报 existing', r.existing.length === 0, r.existing)

      const noOverride = ctx.classifyOutputConflicts(items, () => false)
      ok(platform + ' 各自目录不同则不报跨任务冲突', noOverride.crossItem.length === 0, noOverride)
    }

    // ---- 改名计划：避开本批次目标 + 磁盘已有 ----
    {
      const { ctx } = makeCtx(paths)
      const r = ctx.classifyOutputConflicts(items, () => false, dir)
      const occupied = ctx.allOutputTargets(items, dir).map((row) => row.path)
      const exists1 = (f) => f === paths.join(dir, 'cool_1.webp')
      const plan = ctx.planCrossItemRename(r.crossItem, occupied, exists1)
      ok(platform + ' 改名避开已存在的 cool_1.webp → cool_2.webp',
        plan.length === 1 && plan[0].file === 'cool_2.webp', plan)
      const plan2 = ctx.planCrossItemRename(r.crossItem, occupied, () => false)
      ok(platform + ' 无占用时改成 cool_1.webp', plan2[0].file === 'cool_1.webp', plan2)
    }

    // ---- 三选：另存为 → 写一次性 transient（不是持久 override）----
    let savedItems
    {
      const { ctx, confirmCalls } = makeCtx(paths, () => false, [true, true])
      ctx.preflight = loadPreflight(ctx)
      const calls = []
      savedItems = pair(paths, dir) // 独立的任务副本，避免污染后续用例
      const allowed = await runPreflight(ctx, savedItems, dir, calls)
      ok(platform + ' 另存：预检放行', allowed === true, { allowed })
      ok(platform + ' 另存：撞源 + 跨任务两次弹窗', confirmCalls.length === 2,
        confirmCalls.map((c) => c.title))
      ok(platform + ' 另存：第二弹窗是跨任务专用文案',
        String(confirmCalls[1].title).indexOf('noticeCrossItemTitle') >= 0, confirmCalls[1])
      const crossOv = calls.filter((c) => c.type === 'applyTransientName' &&
        c.payload.item === savedItems[1] && c.payload.format === 'WEBP')
      ok(platform + ' 另存：只改后一个任务的 WEBP', crossOv.length === 1, calls)
      ok(platform + ' 另存：承诺名 == cool_1.webp 的 stem',
        crossOv.length === 1 && crossOv[0].payload.name === 'cool_1', crossOv)
      ok(platform + ' 另存：不写持久 override（否则下次不再弹窗）',
        !calls.find((c) => c.type === 'applyNameOverride' &&
          c.payload.item === savedItems[1] && c.payload.format === 'WEBP'), calls)
      ok(platform + ' 另存：临时字段已落到任务对象',
        savedItems[1].basic.transientNameOverride && savedItems[1].basic.transientNameOverride.WEBP === 'cool_1',
        savedItems[1].basic)
      // 临时名存在时 outputNameFor 读到 cool_1（processor 深拷贝据此落盘、任务条据此显示）
      ok(platform + ' 临时名生效：outputNameFor → cool_1',
        ctx.outputNameFor(savedItems[1], 'WEBP') === 'cool_1', ctx.outputNameFor(savedItems[1], 'WEBP'))
      ok(platform + ' 预检入口调用了 clearTransientNames',
        !!calls.find((c) => c.type === 'clearTransientNames'), calls)
    }

    // ---- 核心回归：第一次另存后，第二次预检仍重新识别冲突并再次弹窗 ----
    // 二次预检选「取消」（撞源另存 true、跨任务取消 false）：取消不写回临时名，
    // 正好验证入口清除后任务名回落到基础名 cool。
    {
      const { ctx, confirmCalls } = makeCtx(paths, () => false, [true, false])
      ctx.preflight = loadPreflight(ctx)
      const calls = []
      // savedItems 已带第一次另存写入的临时名 cool_1；此刻若不清，跨任务不冲突（bug 表现）
      const beforeClear = ctx.classifyOutputConflicts(savedItems, () => false, dir)
      ok(platform + ' 临时名在时跨任务不冲突（正是旧 bug 的表现）',
        beforeClear.crossItem.length === 0, beforeClear)

      const allowed = await runPreflight(ctx, savedItems, dir, calls) // 入口会清临时名
      ok(platform + ' 二次预检：用户取消 → 不放行', allowed === false, { allowed })
      ok(platform + ' 二次预检：临时名已被清除',
        Object.keys(savedItems[1].basic.transientNameOverride || {}).length === 0,
        savedItems[1].basic.transientNameOverride)
      ok(platform + ' 二次预检：重新弹两次窗（撞源 + 跨任务）',
        confirmCalls.length === 2, confirmCalls.map((c) => c.title))
      ok(platform + ' 二次预检：跨任务弹窗再次出现',
        String(confirmCalls[1].title).indexOf('noticeCrossItemTitle') >= 0, confirmCalls[1])
      ok(platform + ' 二次预检：临时名回落到基础名 cool',
        ctx.outputNameFor(savedItems[1], 'WEBP') === 'cool', ctx.outputNameFor(savedItems[1], 'WEBP'))
    }

    // ---- 三选：直接覆盖 → 放行但不写改名，破坏性按钮回传 altValue ----
    {
      const { ctx, confirmCalls } = makeCtx(paths, () => false, ['overwrite', 'overwrite'])
      ctx.preflight = loadPreflight(ctx)
      const calls = []
      const allowed = await runPreflight(ctx, pair(paths, dir), dir, calls)
      ok(platform + ' 覆盖：预检放行', allowed === true, { allowed })
      ok(platform + ' 覆盖：跨任务弹窗 altValue=overwrite',
        confirmCalls[1] && confirmCalls[1].altValue === 'overwrite', confirmCalls[1])
      ok(platform + ' 覆盖：不写任何改名',
        !calls.find((c) => (c.type === 'applyNameOverride' || c.type === 'applyTransientName') &&
          c.payload.item && c.payload.format === 'WEBP'), calls)
    }

    // ---- 三选：取消 → 放弃启动 ----
    {
      const { ctx } = makeCtx(paths, () => false, [true, false])
      ctx.preflight = loadPreflight(ctx)
      const calls = []
      const allowed = await runPreflight(ctx, pair(paths, dir), dir, calls)
      ok(platform + ' 取消：预检不放行', allowed === false, { allowed })
    }
  }

  // ---- outputNameFor 优先级：临时 > 持久 > 冲突后缀 > 基础名 ----
  {
    const { ctx } = makeCtx(path.posix)
    const item = {
      basic: {
        transientNameOverride: { WEBP: 'transient' },
        outputNameOverride: { WEBP: 'persist' }
      },
      options: { outputName: 'cool', conflictFormat: 'WEBP', outputFormat: ['WEBP'] }
    }
    ok('outputNameFor：临时名优先于持久名', ctx.outputNameFor(item, 'WEBP') === 'transient', ctx.outputNameFor(item, 'WEBP'))
    delete item.basic.transientNameOverride
    ok('outputNameFor：无临时名时回持久名', ctx.outputNameFor(item, 'WEBP') === 'persist', ctx.outputNameFor(item, 'WEBP'))
    delete item.basic.outputNameOverride
    ok('outputNameFor：无覆盖时回冲突后缀', ctx.outputNameFor(item, 'WEBP') === 'cool_webp', ctx.outputNameFor(item, 'WEBP'))
    item.options.conflictFormat = 'APNG'
    ok('outputNameFor：非冲突格式用基础名', ctx.outputNameFor(item, 'WEBP') === 'cool', ctx.outputNameFor(item, 'WEBP'))
  }

  // ---- 静态守卫：吞并重名已移除、预检已接入、临时字段全链路、三语齐全 ----
  const oc = read('src/util/outputConflict.js')
  ok('分类不再 seen[key] = true 吞掉同名', oc.indexOf('seen[key] = true') < 0)
  ok('分类返回 crossItem 类别', oc.indexOf('crossItem: []') >= 0)
  const on = read('src/util/outputName.js')
  ok('outputNameFor 读 transientNameOverride', on.indexOf('transientNameOverride') >= 0)
  const pl = read('src/components/projectList/projectList.vue')
  ok('任务条 outNameOf 读 transientNameOverride', pl.indexOf('transientNameOverride') >= 0)
  const store = read('src/store/index.js')
  ok('预检处理 after.crossItem', store.indexOf('after.crossItem.length') >= 0)
  ok('预检入口清除临时名', store.indexOf("context.dispatch('clearTransientNames')") >= 0)
  ok('跨任务另存走 applyTransientName', store.indexOf("context.dispatch('applyTransientName'") >= 0)
  const mt = read('src/store/mutation-types.js')
  ok('mutation-types 有 ITEMS_APPLY_TRANSIENT_NAME', mt.indexOf('ITEMS_APPLY_TRANSIENT_NAME') >= 0)
  ok('mutation-types 有 ITEMS_CLEAR_TRANSIENT_NAMES', mt.indexOf('ITEMS_CLEAR_TRANSIENT_NAMES') >= 0)
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    const src = read('src/locales/' + loc + '.js')
    for (const key of ['noticeCrossItemTitle', 'noticeCrossItemBody', 'overwriteCrossItem']) {
      ok(loc + ' 缺 key: ' + key, src.indexOf('"' + key + '"') >= 0)
    }
  }

  console.log('\ncross-item conflict L1:', passed, 'passed')
  if (process.exitCode) console.error('存在失败项')
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
