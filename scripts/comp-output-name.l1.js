// Exercise production task creation and refresh without launching the AE host.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const _ = require('lodash')
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
const moduleBody = (file) => read(file)
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/gm, '')
  .replace(/^export /gm, '')
const storeSource = read('src/store/index.js')
const syncStart = storeSource.indexOf('  syncCompTasks(context, payload) {')
const syncEnd = storeSource.indexOf('  /** 合成树勾选', syncStart)
assert(syncStart >= 0 && syncEnd > syncStart)
const failures = []
let count = 0
function check (name, fn) {
  try { fn(); count++ } catch (error) { failures.push(name + ': ' + error.message) }
}
for (const [platform, paths, projectPath] of [
  ['macOS', path.posix, '/Users/editor/广告工程.aep'],
  ['Windows', path.win32, 'C:\\作品\\广告工程.aep']
]) {
  const globals = { options: { outputName: '广告工程', outputSuffix: '', outputTo: { mode: 'beside' } } }
  const saved = {}
  const storage = { getItem: (key) => key === 'globalSetting' ? JSON.stringify(globals) : saved[key] }
  const state = { items: [] }
  const context = vm.createContext({ _, path: paths, npath: paths, window: { storage }, storage, state,
    hostAdapter: { supportsCompImport: true }, registerHostSource: () => {}, persistItems: () => {}, console })
  for (const file of ['src/util/tokenizeName.js', 'src/util/outputPath.js', 'src/util/outputName.js', 'src/util/outputConflict.js', 'src/cep/comp-source.js']) {
    vm.runInContext(moduleBody(file), context, { filename: file })
  }
  vm.runInContext('this.sync = ({' + storeSource.slice(syncStart, syncEnd) + '}).syncCompTasks', context)
  const comp = (name, overrides, index = 1) => context.toCompItem({ name, index, projectPath, fps: 25, frames: 10 }, overrides)
  const refresh = (previous, next, cached = false) => {
    state.items = cached ? [] : [previous]
    saved['iSparta-item'] = JSON.stringify(cached ? [previous] : [])
    context.sync({ rootState: state }, { items: [next] })
    return state.items[0]
  }
  check(platform + ' global name cannot override composition names', () => {
    for (const name of ['开场动画', '结束动画']) assert.strictEqual(comp(name).options.outputName, name)
  })
  check(platform + ' beside directory stays at project parent', () => {
    assert.strictEqual(comp('开场动画').basic.outputPath, paths.dirname(projectPath))
  })
  check(platform + ' explicit name survives', () => {
    assert.strictEqual(comp('开场动画', { outputName: '客户定稿' }).options.outputName, '客户定稿')
  })
  check(platform + ' empty override and suffix use composition name', () => {
    assert.strictEqual(comp('开场 动画', { outputName: '', outputSuffix: 'final' }).options.outputName, '开场动画_final')
  })
  // The next checks start from valid defaults, independently of polluted global settings.
  globals.options.outputName = ''
  for (const cached of [false, true]) {
    check(platform + ' automatic name follows rename; cached=' + cached, () => {
      const previous = comp('旧合成', { outputSuffix: 'final' })
      const current = refresh(previous, comp('新合成'), cached)
      assert.strictEqual(current.options.outputName, '新合成_final')
      assert.strictEqual(current.basic.outputPath, paths.dirname(projectPath))
    })
    check(platform + ' custom name survives rename; cached=' + cached, () => {
      const current = refresh(comp('旧合成', { outputName: '客户定稿' }), comp('新合成'), cached)
      assert.strictEqual(current.options.outputName, '客户定稿')
    })
    check(platform + ' unchanged custom name survives refresh; cached=' + cached, () => {
      const current = refresh(comp('开场动画', { outputName: '广告工程' }), comp('开场动画'), cached)
      assert.strictEqual(current.options.outputName, '广告工程')
    })
  }

  // ---- 防覆盖：后缀反解 / 碰撞判定 / 落盘保底 / 预检分类 ----
  check(platform + ' suffix resolve/apply is idempotent', () => {
    assert.strictEqual(context.resolveSuffixState('cool_apng', 'APNG'), 'APNG')
    assert.strictEqual(context.resolveSuffixState('cool_APNG', ['GIF', 'APNG']), 'APNG')
    assert.strictEqual(context.resolveSuffixState('cool', ['APNG']), '')
    assert.strictEqual(context.applySuffix('cool', 'apng', true), 'cool_apng')
    assert.strictEqual(context.applySuffix('cool_apng', 'apng', true), 'cool_apng')
    assert.strictEqual(context.applySuffix('cool_apng', 'apng', false), 'cool')
  })
  const dir = paths.join('dir')
  const src = paths.join(dir, 'cool.png')
  check(platform + ' source collision detected for matching format', () => {
    assert.strictEqual(context.detectSourceCollision(src, dir, 'cool', ['APNG', 'GIF', 'WEBP']), 'APNG')
    assert.strictEqual(context.detectSourceCollision(src, dir, 'cool', ['GIF', 'WEBP']), '')
  })
  check(platform + ' fallback rename appends _1 before extension', () => {
    assert.strictEqual(context.fallbackRenameForSource(src, [src]), paths.join(dir, 'cool_1.png'))
    assert.strictEqual(context.fallbackRenameForSource(paths.join(dir, 'out.png'), [src]), paths.join(dir, 'out.png'))
  })
  check(platform + ' preflight classifies source vs existing output', () => {
    const sourceHit = [{
      basic: { outputPath: dir, fileList: [src] },
      options: { outputName: 'cool', outputFormat: ['APNG'] }
    }]
    const a = context.classifyOutputConflicts(sourceHit, () => false)
    assert.strictEqual(a.source.length, 1)
    assert.strictEqual(a.existing.length, 0)
    const existingHit = [{
      basic: { outputPath: dir, fileList: [paths.join(dir, 'other.png')] },
      options: { outputName: 'cool', outputFormat: ['APNG'] }
    }]
    const b = context.classifyOutputConflicts(existingHit, () => true)
    assert.strictEqual(b.source.length, 0)
    assert.strictEqual(b.existing.length, 1)
  })
  // ---- 冲突后缀只作用于撞源的那一个格式，其余格式保持基础名 ----
  check(platform + ' conflict suffix applies only to the conflicting format', () => {
    const item = {
      basic: { outputPath: dir, fileList: [src] },
      options: { outputName: 'cool', conflictFormat: 'APNG', outputFormat: ['APNG', 'GIF', 'WEBP'] }
    }
    assert.strictEqual(context.outputNameFor(item, 'APNG'), 'cool_apng')
    assert.strictEqual(context.outputNameFor(item, 'GIF'), 'cool')
    assert.strictEqual(context.outputNameFor(item, 'WEBP'), 'cool')
    // 大小写不敏感
    assert.strictEqual(context.outputNameFor(item, 'apng'), 'cool_apng')
  })
  check(platform + ' conflictFormat from GIF collision adds suffix to GIF only', () => {
    const gifSrc = paths.join(dir, 'cool.gif')
    const hit = context.detectSourceCollision(gifSrc, dir, 'cool', ['APNG', 'GIF', 'WEBP'])
    assert.strictEqual(hit, 'GIF')
    const item = { basic: { outputPath: dir }, options: { outputName: 'cool', conflictFormat: hit, outputFormat: ['APNG', 'GIF', 'WEBP'] } }
    assert.strictEqual(context.outputNameFor(item, 'GIF'), 'cool_gif')
    assert.strictEqual(context.outputNameFor(item, 'APNG'), 'cool')
  })
  check(platform + ' no conflict format keeps plain names for all formats', () => {
    const item = { basic: { outputPath: dir }, options: { outputName: 'cool', conflictFormat: '', outputFormat: ['APNG', 'GIF', 'WEBP'] } }
    assert.strictEqual(context.outputNameFor(item, 'APNG'), 'cool')
    assert.strictEqual(context.outputNameFor(item, 'GIF'), 'cool')
    assert.strictEqual(context.outputNameFor(item, 'WEBP'), 'cool')
  })
  check(platform + ' fallback override is per-format only', () => {
    const item = {
      basic: { outputPath: dir, outputNameOverride: { APNG: 'cool_1' } },
      options: { outputName: 'cool', conflictFormat: 'APNG', outputFormat: ['APNG', 'GIF'] }
    }
    assert.strictEqual(context.outputNameFor(item, 'APNG'), 'cool_1')
    assert.strictEqual(context.outputNameFor(item, 'GIF'), 'cool')
  })
  // ---- 输入框动态显示：开关开→显示带后缀名；手输带后缀→反解回基础名 ----
  check(platform + ' display name adds suffix only when enabled', () => {
    const item = {
      basic: { outputPath: dir },
      options: { outputName: 'cool', conflictFormat: 'APNG', suffixEnabled: true, outputFormat: ['APNG', 'GIF'] }
    }
    assert.strictEqual(context.displayNameOf(item), 'cool_apng')
    item.options.suffixEnabled = false
    assert.strictEqual(context.displayNameOf(item), 'cool')
    // 落盘也随之变化：关掉后 APNG 也不再加后缀
    assert.strictEqual(context.outputNameFor(item, 'APNG'), 'cool')
  })
  check(platform + ' stripConflictSuffix restores base name', () => {
    assert.strictEqual(context.stripConflictSuffix('cool_apng', 'APNG'), 'cool')
    assert.strictEqual(context.stripConflictSuffix('cool_APNG', 'apng'), 'cool')
    assert.strictEqual(context.stripConflictSuffix('cool_final', 'APNG'), 'cool_final')
    assert.strictEqual(context.stripConflictSuffix('cool_apng', ''), 'cool_apng')
  })
  check(platform + ' no-conflict task shows plain name regardless of switch', () => {
    const item = { basic: { outputPath: dir }, options: { outputName: 'cool', conflictFormat: '', suffixEnabled: true } }
    assert.strictEqual(context.displayNameOf(item), 'cool')
    assert.strictEqual(context.suffixEnabledOf(item), true)
    // 旧任务未带 suffixEnabled 字段也视为启用
    delete item.options.suffixEnabled
    assert.strictEqual(context.suffixEnabledOf(item), true)
  })
  check(platform + ' classify uses conflict suffix only on conflicting format', () => {
    // 撞源的是 APNG → cool_apng.png，不再是源 cool.png → 不应判为 source 冲突
    const item = [{
      basic: { outputPath: dir, fileList: [src] },
      options: { outputName: 'cool', conflictFormat: 'APNG', outputFormat: ['APNG', 'GIF', 'WEBP'] }
    }]
    const result = context.classifyOutputConflicts(item, () => false)
    assert.strictEqual(result.source.length, 0)
  })
}

check('store preflight action uses confirm + warning', () => {
  const store = read('src/store/index.js')
  const start = store.indexOf('  async preflightOutputs (context, items) {')
  assert(start >= 0)
  const body = store.slice(start, store.indexOf('\n  },', start))
  assert(/notice\.confirm/.test(body) && /notice\.warning/.test(body))
  assert(/classifyOutputConflicts/.test(body))
})
check('both start entries wait for preflight', () => {
  const sortBar = read('src/components/sortBar/sortBar.vue')
  const setting = read('src/components/setting/setting.vue')
  assert(/dispatch\('preflightOutputs', selected\)/.test(sortBar))
  assert(/dispatch\('preflightOutputs', this\.selectedList\)/.test(setting))
})
check('setting shows suffix toggle in name row with dynamic display binding', () => {
  const setting = read('src/components/setting/setting.vue')
  assert(!/toggleOutputSuffix/.test(setting))
  assert(!/suffix-tokens/.test(setting))
  assert(!/suffix-hint/.test(setting))
  // 开关按钮在 name-row 内、过滤按钮右侧，hover 提示挂开关上
  assert(/name-row__suffix/.test(setting))
  assert(/v-tip="suffixTip"/.test(setting))
  assert(/toggleAutoSuffix/.test(setting))
  // 输入框绑定 displayName（带后缀），手输经 stripConflictSuffix 反解
  assert(/v-model="displayName"/.test(setting))
  assert(/stripConflictSuffix\(value/.test(setting))
  assert(/displayNameOf\(/.test(setting))
  // 多选同样有开关 + 动态显示
  assert(/multiDisplayName\(i\)/.test(setting))
  assert(/toggleMultiSuffix\(i\)/.test(setting))
  assert(!/resolveSuffixState/.test(setting))
  // 任务条底行输出名必须与输入框同一口径（displayNameOf），否则输入框 cool_apng / 任务条 cool
  const list = read('src/components/projectList/projectList.vue')
  assert(/import \{ displayNameOf \}/.test(list))
  assert(/outNameOf \(project\)[\s\S]{0,200}displayNameOf\(project\)/.test(list))
  // 任务条显示口径：左侧原文件名/序列帧胶囊、第一行输入路径、第三行真实路径↔变量 hover 切换
  // 序列帧判定抽成 isSeqLike，模板据此渲染胶囊（不能把标识塞进 sourceNameOf 当文件名）
  assert(/isSeqLike \(project\)/.test(list))
  assert(!/sourceNameOf \(project\)[\s\S]{0,200}seqFrameMark/.test(list))
  assert(/class="seq-chip">\{\{ \$t\('seqFrameMark'\) \}\}</.test(list))
  assert(/showOutPath && isSeqLike\(project\)/.test(list))
  // 胶囊样式：圆角 chip + 语义色，区别于纯文本文件名（CEP 的 .sum--tpl 隐藏规则不受影响）
  const listScss = read('src/components/projectList/projectList.scss')
  assert(/\.seq-chip/.test(listScss))
  assert(/border-radius:\s*999px/.test(listScss))
  // CEP 兼容：非序列帧时桌面走 sourceNameOf、CEP 保留 displayTitleOf（合成名）
  assert(/showOutPath \? sourceNameOf\(project\) : displayTitleOf\(project, index\)/.test(list))
  assert(/inputLabelOf \(project\)/.test(list))
  assert(/\{\{ inputLabelOf\(project\) \}\}/.test(list))
  // 第一行路径 hover 全文必须显示输入源路径，不能误写成「修改输出目录 + 输出路径」
  assert(/inputFullPathOf \(project\)/.test(list))
  assert(/v-tip="\$t\('tipInputDir'\) \+ '：' \+ inputFullPathOf\(project\)"/.test(list))
  assert(!/tipChangeOutput/.test(list))
  assert(/class="tpl-real is-ellipsis"[\s\S]{0,120}outPathOf\(project\)/.test(list))
  assert(/class="tpl-var is-ellipsis"[\s\S]{0,120}outTplOf\(project\)/.test(list))
  // 详情气泡挂整个任务条，不再挂名字
  assert(/class="item"[\s\S]{0,220}v-tip="titleTipOf\(project\)"/.test(list))
  assert(!/item-title is-ellipsis" v-tip/.test(list))
  // 三语文案齐，且值是纯标识（无连字符/空格前缀），前缀由调用方决定是否拼接
  const markValues = {}
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    const src = read('src/locales/' + loc + '.js')
    const m = src.match(/"seqFrameMark"\s*:\s*"([^"]*)"/)
    assert(m, loc + ' missing seqFrameMark')
    assert(!/^[\s\-—–・]/.test(m[1]), loc + ' seqFrameMark must be pure mark, got: ' + m[1])
    markValues[loc] = m[1]
  }
  assert(markValues['zh-cn'] === '序列帧', 'zh-cn seqFrameMark')
  assert(markValues['zh-tw'] === '序列幀', 'zh-tw seqFrameMark')
  assert(markValues['en-us'] === 'Sequence', 'en-us seqFrameMark')
})
check('all output paths resolve names through outputNameFor', () => {
  for (const file of [
    'src/util/processor/index.js',
    'src/util/processor/sizeGate.js',
    'src/util/task-output.js',
    'src/util/outputConflict.js'
  ]) {
    assert(/outputNameFor\(/.test(read(file)), file + ' must resolve names via outputNameFor')
  }
  const proc = read('src/util/processor/index.js')
  assert.strictEqual((proc.match(/safeTarget\(path\.join\(item\.basic\.outputPath/g) || []).length, 3)
  // 落盘保底改名只写 per-format 覆盖表，不污染共享 outputName
  assert(/outputNameOverride\[/.test(proc))
  assert(!/item\.options\.outputName = path\.basename\(renamed/.test(proc))
})
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('comp output name L1 OK (' + count + ' checks)')
}
