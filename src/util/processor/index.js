import apng2gif 	from './apng2gif'
import apng2webp 	from './apng2webp'
import apngCompress from './apngCompress'
import gif2apng 	from './gif2apng'
import PNGs2apng 	from './pngs2apng'
import webp2apng 	from './webp2apng'
import Action 		from './action'
import { fs, path, os, isMockEnv } 	from '../node-env'
import TYPE 		from '../../store/enum/type'
import { enforceSizeLimit, normalizeSizeLimit } from './sizeGate'
import { planStartingQuality, planStartingColors, estimateColorsBytes } from '../sizePlanner'
import { normalizePalette, isPreserveBitDepth } from '../paletteConfig'
import { effectiveQualityStart } from '../sizeLimitConfig'
import { resolveOutputPath } from '../outputPath'
import hostAdapter 	from '../host-env'
import appLog from '../../ui-next/log'
import i18n from '../../i18n'
import { sampleTimedFrameIndices } from '../frameRemap'
import { outputFilesOf } from '../task-output'
import { fallbackRenameForSource } from '../outputConflict'
import { basenameNoExt } from '../pathUtil'
import { outputNameFor } from '../outputName'

function stat (label) {
  try {
    if (typeof MtaH5 !== 'undefined' && MtaH5.clickStat) {
      MtaH5.clickStat(label)
    }
  } catch (e) { /* 统计失败不应中断转换流程 */ }
}

/**
 * 首压前规划：sizeLimit 开启时，按目标体积反推一个保守起始值，写入转换副本的
 * quality / palette（item 是 Action 里 JSON clone 的副本，不碰 store 的用户配置）。
 * - 只在规划值低于用户基线时下调，绝不抬高；
 * - 质量路线反推起始质量 Q；色深路线反推起始色数档位（两条路线互斥，绝不同时生效）；
 * - 源大小取 fileList[0]（APNG/GIF/WEBP 母版或序列首帧），失败则跳过规划；
 * - 规划只是起始建议，sizeGate 事后仍按真实大小兜底。
 */
function applyStartPlan (item) {
  const opts = item && item.options
  // 保真输出：不做前置质量/色数规划——无压缩、无体积约束，规划无意义且会篡改用户档位
  if (!opts || isPreserveBitDepth(opts)) { return }
  if (!opts.sizeLimit || !opts.sizeLimit.enabled) { return }
  if (!opts.outputFormat || !opts.outputFormat.length) { return }
  const pal = normalizePalette(opts)
  const limit = normalizeSizeLimit(opts, effectiveQualityStart(opts.quality && opts.quality.value, opts.quality && opts.quality.checked))
  const sourceFile = item.basic && (item.basic.sourceFile || (item.basic.fileList && item.basic.fileList[0]))
  let sourceBytes = -1
  try { if (sourceFile) { sourceBytes = fs.statSize(sourceFile) } } catch (e) { /* skip */ }
  if (!(sourceBytes > 0)) { return }
  if (pal.mode === 'colors') {
    // 色深路线：反推起始色数档位（只降不升；规划下限 16 色，sizeGate 逐档重试兜底）。
    // 最坏格式决定是否超限——与 quality 路线同一保守口径。
    const worst = opts.outputFormat.reduce(function (m, f) {
      return estimateColorsBytes(sourceBytes, pal.colors, f) > estimateColorsBytes(sourceBytes, pal.colors, m) ? f : m
    }, opts.outputFormat[0])
    const plan = planStartingColors({
      maxBytes: limit.maxBytes,
      sourceBytes: sourceBytes,
      format: worst,
      baselineColors: pal.colors,
      safety: 0.9,
      floorColors: 16
    })
    if (plan.plannedColors < pal.colors) {
      opts.palette = { mode: 'colors', colors: plan.plannedColors }
      appLog.info('首压前规划：起始色数 C' + pal.colors + ' → C' + plan.plannedColors +
        '（目标 ' + (limit.maxBytes / 1024 / 1024).toFixed(2) + 'MB，源 ' +
        (sourceBytes / 1024 / 1024).toFixed(2) + 'MB）')
    }
    return
  }
  const q = opts.quality || {}
  const baseline = effectiveQualityStart(q.value, q.checked)
  const plan = planStartingQuality({
    maxBytes: limit.maxBytes,
    sourceBytes: sourceBytes,
    formats: opts.outputFormat,
    baselineQuality: baseline,
    safety: 0.9,
    floorQuality: 20
  })
  if (plan.plannedQuality < baseline) {
    opts.quality = { checked: true, value: plan.plannedQuality }
    appLog.info('首压前规划：起始质量 Q' + baseline + ' → Q' + plan.plannedQuality +
      '（目标 ' + (limit.maxBytes / 1024 / 1024).toFixed(2) + 'MB，源 ' +
      (sourceBytes / 1024 / 1024).toFixed(2) + 'MB）')
  }
}

/**
 * 纯浏览器 mock 环境（mockup / 落地页 demo）的模拟转换。
 * mock fs 里源文件只是 'mock' 占位字符串、也没有真实编码器，走真实链路必然
 * 「invalid PNG frame / 转换中断」。这里不碰编码器，写一份可读产物并分段推进
 * 进度到完成态，让 mockup 下点「开始」能完整演示任务条 / 进度 / 产物角标链路。
 * 与真实链路的同构点：同样写 outputFilesOf 指向的产物、同样发 editProcess。
 */
function mockConvert (items, store, locale) {
  items.forEach(function (item) {
    outputFilesOf(item).forEach(function (file) {
      fs.writeFileSync(file, 'mock output\n'.repeat(256))
    })
  })
  var steps = [0.25, 0.55, 0.85, 1]
  return steps.reduce(function (chain, schedule) {
    return chain.then(function () {
      return new Promise(function (resolve) {
        setTimeout(function () {
          items.forEach(function (item) {
            store.dispatch('editProcess', {
              index: item.index,
              text: schedule === 1 ? (locale.convertSuccess || 'Success') : (locale.startConvert || 'Converting') + '...',
              detail: '',
              schedule: schedule
            })
          })
          resolve()
        }, 220)
      })
    })
  }, Promise.resolve())
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
  // 纯浏览器 mock：无真实编码器 / 真实帧内容，走模拟转换（含进度推进），
  // 覆盖桌面 mockup :8081、CEP mockup :8082 与落地页 demo，三处共用同一判据。
  if (isMockEnv()) {
    return mockConvert(action.items, store, locale)
  }
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
          // 目标大小前置规划：首压前把目标体积翻译成保守起始质量（仅 sizeLimit 开启时）
          applyStartPlan(ready)
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
            // err.err 常带 stderr 全文（action.js 组装的），留末尾便于定位真正原因
            var reason = err && (err.err || err.message)
            var detail = reason ? String(reason).replace(/\r/g, '').trim() : ''
            if (detail.length > 600) { detail = '…' + detail.slice(detail.length - 600) }
            store.dispatch('editProcess', {
              index: currentItem.index,
              text: locale.convertFail || 'Failed',
              detail: detail,
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
    try {
      const rawGs = storage.getItem('globalSetting')
      const gs = rawGs ? JSON.parse(rawGs) : null
      if (gs && gs.autoCopyOutput) {
        const files = []
        action.items.forEach((it) => {
          outputFilesOf(it).forEach((f) => {
            try { if (fs.existsSync(f)) files.push(f) } catch (e) { /* ignore */ }
          })
        })
        if (files.length && hostAdapter && typeof hostAdapter.copyFilesToClipboard === 'function') {
          hostAdapter.copyFilesToClipboard(files).then((ok) => {
            if (ok) appLog.info('自动复制产物', files.length + ' 个文件')
            else appLog.warn('自动复制产物失败', 'copyFilesToClipboard 返回 false')
          }).catch((e) => {
            appLog.warn('自动复制产物失败', (e && e.message) || String(e))
          })
        }
      }
    } catch (eCopy) { /* ignore */ }
  }).catch((err) => {
    for (var i = 0; i < action.items.length; i++) {
      fs.remove(action.items[i].basic.tmpDir);
    }
    store.dispatch('setLock', false)
    try {
      const rawGs = storage.getItem('globalSetting')
      const gs = rawGs ? JSON.parse(rawGs) : null
      if (gs && gs.autoCopyOutput) {
        const files = []
        action.items.forEach((it) => {
          outputFilesOf(it).forEach((f) => {
            try { if (fs.existsSync(f)) files.push(f) } catch (e) { /* ignore */ }
          })
        })
        if (files.length && hostAdapter && typeof hostAdapter.copyFilesToClipboard === 'function') {
          hostAdapter.copyFilesToClipboard(files).then((ok) => {
            if (ok) appLog.info('自动复制产物', files.length + ' 个文件')
            else appLog.warn('自动复制产物失败', 'copyFilesToClipboard 返回 false')
          }).catch((e) => {
            appLog.warn('自动复制产物失败', (e && e.message) || String(e))
          })
        }
      }
    } catch (eCopy) { /* ignore */ }
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
  // 后面会把 fileList[0] 换成临时 out.png，先留住真实源文件用于落盘保底比对
  const sourceFiles = ((item.basic && item.basic.fileList) || []).slice()
  const safeTarget = function (target, format) {
    // 预检弹窗里用户明确选了「直接覆盖源文件」→ 尊重大胆选择，不再保底改名。
    // 该标记由 store 在本次开始前写入，processor 拿到的是深拷贝，标记随之带过来。
    if (item.basic && item.basic.overwriteSource) return target
    const renamed = fallbackRenameForSource(target, sourceFiles)
    if (renamed !== target) {
      appLog.warn(i18n.t('noticeFallbackRenameTitle'), i18n.t('noticeFallbackRenameBody', {
        from: target, to: renamed
      }))
      // 让后续 sizeGate / 产物复制按改名后的名字找文件，避免「落盘成功但找不到产物」。
      // 只记当前格式的覆盖名——不能写共享 outputName，否则三个格式又一起变名。
      if (!item.basic.outputNameOverride) { item.basic.outputNameOverride = {} }
      const finalName = basenameNoExt(renamed)
      const fmt = String(format || '').toUpperCase()
      item.basic.outputNameOverride[fmt] = finalName
      // 回写 store：processor 用的是深拷贝，不回写则任务条输出名仍是旧值（cool），
      // 与实际落盘产物（cool_1）不一致。用专用 action 绕过转换期的 locked。
      // item.index 口径同 editProcess（选中项内序号），store 侧据此定位原任务。
      store.dispatch('applyNameOverride', { index: item.index, format: fmt, name: finalName })
    }
    return renamed
  }
  // 输出模板可能展开出一个尚不存在的新目录（如 {srcPath}/输出）。CEP 桥的 fs.copy
  // 走 link/copyFile 异步快路径，不自动建父目录，目标缺失则 ENOENT copyfile；
  // 默认 {srcPath} 指向已建好的序列帧目录才一直没暴露。写入前先确保目录存在。
  // 桌面端 fs:copy 本就自动建父目录，此处幂等无副作用。
  if (item.basic.outputPath) {
    fs.ensureDirSync(item.basic.outputPath)
  }
  // 中间产物 ASCII 名 out.*；最终输出仍用用户 outputName
  item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, 'out.png')
  item.options.outputFormat.forEach((el) => {
    switch (el) {
      case TYPE.APNG:
        funcArr.push(fs.copy(
				path.join(item.basic.tmpOutputDir, 'out.png'),
				safeTarget(path.join(item.basic.outputPath, outputNameFor(item, TYPE.APNG) + '.png'), TYPE.APNG)
			))
        break

      case TYPE.GIF:
        funcArr.push(apng2gif(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, 'out.gif'),
					safeTarget(path.join(item.basic.outputPath, outputNameFor(item, TYPE.GIF) + '.gif'), TYPE.GIF)
				)
        }))
        break

      case TYPE.WEBP:
        funcArr.push(apng2webp(item, store, locale).then(() => {
          return fs.copy(
					path.join(item.basic.tmpOutputDir, 'out.webp'),
					safeTarget(path.join(item.basic.outputPath, outputNameFor(item, TYPE.WEBP) + '.webp'), TYPE.WEBP)
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
