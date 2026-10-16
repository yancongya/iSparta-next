import { fs, path } from '../node-env'
import action from './action'
import apngCompress from './apngCompress'
import { remapSequence } from '../frameRemap'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.4
  })

  // 可选重映射：均匀取样用于编码，绝不删除 AE/用户的源帧。
  const originalFrames = item.basic.fileList.slice()
  const remapped = remapSequence(item, originalFrames)
  const frameFiles = remapped.files
  const sourceIndices = remapped.indices
  const outputFrameRate = remapped.targetFrameRate

  // APNG requires every source frame to have identical dimensions. Catch a stale
  // reused frame before invoking apngasm so the failing frame is actionable.
  function readPngDimensions (file) {
    const header = fs.readFileSync(file).slice(0, 24)
    const ascii = function (offset) {
      return String.fromCharCode(header[offset], header[offset + 1], header[offset + 2], header[offset + 3])
    }
    const uint32 = function (offset) {
      return (((header[offset] << 24) | (header[offset + 1] << 16) | (header[offset + 2] << 8) | header[offset + 3]) >>> 0)
    }
    if (header.length < 24 || header[0] !== 0x89 || ascii(1) !== 'PNG' || ascii(12) !== 'IHDR') {
      throw new Error('invalid PNG frame: ' + file)
    }
    return { width: uint32(16), height: uint32(20) }
  }

  let firstDimensions = null
  for (let i = 0; i < frameFiles.length; i++) {
    const dimensions = readPngDimensions(frameFiles[i])
    if (!firstDimensions) {
      firstDimensions = dimensions
    } else if (dimensions.width !== firstDimensions.width || dimensions.height !== firstDimensions.height) {
      throw new Error('PNG frame size mismatch: ' + frameFiles[0] + ' (' + firstDimensions.width + 'x' + firstDimensions.height + ') and ' + frameFiles[i] + ' (' + dimensions.width + 'x' + dimensions.height + '). Re-render the composition sequence before converting.')
    }
  }

  if (remapped.enabled) {
    store.dispatch('editProcess', {
      index: item.index,
      text: (locale.frameRemapping || 'Frame remapping') + ' ' + originalFrames.length + ' → ' + frameFiles.length +
        ' (' + remapped.sourceFrameRate + ' → ' + outputFrameRate + ' fps)',
      schedule: 0.42
    })
  }

  // copy filelist to temp dir（限流：长序列一次 Promise.all 会打爆句柄/内存）
  var tmpDir = item.basic.tmpDir
  var numLen = frameFiles.length.toString().split('').length
  fs.ensureDirSync(tmpDir)
  var firstPNG = 'apng' + action.pad(1, numLen) + '.png'

  var copyJobs = frameFiles.map((file, index) => {
    return function () {
      var target = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.png')
      var txtFile = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.txt')
      const sourceIndex = sourceIndices[index]
      const delay = !remapped.enabled && item.options.delays && item.options.delays[sourceIndex]
      // Clear stale per-frame delays from an earlier run; remapping uses its new uniform cadence.
      const clearDelay = typeof fs.remove === 'function'
        ? fs.remove(txtFile).catch(function () {})
        : Promise.resolve()
      return clearDelay.then(() => fs.copy(file, target)).then(() => {
        if (delay) {
          return fs.writeFile(txtFile, 'delay=' + delay * 1000 + '/1000')
        }
      })
    }
  })

  function runCopyLimited (jobs, limit) {
    var i = 0
    var running = 0
    return new Promise(function (resolve, reject) {
      function next () {
        if (i >= jobs.length && running === 0) {
          resolve()
          return
        }
        while (running < limit && i < jobs.length) {
          var job = jobs[i++]
          running++
          Promise.resolve().then(job).then(function () {
            running--
            next()
          }, reject)
        }
      }
      if (!jobs.length) { resolve() } else { next() }
    })
  }

  // 大图（序列帧可能 2K/4K）并发过高会打爆磁盘/内存；默认 4，超大帧降到 2
  var copyLimit = 4
  try {
    var probeSize = item.basic.fileList[0] && fs.statSize && fs.statSize(item.basic.fileList[0])
    if (probeSize && probeSize > 4 * 1024 * 1024) { copyLimit = 2 }
  } catch (eSz) { /* ignore */ }
  var copied = 0
  var totalCopy = copyJobs.length
  var wrapped = copyJobs.map(function (job) {
    return function () {
      return Promise.resolve().then(job).then(function (r) {
        copied++
        if (copied % 5 === 0 || copied === totalCopy) {
          store.dispatch('editProcess', {
            index: item.index,
            text: locale.analysing + ' ' + copied + '/' + totalCopy,
            schedule: 0.4
          })
        }
        return r
      })
    }
  })
  return runCopyLimited(wrapped, copyLimit).then(() => {
    // 拷贝结束 → 明确进入合成，避免 UI 一直停在「解析图片」
    store.dispatch('editProcess', {
      index: item.index,
      text: (locale.assembling || 'Assembling') + '...',
      schedule: 0.55
    })
	// apngasm：中间产物用 ASCII 文件名（outputName 可能是中文，部分工具会失败）
    var toolBase = 'out'
    // APNG Assembler 2.91：1 24 = 帧延时 1/24s；大图用 -z0 zlib + -i5，7zip 易 OOM
    return action.exec(action.bin('apngasm'), [
      path.join(item.basic.tmpOutputDir, toolBase + '.png'),
      path.join(tmpDir, firstPNG),
      '1',
      String(outputFrameRate),
      '-l' + (item.options.loop || 0),
      '-kc',
      '-z0',
      '-i5'
    ], item, store, locale, { timeout: 60 * 60 * 1000 })
  }).then(() => {
		// reset fileList
    item.basic.fileList = [
      path.join(item.basic.tmpOutputDir, 'out.png')
    ]
    // 保留未压缩母版，供大小阈值降质量重压
    try {
      const assembled = path.join(item.basic.tmpOutputDir, 'out.png')
      const src = assembled + '-src.png'
      fs.copySync(assembled, src)
      item.basic.assembledApng = src
    } catch (e) { /* ignore */ }
    return apngCompress(item, 0, store, locale)
  })
}
