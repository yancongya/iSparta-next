// 输出文件大小阈值：检测 / 超限警告 / 自动删 / 自动降质量重压
import { fs, path } from '../node-env'
import apngCompress from './apngCompress'
import apng2gif from './apng2gif'
import apng2webp from './apng2webp'
import TYPE from '../../store/enum/type'
import appLog from '../../ui-next/log'
import i18n from '../../i18n'
import { automaticRetryCount, automaticRetryQuality, effectiveQualityStart } from '../sizeLimitConfig'
import { planStartingQuality, planStartingColors, estimateColorsBytes } from '../sizePlanner'
import { normalizePalette, automaticRetryColors, automaticRetryColorsCount } from '../paletteConfig'

export function normalizeSizeLimit (options, quality) {
  const s = (options && options.sizeLimit) || {}
  const maxTries = Number(s.maxTries)
  let maxBytes = Number(s.maxBytes)
  if (!isFinite(maxBytes) || maxBytes <= 0) {
    const maxMB = Number(s.maxMB)
    maxBytes = (isFinite(maxMB) && maxMB > 0) ? maxMB * 1024 * 1024 : 1024 * 1024
  }
  const configuredMaxTries = isFinite(maxTries) && maxTries >= 0 ? Math.floor(maxTries) : 10
  return {
    enabled: !!s.enabled,
    maxBytes: maxBytes,
    maxMB: maxBytes / 1024 / 1024,
    // Version policy is fixed: overwrite intermediate attempts and retain the
    // final output. Legacy preferences are intentionally ignored.
    autoDelete: true,
    autoQuality: true,
    configuredMaxTries: configuredMaxTries,
    maxTries: automaticRetryCount(quality, configuredMaxTries)
  }
}

export function formatMB (bytes) {
  if (!bytes || bytes < 0) { return '?' }
  if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(1) + 'KB'
  }
  return (bytes / 1024 / 1024).toFixed(2) + 'MB'
}

export function formatLimit (bytes) {
  return formatMB(bytes)
}

/**
 * 前置规划：按目标体积与源大小，反推一个更接近目标的起始质量。
 * 只用于「超限后重压」的基线：取用户基线与规划值中更保守者（不会抬高用户设置）。
 * 首压本身不变——若首压已达标则完全不触发；规划只是让可能发生的重压少走几轮。
 */
function plannedRetryBaseline (item, limit, userBaseline, formats) {
  try {
    var sourceFile = item.basic && (item.basic.assembledApng || item.basic.sourceFile ||
      (item.basic.fileList && item.basic.fileList[0]))
    var sourceBytes = sourceFile ? fs.statSize(sourceFile) : -1
    if (!(sourceBytes > 0)) { return { value: userBaseline, plan: null } }
    var plan = planStartingQuality({
      maxBytes: limit.maxBytes,
      sourceBytes: sourceBytes,
      formats: formats,
      baselineQuality: userBaseline,
      safety: 0.9,
      floorQuality: 20
    })
    // 取更保守者：规划只降不升，尊重用户已设的低质量
    var value = Math.min(userBaseline, plan.plannedQuality)
    appLog.info('size-gate 前置规划', {
      sourceBytes: sourceBytes,
      maxBytes: limit.maxBytes,
      userBaseline: userBaseline,
      plannedQuality: plan.plannedQuality,
      retryBaseline: value,
      feasible: plan.feasible
    })
    return { value: value, plan: plan }
  } catch (e) {
    return { value: userBaseline, plan: null }
  }
}

/**
 * 前置规划（色深路线）：按目标体积与源大小，反推更接近目标的起始色数档位。
 * 与质量路线同一「只降不升」原则；规划值作为逐档重试的起跑点。
 */
function plannedRetryBaselineColors (item, limit, baselineColors) {
  try {
    var sourceFile = item.basic && (item.basic.assembledApng || item.basic.sourceFile ||
      (item.basic.fileList && item.basic.fileList[0]))
    var sourceBytes = sourceFile ? fs.statSize(sourceFile) : -1
    if (!(sourceBytes > 0)) { return { value: baselineColors, plan: null } }
    // 最坏格式决定是否超限（GIF 体积模型最大），与 quality 路线同一保守口径
    var formats = item.options.outputFormat || ['APNG']
    var worst = formats.reduce(function (m, f) {
      return estimateColorsBytes(sourceBytes, baselineColors, f) > estimateColorsBytes(sourceBytes, baselineColors, m) ? f : m
    }, formats[0])
    var plan = planStartingColors({
      maxBytes: limit.maxBytes,
      sourceBytes: sourceBytes,
      format: worst,
      baselineColors: baselineColors,
      safety: 0.9,
      floorColors: 16
    })
    var value = Math.min(baselineColors, plan.plannedColors)
    appLog.info('size-gate 前置规划（色深）', {
      sourceBytes: sourceBytes,
      maxBytes: limit.maxBytes,
      baselineColors: baselineColors,
      plannedColors: plan.plannedColors,
      retryBaseline: value,
      feasible: plan.feasible
    })
    return { value: value, plan: plan }
  } catch (e) {
    return { value: baselineColors, plan: null }
  }
}

function outputPathFor (item, format) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.outputPath, item.options.outputName + ext)
}

function cleanupRetryVersions (item, format) {
  if (typeof fs.readdirSync !== 'function' || typeof fs.remove !== 'function') {
    return Promise.resolve()
  }
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  const dir = item.basic.outputPath
  const prefix = String(item.options.outputName || '') + '_v'
  let names = []
  try {
    names = fs.readdirSync(dir) || []
  } catch (e) { return Promise.resolve() }
  const stale = names.filter(function (name) {
    const value = String(name)
    if (value.indexOf(prefix) !== 0 || value.slice(-ext.length) !== ext) return false
    const version = value.slice(prefix.length, -ext.length)
    return /^\d+$/.test(version)
  })
  return stale.reduce(function (chain, name) {
    return chain.then(() => fs.remove(path.join(dir, name)))
  }, Promise.resolve()).catch((err) => {
    appLog.warn('size-gate retry version cleanup failed: ' + String(err && err.err || err))
  })
}

/**
 * 中间产物一律 ASCII 名 out.<ext>（apngCompress / pngs2apng / apng2gif / apng2webp 的落盘名），
 * 最终文件名才用 outputName —— 两侧必须同一真相源，否则重压后 copy 必 ENOENT。
 */
function tmpPathFor (item, format) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.tmpOutputDir, 'out' + ext)
}

function restoreMasterApng (item) {
  if (item.basic.assembledApng && fs.existsSync(item.basic.assembledApng)) {
    item.basic.fileList[0] = item.basic.assembledApng
    return
  }
  if (item.basic.sourceFile && fs.existsSync(item.basic.sourceFile)) {
    item.basic.fileList[0] = item.basic.sourceFile
  }
}

function reExportFormat (item, format, store, locale, opts, targetPath) {
  if (format === TYPE.APNG) {
    return fs.copy(
      tmpPathFor(item, TYPE.APNG),
      targetPath || outputPathFor(item, TYPE.APNG)
    )
  }
  if (format === TYPE.GIF) {
    return apng2gif(item, store, locale, opts).then(() => {
      return fs.copy(tmpPathFor(item, TYPE.GIF), targetPath || outputPathFor(item, TYPE.GIF))
    })
  }
  if (format === TYPE.WEBP) {
    return apng2webp(item, store, locale, opts).then(() => {
      return fs.copy(tmpPathFor(item, TYPE.WEBP), targetPath || outputPathFor(item, TYPE.WEBP))
    })
  }
  return Promise.resolve()
}

/**
 * 逐格式检查输出大小；超限则按尝试次数自动分配质量降幅，直到达标或重试上限。
 * 只保留最终结果；达到上限仍超限时保留产物并将任务标为失败。
 */
export function enforceSizeLimit (item, store, locale) {
  const initialQuality = effectiveQualityStart(
    item.options.quality && item.options.quality.value,
    item.options.quality && item.options.quality.checked
  )
  const limit = normalizeSizeLimit(item.options, initialQuality)
  if (!limit.enabled || !item.options.outputFormat || !item.options.outputFormat.length) {
    return Promise.resolve({ enforced: false })
  }

  // 压缩路线：quality（质量系数重试）/ colors（色深逐档重试，WEBP 除外——
  // WebP 无色数概念，仍走 cwebp -q 质量重试）。两条路线互斥。
  const pal = normalizePalette(item.options)
  const colorsMode = pal.mode === 'colors'
  const colorMaxTries = colorsMode ? automaticRetryColorsCount(pal.colors, limit.configuredMaxTries) : 0
  const retryBudget = item.options.outputFormat.reduce(function (total, format) {
    return total + (colorsMode && format !== TYPE.WEBP ? colorMaxTries : limit.maxTries)
  }, 0)
  const originalPalette = item.options.palette ? { mode: pal.mode, colors: pal.colors } : undefined

  const maxBytes = limit.maxBytes
  const formats = item.options.outputFormat.slice()
  let warned = []
  let triesUsed = 0
  let progressLogId = null

  // 每种格式从同一基线重试，避免串色。
  // 前置规划：用目标体积反推更接近的起始值，减少「压→测→降→再压」的轮次。
  const originalQuality = item.options.quality
  // 色深路线不做 quality 规划（互斥；WEBP 重试从用户 quality 起跑）
  const planned = colorsMode
    ? { value: initialQuality, plan: null }
    : plannedRetryBaseline(item, limit, initialQuality, formats)
  const baseQuality = originalQuality
    ? {
      checked: originalQuality.checked,
      value: planned.value
    }
    : { checked: true, value: planned.value }
  if (!isFinite(baseQuality.value)) { baseQuality.value = 80 }
  // 规划可能给出小于用户基线的质量：checked 必须为 true 才会走 apngquant 量化分支
  if (planned.plan && planned.value < initialQuality) { baseQuality.checked = true }
  // 色深路线：规划只影响色数基线；quality 规划不参与（互斥），WEBP 重试仍用用户 quality
  const plannedColors = colorsMode
    ? plannedRetryBaselineColors(item, limit, pal.colors)
    : { value: pal.colors, plan: null }
  const baseColors = plannedColors.value
  function updateRetryLog (level, tries, detail) {
    const titleKey = level === 'warn' ? 'logGateProgressWarn' : level === 'ok' ? 'logGateProgressDone' : 'logGateProgress'
    const title = i18n.t(titleKey, { tries: tries, maxTries: retryBudget })
    if (progressLogId && appLog.update) {
      appLog.update(progressLogId, level, title, detail)
    } else if (!progressLogId) {
      progressLogId = appLog.info(title, detail)
      if (level !== 'info' && appLog.update) appLog.update(progressLogId, level, title, detail)
    }
  }

  function checkOne (format) {
    const maxTries = colorsMode && format !== TYPE.WEBP ? colorMaxTries : limit.maxTries
    const outPath = outputPathFor(item, format)
    let size = fs.statSize(outPath)
    appLog.info('size-gate 输出文件检查', {
      format: format,
      path: outPath,
      sizeBytes: size,
      exists: fs.existsSync(outPath),
      maxBytes: maxBytes
    })
    if (size < 0) {
      // 输出缺失
      appLog.error('size-gate 无法读取输出文件大小', {
        format: format,
        path: outPath,
        sizeBytes: size,
        exists: fs.existsSync(outPath)
      })
      warned.push({ format, size: 0, missing: true })
      return Promise.resolve({ format, size: 0, action: 'warn-missing' })
    }
    if (size <= maxBytes) {
      return cleanupRetryVersions(item, format).then(() => null)
    }

    // 每种格式独立从原始基线起跑，上一格式降低的质量/色数不能串给下一格式。
    item.options.quality = {
      checked: baseQuality.checked,
      value: baseQuality.value
    }
    if (colorsMode) {
      item.options.palette = { mode: 'colors', colors: baseColors }
    }

    function retry (tries, currentPath) {
      size = fs.statSize(currentPath)
      if (size < 0) {
        warned.push({ format, size: 0, missing: true })
        return Promise.resolve({ format, size: 0, action: 'warn-missing' })
      }
      if (size <= maxBytes) {
        return Promise.resolve(null)
      }
      if (format !== TYPE.WEBP && item.basic.apngQuantSkipped) {
        warned.push({ format, size, compressionSkipped: true })
        return Promise.resolve({ format, size, action: 'warn-quantization-skipped' })
      }
      if (tries >= maxTries) {
        warned.push({ format, size, tries })
        return Promise.resolve({ format, size, action: 'warn-after-tries', tries })
      }
      // 色深路线（APNG/GIF）：逐档降色数，绝不碰 quality；
      // WEBP 在色深路线仍走质量重试（cwebp -q，WebP 无色数概念）
      const attempt = tries + 1
      const useColorsRetry = colorsMode && format !== TYPE.WEBP
      let nextValue
      let floorValue
      if (useColorsRetry) {
        const startC = isFinite(baseColors) ? baseColors : 256
        nextValue = automaticRetryColors(startC, maxTries, attempt)
        floorValue = Number(item.options.palette.colors)
      } else {
        const startQ = isFinite(baseQuality.value) ? baseQuality.value : 80
        nextValue = automaticRetryQuality(startQ, maxTries, attempt)
        floorValue = Number(item.options.quality.value)
      }
      if (nextValue >= floorValue) {
        warned.push({ format, size, tries, [useColorsRetry ? 'colors' : 'quality']: floorValue, floor: true })
        return Promise.resolve({ format, size, action: 'warn-floor', tries })
      }
      if (useColorsRetry) {
        item.options.palette = { mode: 'colors', colors: nextValue }
        item.options.quality.checked = true
      } else {
        item.options.quality.checked = true
        item.options.quality.value = nextValue
      }
      triesUsed += 1

      const retryDetail = i18n.t('logGateRetry', {
        fmt: format,
        tries: attempt,
        size: formatMB(size),
        max: formatLimit(maxBytes)
      })
      updateRetryLog('info', triesUsed, retryDetail)

      const targetPath = outPath

      store.dispatch('editProcess', {
        index: item.index,
        text: (locale.sizeLimitRetry || 'Size over limit, quality→') + (useColorsRetry ? 'C' + nextValue : nextValue) +
          ' (' + formatMB(size) + ' > ' + formatLimit(maxBytes) + ') ' + attempt + '/' + maxTries,
        schedule: 0.85
      })

      // WEBP 体积由 cwebp -q 直接控制，无需再重量化整段 APNG 母版（apngquant 对大动画既慢
      // 又易触顶内存/资源，且 cwebp 本就重编码母版帧）；只重跑最终编码器、降 cwebp -q 即可。
      // PNG/APNG/GIF 的「质量」即母版量化/颜色数，必须重新量化母版（apngquant）。
      // markFail:false —— 子步骤失败由下方 .catch 吞掉并重试，不把任务标红「生成失败」。
      let reEncode
      try {
        if (format === TYPE.WEBP) {
          reEncode = reExportFormat(item, format, store, locale, { markFail: false }, targetPath)
        } else {
          restoreMasterApng(item)
          reEncode = apngCompress(item, 0, store, locale, { markFail: false })
            .then(() => reExportFormat(item, format, store, locale, { markFail: false }, targetPath))
        }
      } catch (syncErr) {
        appLog.error('size-gate retry sync error', String(syncErr && syncErr.stack || syncErr))
        warned.push({ format, size, error: String(syncErr) })
        return Promise.resolve({ format, size, action: 'warn-error' })
      }
      return reEncode.then(() => retry(attempt, targetPath)).catch((err) => {
        appLog.error('size-gate retry failed', String(err && err.err || err))
        warned.push({ format, size, error: String(err && err.err || err) })
        return { format, size, action: 'warn-error' }
      })
    }

    return retry(0, outPath).then((result) => {
      return cleanupRetryVersions(item, format).then(() => result)
    })
  }

  return formats.reduce(function (chain, format) {
    return chain.then(() => checkOne(format))
  }, Promise.resolve()).then(() => {
    // Retry quality/palette is temporary per-conversion state; preserve the user's
    // configured baseline for the next run and for the settings panel.
    if (originalQuality) item.options.quality = originalQuality
    if (originalPalette) {
      item.options.palette = originalPalette
    } else {
      // 旧数据本无 palette 字段：恢复缺省形态，交给 normalizePalette 按 quality 解读
      delete item.options.palette
    }
    const summary = formats.map(function (format) {
      const finalSize = fs.statSize(outputPathFor(item, format))
      return format + ' ' + formatMB(finalSize) + (finalSize > maxBytes ? ' > ' : ' ≤ ') + formatLimit(maxBytes)
    }).join('; ')
    if (triesUsed > 0 || warned.length) {
      updateRetryLog(warned.length ? 'warn' : 'ok', triesUsed, summary)
    }
    let text = locale.convertSuccess + '！'
    if (warned.length) {
      text = (locale.sizeLimitWarn || 'Over size limit') + ' ' +
        warned.map(w => {
          if (w.missing) { return w.format + ' ?' }
          return w.format + ' ' + formatMB(w.size)
        }).join(', ')
    } else if (triesUsed > 0) {
      text = (locale.convertSuccess || 'OK') + '！ ' +
        (locale.sizeLimitAdjusted || '(size gate Q→)') + triesUsed
    }
    store.dispatch('editProcess', {
      index: item.index,
      text: text,
      // A generated file that still exceeds the configured limit is not a
      // successful conversion. The task card and output actions key off this
      // status, so leave it visibly failed until the user adjusts the limit.
      schedule: warned.length ? -1 : 1
    })
    return { enforced: true, warned, triesUsed, succeeded: warned.length === 0 }
  })
}
