// L1 回归：走真实导入全链路 readerFiles（getAllFiles → getImageFormat →
// isApngBuffer → writePngBasic → writeBasic），验证文件名不从 01 开始的序列
// （a02.png / a03.png / a04.png）被归为「一个」PNGs 任务，而不是拆成多项。
//
// 这是对 issue #2 用户反馈 "identified as multiple separate items" 的实盘验证。
// 用真实 fs 读真实 PNG 字节；只 mock 掉 preload 桥之外的纯函数依赖。
const assert = require('assert')
const fs = require('fs')
const nodePath = require('path')
const vm = require('vm')

const ROOT = nodePath.join(__dirname, '..')
const FIXTURE = nodePath.join(ROOT, 'test/_l1_import_a02')

// 自包含素材：从真实 PNG 帧造 a02/a03/a04，跑完清理，不依赖预置 fixture
function makeFixture () {
  fs.mkdirSync(FIXTURE, { recursive: true })
  const png = fs.readFileSync(nodePath.join(ROOT, 'test/pngs/cool_00.png'))
  for (const n of ['a02.png', 'a03.png', 'a04.png']) {
    fs.writeFileSync(nodePath.join(FIXTURE, n), png)
  }
}
function cleanFixture () {
  try {
    if (!fs.existsSync(FIXTURE)) return
    for (const n of fs.readdirSync(FIXTURE)) fs.unlinkSync(nodePath.join(FIXTURE, n))
    fs.rmdirSync(FIXTURE)
  } catch (e) { /* 清理失败不影响测试结论 */ }
}

let fileSrc = fs.readFileSync(nodePath.join(ROOT, 'src/components/drag/file.js'), 'utf8')
fileSrc = fileSrc
  .replace(/^import .*$/gm, '')
  .replace(/^export const f =/m, 'const f =')
  .replace(/^export /gm, '')

const failures = []
let count = 0
function check (name, fn) {
  try { fn(); count++ } catch (e) { failures.push(name + ': ' + (e && e.message || e)) }
}

function makeCtx (pathImpl) {
  // 真实 fs，包成 node-env 的形状（preload 桥的等价物）
  const fsBridge = {
    existsSync: (p) => fs.existsSync(p),
    lstatSync: (p) => fs.lstatSync(p),
    readdirSync: (p) => fs.readdirSync(p),
    readFileSync: (p) => fs.readFileSync(p),
    ensureDirSync: (p) => fs.mkdirSync(p, { recursive: true }),
    copySync: (a, b) => fs.copyFileSync(a, b)
  }
  const globalSetting = {
    options: {
      outputName: '', outputSuffix: '',
      outputTo: { mode: 'beside', template: '{srcPath}', customPath: '' },
      quality: { checked: true, value: 80 },
      sizeLimit: { enabled: false }
    }
  }
  const ctx = {
    fs: fsBridge,
    path: pathImpl,
    resolveOutputPath: (item, options) => '/out',
    buildInitialOutputName: (base, options) => base || 'output',
    notice: { warning: () => {} },
    t: (k) => k,
    _: { cloneDeep: (o) => JSON.parse(JSON.stringify(o)) },
    window: { storage: { getItem: (k) => k === 'globalSetting' ? JSON.stringify(globalSetting) : null } },
    console
  }
  vm.createContext(ctx)
  vm.runInContext(fileSrc + '\n;this.readerFiles = f.readerFiles;', ctx)
  return ctx
}

async function run () {
  makeFixture()
  try {
    // posix / win32 两套 path 实现各跑一遍：分组逻辑不应依赖平台分隔符
    for (const [label, pathImpl] of [
      ['posix', nodePath.posix],
      ['win32', nodePath.win32]
    ]) {
      const ctx = makeCtx(pathImpl)
      const tasks = await ctx.readerFiles([FIXTURE])
      const pngTasks = tasks.filter((t) => t.basic.type === 'PNGs')

      check(label + ': a02/a03/a04 -> exactly 1 PNGs task', () => {
        assert.strictEqual(pngTasks.length, 1,
          'expected 1 PNGs task, got ' + pngTasks.length + ' :: ' +
          JSON.stringify(tasks.map((t) => ({ type: t.basic.type, files: t.basic.fileList }))))
      })
      check(label + ': task contains all 3 frames', () => {
        if (!pngTasks.length) throw new Error('no PNGs task')
        // Array.from 在主 realm 生成数组，避免 vm realm 的 Array.prototype 差异
        const names = Array.from(pngTasks[0].basic.fileList, (p) => nodePath.basename(p)).sort()
        assert.deepStrictEqual(names, ['a02.png', 'a03.png', 'a04.png'], 'frames: ' + JSON.stringify(names))
      })
    }
  } finally {
    cleanFixture()
  }

  console.log(`import-sequence-a02: ${count}/${count + failures.length} checks passed`)
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f))
    process.exit(1)
  }
}

run().catch((e) => { cleanFixture(); console.error(e); process.exit(1) })
