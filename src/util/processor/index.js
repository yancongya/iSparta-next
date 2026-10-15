import apng2gif 	from './apng2gif'
import apng2webp 	from './apng2webp'
import apngCompress from './apngCompress'
import gif2apng 	from './gif2apng'
import PNGs2apng 	from './pngs2apng'
import webp2apng 	from './webp2apng'
import Action 		from './action'
import { fs, path, os } 	from '../node-env'
import TYPE 		from '../../store/enum/type'
import { enforceSizeLimit } from './sizeGate'
import { resolveOutputPath } from '../outputPath'
import hostAdapter 	from '../host-env'
import appLog from '../../ui-next/log'
import i18n from '../../i18n'
import { sampleTimedFrameIndices } from '../frameRemap'

function stat (label) {
  try {
    if (typeof MtaH5 !== 'undefined' && MtaH5.clickStat) {
      MtaH5.clickStat(label)
    }
  } catch (e) { /* 统计失败不应中断转换流程 */ }
}

function runWithConcurrency (tasks, limit) {
  return new Promise(function (resolve, reject) {
    var index = 0
    var running = 0
    var errors = []
    function next () {
      if (index >= tasks.length && running === 0) {
        if (errors.length) {
          reject(errors[0])
        } else {
          resolve()
        }
        return
      }
      while (running < limit && index < tasks.length) {
        var task = tasks[index++]
        running++
        Promise.resolve().then(task).then(function () {
          running--
          next()
        }, function (err) {
          // 单条失败不中断整批：其余任务继续跑完，避免「一失败其它卡死/状态错乱」
          errors.push(err)
          running--
          next()
        })
      }
    }
    if (tasks.length === 0) {
      resolve()
    } else {
      next()
    }
  })
}

export default function (store, sameOutputPath, locale) {
  var action = new Action(store)
  var taskFactories = []
  // 输出目录尾空格会并行渲出「闪闪」和「闪闪 」两套帧
  if (sameOutputPath != null && sameOutputPath !== '') {
    sameOutputPath = String(sameOutputPath).replace(/^[\s　]+|[\s　]+$/g, '')
  }

  for (var i = 0; i < action.items.length; i++) {
    let item = action.items[i]

    if (sameOutputPath) {
      item.basic.outputPath = sameOutputPath
    } else {
      // 按 outputTo 策略解析（output / beside / custom+变量）
      item.basic.outputPath = resolveOutputPath(item, item.options)
    }
    // 记录源文件，供大小阈值重压时恢复母版
    if (item.basic.fileList && item.basic.fileList[0]) {
      item.basic.sourceFile = item.basic.fileList[0]
    }

    store.dispatch('editProcess', {
      index: item.index,
      text: locale.startConvert + '...',
      schedule: 0.1
    })

    taskFactories.push(function (currentItem) {
      return function () {
        // Comp：转换前渲序列填 fileList，再走 PNGs 同链
        // 渲染进度经 store.editProcess；schedule 限制在 0.15–0.38，不得超过 analysing 0.4
        // 桌面（无 prepareSequence / 不 supportsCompImport）不出现「渲染」文案
        var isComp = currentItem.basic && currentItem.basic.type === TYPE.Comp
        var willRender = isComp && !!(hostAdapter && hostAdapter.supportsCompImport)
        if (willRender) {
          store.dispatch('editProcess', {
            index: currentItem.index,
            text: (locale.renderingComp || 'Rendering composition') + '...',
            schedule: 0.15
          })
        }
        var prepare = isComp
          ? hostAdapter.prepareItem(currentItem, { store: store, locale: locale })
          : Promise.resolve(currentItem)

        return prepare.then(function (ready) {
          // 路径/源文件在 fileList 填好后重算（{srcName}=合成名仍可用）
          // sameOutputPath 必须再断言：prepareCompSequence 不得用模板顶掉「输出到文件夹」
          if (sameOutputPath) {
            ready.basic.outputPath = sameOutputPath
          } else {
            ready.basic.outputPath = resolveOutputPath(ready, ready.options)
          }
          if (ready.basic.fileList && ready.basic.fileList[0] && !ready.basic.sourceFile) {
            ready.basic.sourceFile = ready.basic.fileList[0]
          }
          switch (ready.basic.type) {
            case TYPE.PNGs:
            case TYPE.Comp:
              return PNGs2apng(ready, store, locale).then(() => apng2other(ready, store, locale))
            case TYPE.GIF:
              return gif2apng(ready, store, locale).then(() => apng2other(ready, store, locale))
            case TYPE.APNG:
              return remapApng(ready, store, locale).then(() => apng2other(ready, store, locale))
            case TYPE.WEBP:
              return webp2apng(ready, store, locale).then(() => apng2other(ready, store, locale))
            default:
              return Promise.resolve()
          }
        }).catch(function (err) {
          // Comp 渲序列失败：与 action.exec 失败一致（convertFail / -1）；桌面无渲染阶段不写
          if (willRender) {
            store.dispatch('editProcess', {
              index: currentItem.index,
              text: locale.convertFail || 'Failed',
              schedule: -1
            })
          }
          return Promise.reject(err)
        })
      }
    }(item))
  }

  // 长序列/大图：压低并发，避免多个 apngquant 同时打爆内存导致假卡死或失败
  var totalFrames = 0
  for (var fi = 0; fi < action.items.length; fi++) {
    var fl = action.items[fi].basic && action.items[fi].basic.fileList
    totalFrames += (fl && fl.length) || 0
  }
  var cpuN = Math.max(1, (os.cpus() || [{}]).length)
  var concurrency = cpuN
  if (totalFrames > 400 || action.items.length === 1 && totalFrames > 200) {
    concurrency = 1
  } else if (totalFrames > 150) {
    concurrency = Math.min(2, cpuN)
  }
  appLog.info(i18n.t('logBatchStart', { n: action.items.length }), i18n.t('logConcurrency') + ' ' + concurrency)
  return runWithConcurrency(taskFactories, concurrency).then(() => {
    for (var i = 0; i < action.items.length; i++) {
      fs.remove(action.items[i].basic.tmpDir);
    }
    store.dispatch('setLock', false)
  }).catch((err) => {
    for (var i = 0; i < action.items.length; i++) {
      fs.remove(action.items[i].basic.tmpDir);
    }
    store.dispatch('setLock', false)
    // 必须打出真实 err：否则日志只有「转换中断」没有原因
    try {
      var msg = (err && (err.err || err.message || err.error || err.command)) || String(err)
      appLog.error('转换中断', msg)
    } catch (eLog) { /* ignore */ }
    return Promise.reject(err)
  })
}

// APNG remapping shares the existing APNG decoder and PNG-sequence encoder.
// apngdis emits fully composited full-canvas frames, so sampling them cannot
// break APNG delta-frame blend/disposal dependencies.
function remapApng (item, store, locale) {
  const remap = item.options && item.options.frameRemap
  const targetRate = Number(remap && remap.targetFrameRate)
  const sourceFile = item.basic && item.basic.sourceFile
  if (!remap || !remap.enabled || !isFinite(targetRate) || targetRate <= 0 || !sourceFile) {
    return apngCompress(item, 0, store, locale)
  }

  const tmpDir = item.basic.tmpDir
  const decodeDir = path.join(tmpDir, 'apng-remap')
  const decodeSource = path.join(decodeDir, 'source.png')
  fs.ensureDirSync(decodeDir)
  return fs.copy(sourceFile, decodeSource).then(() => {
    return Action.exec(Action.bin('apngdis'), [decodeSource], item, store, locale, { cwd: decodeDir })
  }).then(() => {
    const metadataPath = path.join(decodeDir, 'apngframe_metadata.json')
    const animation = JSON.parse(fs.readFileSync(metadataPath, { encoding: 'utf-8' }))
    const frames = animation && animation.frames
    if (!Array.isArray(frames) || !frames.length) {
      throw new Error('APNG remapping failed: decoded frame metadata is empty')
    }
    const delays = frames.map(function (frame) {
      const numerator = Number(frame.delay_num)
      const denominator = Number(frame.delay_den) || 100
      const seconds = numerator / denominator
      return isFinite(seconds) && seconds > 0 ? seconds : 0.01
    })
    const duration = delays.reduce(function (sum, value) { return sum + value }, 0)
    const sourceRate = frames.length / duration
    if (targetRate >= sourceRate) {
      // A target at or above the actual APNG rate cannot reduce frames.
      return apngCompress(item, 0, store, locale)
    }
    const indices = sampleTimedFrameIndices(delays, targetRate)
    const selectedFiles = indices.map(function (index) {
      return path.join(decodeDir, frames[index].src)
    })
    if (!selectedFiles.length) {
      throw new Error('APNG remapping failed: no frames selected')
    }
    store.dispatch('editProcess', {
      index: item.index,
      text: (locale.frameRemapping || 'Frame remapping') + ' ' + frames.length + ' → ' + selectedFiles.length +
        ' (' + sourceRate.toFixed(2) + ' → ' + targetRate + ' fps)',
      schedule: 0.42
    })

    const sequenceItem = Object.assign({}, item, {
      basic: Object.assign({}, item.basic, { type: TYPE.PNGs, fileList: selectedFiles }),
      options: Object.assign({}, item.options, {
        frameRate: targetRate,
        frameRemap: { enabled: false, targetFrameRate: targetRate }
      })
    })
    return PNGs2apng(sequenceItem, store, locale).then(function () {
      item.basic.fileList = sequenceItem.basic.fileList
      item.basic.assembledApng = sequenceItem.basic.assembledApng
      item.options.frameRate = targetRate
    })
  })
}

function apng2other (item, store, locale) {
  var funcArr = []
  // 中间产物 ASCII 名 out.*；最终输出仍用用户 outputName
  item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, 'out.png')
  item.options.outputFormat.forEach((el) => {
    switch (el) {
      case TYPE.APNG:
        funcArr.push(fs.copy(
				path.join(item.basic.tmpOutputDir, 'out.png'),
				path.join(item.basic.outputPath, item.options.outputName + '.png')
			))
        break

      case TYPE.GIF:
        funcArr.push(apng2gif(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, 'out.gif'),
					path.join(item.basic.outputPath, item.options.outputName + '.gif')
				)
        }))
        break

      case TYPE.WEBP:
        funcArr.push(apng2webp(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, 'out.webp'),
					path.join(item.basic.outputPath, item.options.outputName + '.webp')
				)
        }))
    }
    stat(item.basic.type + "-" + el)
  })
	// copy tempdir file to output dir
  return Promise.all(funcArr).then(() => {
		// delete tmp dir
    // return fs.remove(item.basic.tmpOutputDir)
    stat('1')
    // 大小阈值：警告 / 自动删 / 降质量重压
    return enforceSizeLimit(item, store, locale).then((result) => {
      if (!result || !result.enforced) {
        store.dispatch('editProcess', {
          index: item.index,
          text: locale.convertSuccess + '！',
          schedule: 1
        })
      }
    })
  })
}
