// L1 回归：走真实导入全链路 readerFiles（getAllFiles → getImageFormat →
// isApngBuffer → writePngBasic → writeBasic），验证各类文件名形态都被正确分组：
// - a02/a03/a04（编号不从 01 开始）→ 1 个 PNGs 任务（issue #2 最初反馈）
// - ah16_06.pcx.png 序列（数字与 .png 之间有中间扩展名）→ 1 个任务
//   （issue #2 后续反馈：9 张被拆成 9 个独立任务，根因是分组正则不匹配双重扩展名）
// - 不同前缀（a02/b02）→ 2 组；散图 → 各自 1 组
//
// 用真实 fs 读真实 PNG 字节；只 mock 掉 preload 桥之外的纯函数依赖。
// fixture 自造自清，可重复运行。
const assert = require('assert')
const fs = require('fs')
const nodePath = require('path')
const vm = require('vm')

const ROOT = nodePath.join(__dirname, '..')
const BASE = nodePath.join(ROOT, 'test/_l1_import_seq')

// 场景定义：dir 相对 BASE，files 为文件名列表，expectTasks 为期望 PNGs 任务数
const CASES = [
  {
    name: 'a02 sequence not starting at 01',
    files: ['a02.png', 'a03.png', 'a04.png'],
    expectTasks: 1
  },
  {
    name: 'pcx double-extension sequence (issue #2 user report)',
    files: Array.from({ length: 9 }, (_, i) => 'ah16_' + String(i + 6).padStart(2, '0') + '.pcx.png'),
    expectTasks: 1
  },
  {
    name: 'sparse pcx numbering',
    files: ['a02.pcx.png', 'a05.pcx.png', 'a09.pcx.png'],
    expectTasks: 1
  },
  {
    name: 'prefixed sequence ah16_01',
    files: ['ah16_01.png', 'ah16_02.png', 'ah16_03.png'],
    expectTasks: 1
  },
  {
    name: 'pure numeric 01-03',
    files: ['01.png', '02.png', '03.png'],
    expectTasks: 1
  },
  {
    name: 'two middle extensions',
    files: ['s_01.a.b.png', 's_02.a.b.png'],
    expectTasks: 1
  },
  {
    name: 'different prefixes split (a + b)',
    files: ['a02.png', 'a03.png', 'b02.png', 'b03.png'],
    expectTasks: 2
  },
  {
    name: 'scattered images stay separate',
    files: ['x.png', 'y.png', 'z.png'],
    expectTasks: 3
  },
  {
    name: 'single pcx image without trailing number',
    files: ['shot.pcx.png'],
    expectTasks: 1
  }
]

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

function makeFixture (relDir, files) {
  const dir = nodePath.join(BASE, relDir)
  fs.mkdirSync(dir, { recursive: true })
  const png = fs.readFileSync(nodePath.join(ROOT, 'test/pngs/cool_00.png'))
  for (const n of files) fs.writeFileSync(nodePath.join(dir, n), png)
  return dir
}

function cleanFixture () {
  try {
    if (!fs.existsSync(BASE)) return
    fs.rmSync(BASE, { recursive: true, force: true })
  } catch (e) { /* 清理失败不影响测试结论 */ }
}

async function run () {
  const png = fs.readFileSync(nodePath.join(ROOT, 'test/pngs/cool_00.png'))
  try {
    // posix / win32 两套 path 实现各跑一遍：分组逻辑不应依赖平台分隔符
    for (const [implLabel, pathImpl] of [
      ['posix', nodePath.posix],
      ['win32', nodePath.win32]
    ]) {
      for (const c of CASES) {
        const dir = makeFixture(c.name.replace(/\W+/g, '-'), c.files)
        const ctx = makeCtx(pathImpl)
        const tasks = await ctx.readerFiles([dir])
        const pngTasks = tasks.filter((t) => t.basic.type === 'PNGs')

        check(implLabel + ' | ' + c.name + ' -> ' + c.expectTasks + ' task(s)', () => {
          assert.strictEqual(pngTasks.length, c.expectTasks,
            'expected ' + c.expectTasks + ' PNGs task(s), got ' + pngTasks.length + ' :: ' +
            JSON.stringify(tasks.map((t) => ({ type: t.basic.type, files: t.basic.fileList }))))
        })
        // 单序列场景（除拆分场景外）帧数应等于文件数
        if (c.expectTasks === 1) {
          check(implLabel + ' | ' + c.name + ' -> all frames in one task', () => {
            if (!pngTasks.length) throw new Error('no PNGs task')
            const frames = Array.from(pngTasks[0].basic.fileList, (p) => nodePath.basename(p)).sort()
            assert.deepStrictEqual(frames, Array.from(c.files).sort(), 'frames: ' + JSON.stringify(frames))
          })
        }
      }
    }
  } finally {
    cleanFixture()
  }

  console.log('import-sequence-groups: ' + count + '/' + (count + failures.length) + ' checks passed')
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f))
    process.exit(1)
  }
}

run().catch((e) => { cleanFixture(); console.error(e); process.exit(1) })
