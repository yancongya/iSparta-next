// L1 回归：apngCompress 必须把 apngquant 的量化产物 out-quant.png 接回
// apngopt 作为输入。否则 --quality=0-N 只作用在一个没人读取的死文件上，
// 最终 APNG 恒等于未量化母版 —— 用户在设置里改 quality 100/50 输出大小不变。
//
// 不启动真实工具链；用 mock 记录每次 action.exec 的命令行，断言数据流向。
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const src = fs.readFileSync(path.join(__dirname, '..', 'src/util/processor/apngCompress.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default function \(/m, 'function apngCompress (')
  .replace(/^export default /gm, '')
  .replace(/^export /gm, '')

const TMP = '/tmp/isparta-apng-quality'
const OUT = path.posix.join(TMP, 'out.png')
const QUANT = path.posix.join(TMP, 'out-quant.png')

let quantExists = true
let quantThrow = null
const calls = []

const exec = (bin, args) => {
  calls.push({ bin, args: args.slice() })
  if (bin === 'apngquant' && quantThrow) {
    const e = quantThrow
    quantThrow = null
    return Promise.reject(e)
  }
  return Promise.resolve({ command: bin })
}

function makeCtx () {
  calls.length = 0
  quantExists = true
  quantThrow = null
  const dispatched = []
  const ctx = {
    path: { join: (...a) => path.posix.join(...a) },
    fs: {
      ensureDirSync: () => {},
      copySync: () => {},
      existsSync: (p) => p === QUANT ? quantExists : (p === OUT)
    },
    action: { bin: (n) => n, exec },
    appLog: { warn: () => {} },
    store: { dispatch: (e) => dispatched.push(e) },
    console
  }
  ctx.locale = { compressing: 'compressing' }
  vm.createContext(ctx)
  vm.runInContext(src + '\n;this.apngCompress = apngCompress;', ctx)
  return ctx
}

function makeItem (checked, value) {
  return {
    index: 1,
    basic: {
      tmpDir: TMP,
      tmpOutputDir: TMP,
      fileList: [OUT + '-source']
    },
    options: {
      quality: { checked, value },
      floyd: { checked: true, value: 0.35 }
    }
  }
}

const failures = []
let count = 0
function check (name, fn) {
  return Promise.resolve().then(fn).then(() => { count++ })
    .catch((e) => failures.push(name + ': ' + (e && e.message || e)))
}

async function run () {
  // 1) quality 开启 + 量化成功：apngopt 的输入必须是 out-quant.png
  await check('quality on -> apngopt reads quantized file', async () => {
    const ctx = makeCtx()
    const item = makeItem(true, 50)
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const q = calls.find((c) => c.bin === 'apngquant')
    const o = calls.find((c) => c.bin === 'apngopt')
    assert(q, 'apngquant not invoked')
    assert(q.args.includes('--quality=0-50'), 'quality value not passed: ' + q.args)
    assert(o, 'apngopt not invoked')
    assert.strictEqual(o.args[0], QUANT, 'apngopt must read out-quant.png, got ' + o.args[0])
    assert.strictEqual(item.basic.fileList[0], OUT, 'tail must point back to out.png')
  })

  // 2) quality 关闭：不跑 apngquant，apngopt 直接读母版 out.png
  await check('quality off -> apngopt reads master out.png', async () => {
    const ctx = makeCtx()
    const item = makeItem(false, 50)
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    assert(!calls.some((c) => c.bin === 'apngquant'), 'apngquant should be skipped')
    const o = calls.find((c) => c.bin === 'apngopt')
    assert(o, 'apngopt not invoked')
    assert.strictEqual(o.args[0], OUT, 'apngopt must read master out.png, got ' + o.args[0])
  })

  // 3) 内存不足跳过量化：即便残留 out-quant.png 存在，也不能误用
  await check('quant OOM -> apngopt stays on master out.png', async () => {
    const ctx = makeCtx()
    const item = makeItem(true, 50)
    quantExists = true // 故意残留旧量化文件
    quantThrow = { err: 'libpng failed: memory allocation' }
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    assert.strictEqual(item.basic.apngQuantSkipped, true, 'skip flag must be set')
    const o = calls.find((c) => c.bin === 'apngopt')
    assert(o, 'apngopt not invoked after OOM')
    assert.strictEqual(o.args[0], OUT, 'OOM must not use stale out-quant.png, got ' + o.args[0])
    assert.strictEqual(item.basic.fileList[0], OUT, 'tail must point back to out.png')
  })

  // 4) 量化成功但产物文件缺失：不切换，保持母版
  await check('quant success but no file -> stay on master', async () => {
    const ctx = makeCtx()
    const item = makeItem(true, 50)
    quantExists = false
    await ctx.apngCompress(item, 0, ctx.store, ctx.locale)
    const o = calls.find((c) => c.bin === 'apngopt')
    assert.strictEqual(o.args[0], OUT, 'no quant file -> master, got ' + o.args[0])
  })

  console.log(`apng-quality-chain: ${count}/${count + failures.length} checks passed`)
  if (failures.length) {
    failures.forEach((f) => console.error('  FAIL ' + f))
    process.exit(1)
  }
}

run()
