// Focused regression checks for size gate retry output semantics.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(path.join(__dirname, '../src/util/processor/sizeGate.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export function /gm, 'function ')
  .concat('\n globalThis.testApi = { normalizeSizeLimit, enforceSizeLimit }')

function makeHarness (autoDelete, maxTries) {
  const sizes = Object.create(null)
  const logs = []
  const dispatches = []
  const files = {
    existsSync: file => Object.prototype.hasOwnProperty.call(sizes, file),
    statSize: file => Object.prototype.hasOwnProperty.call(sizes, file) ? sizes[file] : -1,
    readdirSync: dir => Object.keys(sizes)
      .filter(file => path.dirname(file) === dir)
      .map(file => path.basename(file)),
    remove: file => {
      delete sizes[file]
      return Promise.resolve()
    },
    copy: (src, dest) => {
      if (!Object.prototype.hasOwnProperty.call(sizes, src)) return Promise.reject(new Error('missing ' + src))
      sizes[dest] = sizes[src]
      return Promise.resolve()
    }
  }
  const context = {
    fs: files,
    path,
    Promise,
    isFinite,
    Math,
    Number,
    String,
    TYPE: { APNG: 'APNG', GIF: 'GIF', WEBP: 'WEBP' },
    apngCompress: () => Promise.resolve(),
    apng2gif: () => Promise.resolve(),
    apng2webp: item => {
      const q = Number(item.options.quality.value)
      sizes[path.join(item.basic.tmpOutputDir, 'out.webp')] = q <= 60 ? 450000 : 700000
      return Promise.resolve()
    },
    appLog: { warn: message => logs.push(message), error: message => logs.push(message) },
    i18n: {
      t: (key, args) => key + ' ' + Object.keys(args).map(k => k + '=' + args[k]).join(' ')
    }
  }
  vm.runInNewContext(source, context, { filename: 'sizeGate.js' })
  const item = {
    index: 0,
    basic: { outputPath: '/out', tmpOutputDir: '/tmp' },
    options: {
      outputName: 'animation',
      outputFormat: ['WEBP'],
      quality: { checked: true, value: 80 },
      sizeLimit: {
        enabled: true,
        maxBytes: 500 * 1024,
        autoDelete,
        autoQuality: true,
        step: 10,
        maxTries
      }
    }
  }
  sizes['/out/animation.webp'] = 900000
  const store = { dispatch: (type, payload) => dispatches.push({ type, payload }) }
  return { api: context.testApi, item, sizes, logs, dispatches, store }
}

async function main () {
  const keep = makeHarness(false, 10)
  const kept = await keep.api.enforceSizeLimit(keep.item, keep.store, {})
  assert.strictEqual(keep.sizes['/out/animation.webp'], 900000, 'original should remain when keeping versions')
  assert.strictEqual(keep.sizes['/out/animation_v2.webp'], 700000, 'first retry should be retained')
  assert.strictEqual(keep.sizes['/out/animation_v3.webp'], 450000, 'retry should stop once under 500 KiB')
  assert.strictEqual(kept.triesUsed, 2)
  assert(keep.logs.some(line => line.indexOf('max=500.0KB') >= 0), 'logs should report the actual 500 KiB limit')
  assert(keep.logs.some(line => line.indexOf('tries=1') >= 0), 'retry numbering should start at one')

  const replace = makeHarness(true, 10)
  replace.sizes['/out/animation_v9.webp'] = 1200000
  await replace.api.enforceSizeLimit(replace.item, replace.store, {})
  assert.strictEqual(replace.sizes['/out/animation.webp'], 450000, 'checked mode should leave only the final output')
  assert.strictEqual(Object.keys(replace.sizes).filter(file => /_v\d+\.webp$/.test(file)).length, 0)

  const exhausted = makeHarness(true, 1)
  const result = await exhausted.api.enforceSizeLimit(exhausted.item, exhausted.store, {})
  assert.strictEqual(exhausted.sizes['/out/animation.webp'], 700000, 'retry exhaustion must retain the last output')
  assert.strictEqual(result.warned.length, 1)
  assert(exhausted.logs.some(line => line.indexOf('logGateExhausted') === 0))

  console.log('size gate L1 OK')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
