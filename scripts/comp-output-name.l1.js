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
  assert(/class="seq-chip"[\s\S]{0,120}seqFrameMark/.test(list))
  assert(/showOutPath && isSeqLike\(project\)/.test(list))
  // 文件名胶囊：普通文件也胶囊化（image 图标），序列帧用 film 图标，同一视觉语言
  assert(/class="name-chip"[\s\S]{0,180}sourceNameOf\(project\)/.test(list),
    'plain file name must be wrapped in a name chip')
  assert(/<is-icon name="film" size="xs" \/>/.test(list), 'seq chip must carry film icon')
  assert(/<is-icon name="image" size="xs" \/>/.test(list), 'name chip must carry image icon')
  // 胶囊样式：圆角 chip + 语义色（CEP 的 .sum--tpl 隐藏规则不受影响）
  const listScss = read('src/components/projectList/projectList.scss')
  assert(/\.seq-chip/.test(listScss))
  assert(/\.seq-chip,\s*\n\s*\.name-chip/.test(listScss),
    'seq chip and name chip must share one capsule shape')
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
  // 信息已完整显示，整条任务条不再挂详情气泡（CEP 路径 span 上的局部 tip 不受影响）
  assert(!/class="item"[\s\S]{0,220}v-tip="titleTipOf\(project\)"/.test(list))
  assert(!/data-tip-owner/.test(list))
  assert(/class="outpath outpath--static is-ellipsis"[\s\S]{0,80}v-tip="titleTipOf\(project\)"/.test(list),
    'CEP path span must keep its local titleTipOf tip')
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
check('first-row source size badge shares sourceSizeText with estimate hover (CEP shows estimate)', () => {
  const list = read('src/components/projectList/projectList.vue')
  const scss = read('src/components/projectList/projectList.scss')
  const quality = read('src/util/qualityEstimate.js')
  const tip = read('src/util/estimateTipBlocks.js')
  // 两处（任务条源体积胶囊 + 预估角标 hover 的源大小）共用同一个文案函数
  assert(/export function sourceSizeText \(e\)/.test(quality), 'qualityEstimate must export sourceSizeText')
  assert(/estimated \? '≈' : ''/.test(quality) && /humanSize\(e\.sourceBytes\)/.test(quality),
    'sourceSizeText must prefix estimated source with ≈ and format via humanSize')
  assert(/humanSize, sourceSizeText/.test(tip) && /value: sourceSizeText\(e\)/.test(tip),
    'estimate hover source metric must use shared sourceSizeText')
  assert(/formatLetter, pickEstDetail, sourceSizeText/.test(list),
    'projectList must import shared sourceSizeText')
  // 源体积直接复用预估结果（sourceOf 单文件 statSize / 序列逐帧求和 / CEP 合成估算），不额外打盘
  assert(/sourceSizeOf \(project\) \{\s*\n\s*return sourceSizeText\(this\.estimateOf\(project\)\)/.test(list),
    'sourceSizeOf must delegate to sourceSizeText with the lazy estimate')
  // CEP 也显示：sourceSizeOf 不得按 showOutPath 短路（估算值由 sourceSizeText 前置 ≈ 说明）
  const sizeMethod = list.slice(list.indexOf('sourceSizeOf (project)'), list.indexOf('sourceSizeOf (project)') + 220)
  assert(!/showOutPath/.test(sizeMethod),
    'source size badge must NOT short-circuit on CEP (sourceOf estimates from comp size/frames)')
  // 模板：第一行渲染角标（含 hover）
  assert(/class="src-size" v-tip="srcSizeTipOf\(project\)">\{\{ sourceSizeOf\(project\) \}\}</.test(list),
    'first row must render src-size badge with shared hover tip')
  // 第一行顺序：输入目录(outpath) → 文件名(item-title) → 大小(src-size)，三者紧凑并排不右对齐。
  // 用 item-headrow 片段内的先后位置锁定（路径的 button 结束 </button> / </span> 早于 item-title，早于 src-size）
  const headrow = list.slice(list.indexOf('<div class="item-headrow">'), list.indexOf('<!-- 状态独立第二行'))
  const posPath = headrow.indexOf('class="outpath')
  const posTitle = headrow.indexOf('class="item-title"')
  const posSize = headrow.indexOf('class="src-size"')
  assert(posPath >= 0 && posTitle > posPath && posSize > posTitle,
    'first row order must be path -> title -> size (not right-aligned)')
  // 第三行（summary--out）：输出路径(sum--tpl) 在左、输出名(sum--name) 在右
  const outRow = list.slice(list.indexOf('<div v-if="showOutPath" class="summary summary--out">'))
  const posOutTpl = outRow.indexOf('class="sum sum--tpl')
  const posOutName = outRow.indexOf('class="sum sum--name')
  assert(posOutTpl >= 0 && posOutName > posOutTpl,
    'third row order must be output path (left) -> output name (right)')
  // outpath 不再 flex:1 撑满（否则会把大小推向最右），改为按内容收缩
  const outpathBlock = scss.slice(scss.indexOf('.outpath {'), scss.indexOf('.outpath {') + 260)
  assert(/flex: 0 1 auto/.test(outpathBlock), 'outpath must not flex:1 (would push size to far right)')
  // 样式：胶囊形态（18px pill + 描边底色）、不挤压、数字等宽、小字
  const srcBlock = scss.slice(scss.indexOf('.src-size {'))
  assert(/\.src-size \{[\s\S]{0,200}flex: none/.test(scss), 'src-size must not squeeze siblings')
  assert(/height:\s*18px/.test(srcBlock.slice(0, 240)), 'src-size capsule must match chip height 18px')
  assert(/border-radius:\s*999px/.test(srcBlock.slice(0, 240)), 'src-size must be a pill capsule')
  assert(/font-variant-numeric:\s*tabular-nums/.test(srcBlock), 'src-size digits must align')
  // 底层：sourceOf 单文件直接 statSize、序列逐帧求和（角标口径的正确性根基）
  assert(/b && b\.sourceFile[\s\S]{0,120}fs\.statSize\(f\)/.test(list), 'sourceOf must statSize single source file')
  assert(/for \(let i = 0; i < list\.length; i\+\+\)[\s\S]{0,160}fs\.statSize\(list\[i\]\)[\s\S]{0,80}sum \+= n/.test(list),
    'sourceOf must sum all sequence frames')
})
check('first-row name & size chips carry hover tips sharing the display value (both hosts)', () => {
  const list = read('src/components/projectList/projectList.vue')
  // 三种胶囊都挂 hover：seq-chip / name-chip → nameTipOf，src-size → srcSizeTipOf
  assert(/class="seq-chip" v-tip="nameTipOf\(project, index\)"/.test(list), 'seq-chip must have name hover tip')
  assert(/class="name-chip" v-tip="nameTipOf\(project, index\)"/.test(list), 'name-chip must have name hover tip')
  assert(/class="src-size" v-tip="srcSizeTipOf\(project\)"/.test(list), 'src-size must have size hover tip')
  // 名字 hover 与胶囊显示同源：showOutPath 分流后仍走 sourceNameOf / displayTitleOf
  assert(/nameTipOf \(project, index\) \{[\s\S]{0,200}this\.showOutPath \? this\.sourceNameOf\(project\) : this\.displayTitleOf\(project, index\)/.test(list),
    'name hover must reuse the same name source as the chip (desktop/CEP split)')
  assert(/nameTipOf[\s\S]{0,160}tipOf\('sourceFileName', name\)/.test(list),
    'name hover must use the shared tipOf plain-text bubble')
  // 大小 hover 直接复用 sourceSizeOf（同一个 sourceSizeText 变量），不另算数值
  assert(/srcSizeTipOf \(project\) \{[\s\S]{0,200}var size = this\.sourceSizeOf\(project\)/.test(list),
    'size hover must reuse sourceSizeOf value, not recompute')
  assert(/e && e\.estimated \? this\.\$t\('srcSizeBasisEstimated'\) : this\.\$t\('srcSizeBasisActual'\)/.test(list),
    'size hover must append estimated/actual basis by estimate flag (no host check)')
  // 三语 key 齐
  for (const f of ['zh-cn', 'zh-tw', 'en-us']) {
    const loc = read('src/locales/' + f + '.js')
    for (const k of ['sourceFileName', 'srcSizeBasisActual', 'srcSizeBasisEstimated']) {
      assert(new RegExp('"' + k + '"\\s*:').test(loc), f + ' missing i18n key ' + k)
    }
  }
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
check('compare dialog resolves real output files, not output dir', () => {
  const cmp = read('src/components/compareDialog/index.vue')
  // 必须走统一产物口径，不能直读 basic.outputPath（目录）去 readDataUrl
  assert(/import \{ outputFilesOf \} from '..\/..\/util\/task-output'/.test(cmp))
  assert(/outFile \(\)[\s\S]{0,200}outputFilesOf\(this\.project\)/.test(cmp))
  assert(/this\.afterSrc = this\.readUrl\(this\.outFile\)/.test(cmp))
  assert(!/readUrl\(this\.outPath\)/.test(cmp))
})
check('duration uses frame delays first, never 0s for single animated file', () => {
  const list = read('src/components/projectList/projectList.vue')
  assert(/durationOf \(project\)[\s\S]{0,400}opts\.delays/.test(list))
  assert(/if \(!\(sec > 0\)\) return ''/.test(list), 'no misleading 0s badge')
  assert(/var rounded = Math\.round\(sec \* 10\) \/ 10[\s\S]{0,60}if \(!\(rounded > 0\)\) return ''/.test(list), 'sub-0.05s hides badge')
  // frameCount 优先 basic.frameCount（导入解析的真实帧数），不再固定 fileList.length=1
  assert(/frameCount \(project\)[\s\S]{0,200}basic\.frameCount/.test(list))
  // 导入时解析 APNG/GIF 元数据并写入
  const file = read('src/components/drag/file.js')
  assert(/import \{ parseAnimationMeta \}/.test(file))
  assert(/parseAnimationMeta\('APNG', buffer\)/.test(file))
  assert(/parseAnimationMeta\('GIF', fs\.readFileSync\(files\)\)/.test(file))
  assert(/temp\.basic\.frameCount = animMeta\.frameCount/.test(file))
  assert(/temp\.options\.delays = animMeta\.delays/.test(file))
})
check('item-bar is an inset pill track with real shimmer and softened done state', () => {
  const scss = read('src/components/projectList/projectList.scss')
  const bar = scss.slice(scss.indexOf('.item-bar {'), scss.indexOf('.item-bar__fill {'))
  assert(/left: var\(--is-s-3\)/.test(bar) && /right: var\(--is-s-3\)/.test(bar), 'item-bar must inset to content gutter (s-3)')
  assert(/bottom: 4px/.test(bar), 'track sits inside bottom padding, not flush to card edge')
  assert(/border-radius: var\(--is-r-pill\)/.test(bar), 'track must be pill, not bottom-edge line')
  assert(/background: var\(--is-track\)/.test(bar), 'track needs a low-contrast rail')
  const fill = scss.slice(scss.indexOf('.item-bar__fill {'), scss.indexOf('.item-bar.is-pending'))
  assert(/border-radius: var\(--is-r-pill\)/.test(fill), 'fill must be rounded')
  // 流光动画此前挂在死代码 .progress 上从未生效，现在必须真正接到 item-bar running 态
  assert(/\.item-bar\.is-running \.item-bar__fill\.is-shimmer::after/.test(scss), 'shimmer must be wired to item-bar running fill')
  assert(/animation: is-shimmer/.test(scss), 'shimmer animation must be applied')
  // 完成/失败降饱和，不再满格亮实线
  assert(/is-done \.item-bar__fill \{\s*background: rgba\(var\(--is-ok-rgb\)/.test(scss), 'done fill must be softened')
  assert(/is-fail \.item-bar__fill \{\s*background: rgba\(var\(--is-bad-rgb\)/.test(scss), 'fail fill must be softened')
})
check('animationMeta parses real APNG/GIF frame count and delays', () => {
  // 真实执行工具模块：构造最小 APNG(acTL+2×fcTL) 与 GIF(2 帧 GCE) 字节流
  const src = read('src/util/animationMeta.js')
  const sandbox = { exports: {}, module: { exports: {} } }
  vm.runInNewContext(src.replace(/^export /gm, ''), sandbox)
  // APNG: 签名 + acTL(num_frames=2) + 2 个 fcTL(delay 5/100, 10/100) + IEND
  const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  const chunk = (type, data) => [...u32(data.length), ...Array.from(Buffer.from(type)), ...data, 0, 0, 0, 0]
  const apng = Buffer.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    ...chunk('acTL', [...u32(2), 0, 0, 0, 0]),
    ...chunk('fcTL', [...u32(0), 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 100, 0, 0]),
    ...chunk('fcTL', [...u32(1), 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 100, 0, 0]),
    ...chunk('IEND', [])
  ])
  const a = sandbox.parseApngMeta(apng)
  assert(a && a.frameCount === 2, 'APNG frame count')
  assert(Math.abs(a.duration - 0.15) < 1e-9, 'APNG duration 0.15s, got ' + (a && a.duration))
  // GIF: 89a + 2 帧（GCE delay 5 与 10 -> 0.05/0.10）
  const gif = Buffer.from([
    71, 73, 70, 56, 57, 97, 1, 0, 1, 0, 0, 0, 0,
    0x21, 0xf9, 0x04, 0, 5, 0, 0, 0,
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0,
    0x21, 0xf9, 0x04, 0, 10, 0, 0, 0,
    0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 2, 0x44, 0x01, 0,
    0x3b
  ])
  const g = sandbox.parseGifMeta(gif)
  assert(g && g.frameCount === 2, 'GIF frame count, got ' + (g && g.frameCount))
  assert(Math.abs(g.duration - 0.15) < 1e-9, 'GIF duration 0.15s, got ' + (g && g.duration))
  assert(sandbox.parseApngMeta(Buffer.from('not a png')) === null, 'non-apng safe null')
})
check('compare slider overlays both images and caps height', () => {
  const cmp = read('src/ui-next/components/IsCompareSlider.vue')
  assert(/height: min\(46vh, 420px\)/.test(cmp), 'slider height must be capped, not image-stacked')
  const pair = cmp.slice(cmp.indexOf('&__before,'), cmp.indexOf('&__divider'))
  assert(/position: absolute/.test(pair) && /inset: 0/.test(pair), 'both images must be absolutely overlaid')
  assert(/object-fit: contain/.test(pair), 'images must scale without distortion')
})
check('compare divider draggable via split, clip on non-transformed scene layer', () => {
  const cmp = read('src/ui-next/components/IsCompareSlider.vue')
  // 分隔线可拖：位置与裁剪都读同一个 split（容器百分比），二者永远重合
  assert(/split: 50/.test(cmp), 'must have split state (container percent)')
  assert(/class="is-cmp__divider" :style="dividerStyle"/.test(cmp), 'divider position must bind to split')
  assert(/dividerStyle \(\) \{\s*\n\s*return \{ left: this\.split \+ '%' \}/.test(cmp), 'dividerStyle must derive from split')
  assert(/beforeClipStyle \(\) \{\s*\n\s*return \{ clipPath: 'inset\(0 ' \+ \(100 - this\.split\)/.test(cmp), 'before clip must derive from split')
  assert(/class="is-cmp__scene is-cmp__scene--before" :style="beforeClipStyle"/.test(cmp), 'before scene must bind split clip')
  // 裁剪放在不参与 transform 的 scene 层，才不会随图片平移跑偏
  const scene = cmp.slice(cmp.indexOf('&__scene {'), cmp.indexOf('&__canvas {'))
  assert(/pointer-events: none/.test(scene), 'scene layers must not capture pointer')
  assert(!/&--before \{ clip-path/.test(scene), 'no hardcoded clip on scene (split inline overrides)')
  // 拖拽分流：靠近线拖 split（不动画布），其余平移；按容器坐标命中，与 transform 无关
  assert(/dragMode = nearLine \? 'split' : 'pan'/.test(cmp), 'drag must branch by proximity to divider')
  assert(/var lineX = rect\.left \+ rect\.width \* this\.split \/ 100/.test(cmp), 'hit test must use container coords, not transformed canvas')
  assert(/this\.dragMode === 'split'/.test(cmp), 'split-drag branch must exist')
  assert(/Math\.max\(0, Math\.min\(100, this\.panStart\.split \+ delta\)\)/.test(cmp), 'split clamped 0..100')
  // 拖线时只改 split，pan 分支仍改 tx/ty：拖线分支里 return 提前退出、不动 tx/ty
  const move = cmp.slice(cmp.indexOf('onMove (e) {'), cmp.indexOf('onUp (e) {'))
  const splitBranch = move.slice(move.indexOf("this.dragMode === 'split'"), move.indexOf('this.tx = this.panStart.tx'))
  assert(!/this\.tx\s*=/.test(splitBranch) && !/this\.ty\s*=/.test(splitBranch), 'split-drag must NOT pan canvas')
  // 双击/复位把 split 归位中线
  assert(/resetView \(\) \{[\s\S]*?this\.split = 50/.test(cmp), 'reset must restore split to 50')
})
check('compare slider captures pointer so drag cannot select background cards', () => {
  const cmp = read('src/ui-next/components/IsCompareSlider.vue')
  assert(/@pointerdown\.stop="onDown"/.test(cmp), 'pointerdown must stop propagation')
  assert(/setPointerCapture\(e\.pointerId\)/.test(cmp), 'must capture pointer during drag')
  assert(/releasePointerCapture\(e\.pointerId\)/.test(cmp), 'must release pointer on up')
  assert(!/@mouseleave="onUp"/.test(cmp), 'mouseleave early-stop removed (caused out-of-dialog drop)')
})
check('compare slider canvas zoom/pan/background controls', () => {
  const cmp = read('src/ui-next/components/IsCompareSlider.vue')
  // 两图各有 canvas 层，共用同一 canvasStyle 同步缩放/平移
  assert((cmp.match(/class="is-cmp__canvas" :style="canvasStyle"/g) || []).length === 2, 'both images need one canvas each sharing canvasStyle')
  assert(/transform-origin: center center/.test(cmp), 'canvas must scale from center')
  assert(/translate\(' \+ this\.tx/.test(cmp) && /scale\(' \+ this\.scale/.test(cmp), 'canvasStyle must apply pan+zoom')
  // 缩放以指针为锚点，钳制范围
  assert(/MIN_SCALE = 0\.5/.test(cmp) && /MAX_SCALE = 5/.test(cmp), 'zoom must be clamped')
  assert(/zoomAt\(/.test(cmp) && /cx = \(clientX/.test(cmp), 'wheel zoom must anchor at pointer')
  // 双击 / 复位按钮都恢复默认大小与位置
  assert(/resetView \(\) \{[\s\S]*?this\.scale = 1[\s\S]*?this\.tx = 0[\s\S]*?this\.ty = 0/.test(cmp), 'reset must restore scale+pan')
  assert(/onDblClick \(\) \{ this\.resetView\(\) \}/.test(cmp), 'double-click must reset view')
  // 背景色循环 + 胶囊标签（图标，非纯文本方块）
  assert(/cycleBg \(\)/.test(cmp) && /is-cmp--bg-/.test(cmp), 'background cycle must be wired')
  assert(/is-cmp__tag--before[\s\S]*?is-icon/.test(cmp), 'tags must carry icons, not plain text chips')
  // 三语 key 齐
  for (const f of ['zh-cn', 'zh-tw', 'en-us']) {
    const loc = read('src/locales/' + f + '.js')
    for (const k of ['cmpZoomIn', 'cmpZoomOut', 'cmpResetView', 'cmpBg']) {
      assert(loc.includes('"' + k + '"'), f + ' missing ' + k)
    }
  }
})
check('compare slider replay resyncs both animated images', () => {
  const cmp = read('src/ui-next/components/IsCompareSlider.vue')
  assert(/srcBefore: this\.before/.test(cmp) && /srcAfter: this\.after/.test(cmp), 'srcs must be component-managed')
  const replay = cmp.slice(cmp.indexOf('replay () {'), cmp.indexOf('replay () {') + 320)
  assert(/this\.srcBefore = ''/.test(replay) && /this\.srcAfter = ''/.test(replay), 'replay clears both')
  assert(/vm\.srcBefore = b/.test(replay) && /vm\.srcAfter = a/.test(replay), 'replay restores both in same tick')
  const dlg = read('src/components/compareDialog/index.vue')
  // replay 按钮已在 footer 外壳，与画布是兄弟节点，不必再 .stop 阻止冒泡到画布
  assert(/@click(?:\.stop)?="replay"/.test(dlg) && /\$refs\.slider/.test(dlg), 'dialog must wire replay button')
  for (const loc of ['zh-cn', 'zh-tw', 'en-us']) {
    assert(/compareReplay/.test(read('src/locales/' + loc + '.js')), loc + ' missing compareReplay')
  }
})
check('dialog teleports to body so its events never reach host list (marquee leak)', () => {
  const dlg = read('src/ui-next/components/ui/IsDialog.vue')
  // 模态框提升到 body，与 .mod-list 脱离父子关系，从根上断开冒泡链
  assert(/toBody: \{ type: Boolean, default: true \}/.test(dlg), 'dialog must default to teleport-to-body')
  assert(/teleportToBody \(\) \{/.test(dlg), 'dialog must have teleportToBody method')
  assert(/el\.parentNode !== document\.body/.test(dlg) && /document\.body\.appendChild\(el\)/.test(dlg),
    'teleport must append root node to document.body')
  assert(/this\.teleportToBody\(\)/.test(dlg), 'open must call teleport after render')
  // 背景列表侧不得残留针对弹窗的 .stop/.is-dialog 特判（teleport 后多余）
  const pl = read('src/components/projectList/projectList.vue')
  assert(!/isFromDialog/.test(pl), 'background must not need dialog-source guards after teleport')
})
check('compare dialog resyncs animations on open', () => {
  const dlg = read('src/components/compareDialog/index.vue')
  assert(/mounted \(\)[\s\S]{0,400}\$nextTick[\s\S]{0,80}vm\.replay\(\)/.test(dlg), 'must auto-replay on open')
})
check('dialog body blocks scroll chaining to background list', () => {
  const ui = read('src/ui-next/styles/ui.scss')
  const block = ui.slice(ui.indexOf('.is-dialog__body {\n  overscroll-behavior: contain'),
    ui.indexOf('body.is-scroll-locked'))
  assert(/overscroll-behavior: contain/.test(block), 'dialog scroll must not chain to .ib-main__list')
})
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('comp output name L1 OK (' + count + ' checks)')
}
