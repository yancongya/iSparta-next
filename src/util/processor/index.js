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
    var settled = false
    function fail (err) {
      if (!settled) {
        settled = true
        reject(err)
      }
    }
    function next () {
      if (settled) {
        return
      }
      if (index >= tasks.length && running === 0) {
        settled = true
        resolve()
        return
      }
      while (running < limit && index < tasks.length) {
        var task = tasks[index++]
        running++
        Promise.resolve().then(task).then(function () {
          running--
          next()
        }, fail)
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
        switch (currentItem.basic.type) {
          case TYPE.PNGs:
            return PNGs2apng(currentItem, store, locale).then(() => apng2other(currentItem, store, locale))
          case TYPE.GIF:
            return gif2apng(currentItem, store, locale).then(() => apng2other(currentItem, store, locale))
          case TYPE.APNG:
            return apngCompress(currentItem, 0, store, locale).then(() => apng2other(currentItem, store, locale))
          case TYPE.WEBP:
            return webp2apng(currentItem, store, locale).then(() => apng2other(currentItem, store, locale))
          default:
            return Promise.resolve()
        }
      }
    }(item))
  }

  var concurrency = Math.max(1, (os.cpus() || [{}]).length)
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
    return Promise.reject(err)
  })
}
function apng2other (item, store, locale) {
  var funcArr = []
  item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
  item.options.outputFormat.forEach((el) => {
    switch (el) {
      case TYPE.APNG:
        funcArr.push(fs.copy(
				path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
				path.join(item.basic.outputPath, item.options.outputName + '.png')
			))
        break

      case TYPE.GIF:
        funcArr.push(apng2gif(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, item.options.outputName + '.gif'),
					path.join(item.basic.outputPath, item.options.outputName + '.gif')
				)
        }))
        break

      case TYPE.WEBP:
        funcArr.push(apng2webp(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp'),
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
