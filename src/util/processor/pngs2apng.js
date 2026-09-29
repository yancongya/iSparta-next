import { fs, path } from '../node-env'
import action from './action'
import apngCompress from './apngCompress'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.4
  })

	// copy filelist to temp dir（限流：长序列一次 Promise.all 会打爆句柄/内存）
  var tmpDir = item.basic.tmpDir
  var numLen = item.basic.fileList.length.toString().split('').length
  fs.ensureDirSync(tmpDir)
  var firstPNG = 'apng' + action.pad(1, numLen) + '.png'

  var copyJobs = item.basic.fileList.map((file, index) => {
    return function () {
      var target = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.png')
      var p = fs.copy(file, target)
      if (item.options.delays && item.options.delays[index]) {
        var txtFile = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.txt')
        p = p.then(() => fs.writeFile(txtFile, "delay=" + item.options.delays[index] * 1000 + "/1000"))
      }
      return p
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
      String(item.options.frameRate),
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
