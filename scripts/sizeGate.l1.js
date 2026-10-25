// Focused regression checks for size gate retry output semantics.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(path.join(__dirname, '../src/util/processor/sizeGate.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export function /gm, 'function ')
  .concat('\n globalThis.testApi = { normalizeSizeLimit, enforceSizeLimit }')
const configSource = fs.readFileSync(path.join(__dirname, '../src/util/sizeLimitConfig.js'), 'utf8')
  .replace(/^export function /gm, 'function ')
  .concat('\n globalThis.sizeLimitConfigApi = { automaticRetryCount, automaticRetryQuality, effectiveQualityStart }')
const remapSource = fs.readFileSync(path.join(__dirname, '../src/util/frameRemap.js'), 'utf8')
  .replace(/^import TYPE from .*$/m, '')
  .replace(/^export function /gm, 'function ')
  .concat('\n globalThis.frameRemapApi = { sampleFrameIndices, sampleTimedFrameIndices, frameRemapSettings, remapSequence }')

function makeHarness (autoDelete, maxTries, maxKB, staysOverAtQualityFloor) {
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
      sizes[path.join(item.basic.tmpOutputDir, 'out.webp')] = staysOverAtQualityFloor
        ? 510000 + q * 6000
        : (q <= 60 ? 450000 : 700000)
      return Promise.resolve()
    },
    appLog: {
      info: (message, detail) => {
        logs.push(message + (detail ? ' — ' + detail : ''))
        return logs.length
      },
      update: (id, level, message, detail) => {
        logs[id - 1] = message + (detail ? ' — ' + detail : '')
      },
      warn: message => logs.push(message),
      error: message => logs.push(message)
    },
    i18n: {
      t: (key, args) => key + ' ' + Object.keys(args).map(k => k + '=' + args[k]).join(' ')
    }
  }
  vm.runInNewContext(configSource, context, { filename: 'sizeLimitConfig.js' })
  context.automaticRetryCount = context.sizeLimitConfigApi.automaticRetryCount
  context.automaticRetryQuality = context.sizeLimitConfigApi.automaticRetryQuality
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
        maxBytes: (maxKB || 500) * 1024,
        autoDelete,
        autoQuality: true,
        step: 10,
        maxTries
      }
    }
  }
  sizes['/out/animation.webp'] = 900000
  const store = { dispatch: (type, payload) => dispatches.push({ type, payload }) }
  return { api: context.testApi, retryConfig: context.sizeLimitConfigApi, item, sizes, logs, dispatches, store }
}

async function main () {
  const remapContext = { TYPE: { Comp: 'Comp' }, Number, Math, isFinite }
  vm.runInNewContext(remapSource, remapContext, { filename: 'frameRemap.js' })
  const frameIndices = remapContext.frameRemapApi.sampleFrameIndices(60, 12, 10)
  assert.strictEqual(frameIndices.length, 50, '12 fps to 10 fps should sample 50 frames from a 5 second sequence')
  assert.strictEqual(new Set(frameIndices).size, 50, 'remapping must not duplicate source frames')
  assert.strictEqual(frameIndices[0], 0)
  assert.strictEqual(frameIndices[frameIndices.length - 1], 59)
  const timedIndices = remapContext.frameRemapApi.sampleTimedFrameIndices([0.11, 0.11, 0.11, 0.11, 0.11, 0.11], 4)
  assert.deepStrictEqual(Array.from(timedIndices), [1, 3, 5], 'APNG timing should be sampled evenly across its original duration')
  const variableTimedIndices = remapContext.frameRemapApi.sampleTimedFrameIndices([0.05, 0.3, 0.05, 0.3, 0.05, 0.25], 3)
  assert.strictEqual(variableTimedIndices.length, 3, 'variable APNG frame delays should preserve total animation duration')
  assert(variableTimedIndices.every((index, position) => position === 0 || index >= variableTimedIndices[position - 1]), 'timed sampling must preserve frame order')
  const sourceFiles = Array.from({ length: 60 }, (_, index) => 'frame-' + index + '.png')
  const remapped = remapContext.frameRemapApi.remapSequence({
    basic: { type: 'Comp', compFps: 12 },
    options: { frameRate: 12, frameRemap: { enabled: true, targetFrameRate: 10 } }
  }, sourceFiles)
  assert.strictEqual(remapped.files.length, 50)
  assert.strictEqual(sourceFiles.length, 60, 'source frame list must remain intact')

  const keep = makeHarness(false, 10)
  assert.strictEqual(keep.retryConfig.effectiveQualityStart(80, false), 100, 'unchecked compression starts threshold retries at quality 100')
  assert.strictEqual(keep.retryConfig.effectiveQualityStart(80, true), 80, 'checked compression starts threshold retries at the selected quality')
  assert.strictEqual(keep.retryConfig.automaticRetryCount(80, 50), 50, 'retry count is independent of saved step')
  assert.strictEqual(keep.retryConfig.automaticRetryCount(4, 50), 3, 'each retry needs a distinct quality value')
  assert.strictEqual(keep.retryConfig.automaticRetryQuality(80, 7, 7), 1, 'last retry reaches minimum quality')
  assert.strictEqual(keep.retryConfig.automaticRetryQuality(80, 7, 1), 68, 'quality is spread across retries')
  assert.strictEqual(keep.retryConfig.automaticRetryCount(0, 10), 0, 'quality zero cannot be reduced')
  keep.item.options.sizeLimit.step = 79 // old preferences must not restrict the requested retry count
  assert.strictEqual(keep.api.normalizeSizeLimit(keep.item.options, 80).maxTries, 10)
  const kept = await keep.api.enforceSizeLimit(keep.item, keep.store, {})
  assert.strictEqual(keep.sizes['/out/animation.webp'], 450000, 'retries replace the output and stop once under 500 KiB')
  assert.strictEqual(Object.keys(keep.sizes).filter(file => /_v\d+\.webp$/.test(file)).length, 0, 'retry versions are not retained')
  assert.strictEqual(kept.triesUsed, 3)
  assert(keep.logs.some(line => line.indexOf('500.0KB') >= 0), 'logs should report the actual 500 KiB limit')
  assert(keep.logs.some(line => line.indexOf('logGateProgressDone') >= 0 && line.indexOf('tries=3') >= 0), 'the summary should show the final retry count')
  assert.strictEqual(keep.logs.filter(line => line.indexOf('logGateProgress') >= 0).length, 1, 'retries should update a single log row')

  const replace = makeHarness(true, 10)
  replace.sizes['/out/animation_v9.webp'] = 1200000
  await replace.api.enforceSizeLimit(replace.item, replace.store, {})
  assert.strictEqual(replace.sizes['/out/animation.webp'], 450000, 'checked mode should leave only the final output')
  assert.strictEqual(Object.keys(replace.sizes).filter(file => /_v\d+\.webp$/.test(file)).length, 0)

  const exhausted = makeHarness(true, 1)
  const result = await exhausted.api.enforceSizeLimit(exhausted.item, exhausted.store, {})
  assert.strictEqual(exhausted.sizes['/out/animation.webp'], 450000, 'one retry reaches the quality floor')
  assert.strictEqual(result.warned.length, 0)
  assert(exhausted.logs.some(line => line.indexOf('logGateProgressDone') >= 0 && line.indexOf('tries=1') >= 0))
  assert.strictEqual(exhausted.dispatches.filter(({ payload }) => payload && payload.schedule !== undefined).slice(-1)[0].payload.schedule, 1)

  const noRetries = makeHarness(true, 0)
  const noRetryResult = await noRetries.api.enforceSizeLimit(noRetries.item, noRetries.store, {
    convertSuccess: '转换完成',
    sizeLimitWarn: '超出大小阈值'
  })
  assert.strictEqual(noRetryResult.triesUsed, 0, 'zero retries must be honored')
  assert.strictEqual(noRetries.sizes['/out/animation.webp'], 900000, 'zero retries leave the measured output intact')
  assert.strictEqual(noRetryResult.succeeded, false, 'zero retries with an over-limit output are not successful')

  const floor = makeHarness(true, 19, 400, true)
  floor.sizes['/out/animation.webp'] = 1100000
  const floorResult = await floor.api.enforceSizeLimit(floor.item, floor.store, {
    convertSuccess: '转换完成',
    sizeLimitWarn: '超出大小阈值',
    sizeLimitQualityFloor: '{format} 已重压 {tries} 次并降至最低质量 {quality}，最终 {size}，仍高于阈值 {max}'
  })
  assert.strictEqual(floorResult.triesUsed, 19, 'all configured retries run regardless of legacy step')
  assert.strictEqual(floor.item.options.quality.value, 80, 'retry quality must not overwrite the user configured baseline')
  assert.strictEqual(floor.sizes['/out/animation.webp'], 516000, 'keep the last result even if it cannot meet the threshold')
  const finalFloorStatus = floor.dispatches.filter(({ payload }) => payload && payload.schedule !== undefined).slice(-1)[0]
  assert.strictEqual(finalFloorStatus.payload.schedule, -1, 'an output still over the threshold must use the failed task state')
  assert.strictEqual(floorResult.succeeded, false, 'an unmet threshold must not report success')
  assert(floor.logs.some(line => line.indexOf('logGateProgressWarn') >= 0 && line.indexOf('tries=19') >= 0), 'summarize the retry count when the threshold remains unmet')
  assert(floor.dispatches.some(({ payload }) => payload && payload.text && payload.text.indexOf('超出大小阈值') >= 0))

  console.log('size gate L1 OK')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
