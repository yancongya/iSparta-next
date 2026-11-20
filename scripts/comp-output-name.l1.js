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
  for (const file of ['src/util/tokenizeName.js', 'src/util/outputPath.js', 'src/util/outputConflict.js', 'src/cep/comp-source.js']) {
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
check('setting exposes suffix capsules wired to applySuffix', () => {
  const setting = read('src/components/setting/setting.vue')
  assert(/toggleOutputSuffix\(format\)/.test(setting))
  assert(/applySuffix\(name, s, on\)/.test(setting))
  assert(/resolveSuffixState\(value, this\.formatList\)/.test(setting))
})
check('processor fallback guards all three output formats', () => {
  const proc = read('src/util/processor/index.js')
  assert.strictEqual((proc.match(/safeTarget\(path\.join\(item\.basic\.outputPath/g) || []).length, 3)
  assert(/item\.options\.outputName = path\.basename\(renamed/.test(proc))
})
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log('comp output name L1 OK (' + count + ' checks)')
}
