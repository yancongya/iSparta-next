// 输出文件大小阈值：检测 / 超限警告 / 自动删 / 自动降质量重压
import { fs, path } from '../node-env'
import apngCompress from './apngCompress'
import apng2gif from './apng2gif'
import apng2webp from './apng2webp'
import TYPE from '../../store/enum/type'
import appLog from '../../ui-next/log'
import i18n from '../../i18n'

export function normalizeSizeLimit (options) {
  const s = (options && options.sizeLimit) || {}
  const step = Number(s.step)
  const maxTries = Number(s.maxTries)
  let maxBytes = Number(s.maxBytes)
  if (!isFinite(maxBytes) || maxBytes <= 0) {
    const maxMB = Number(s.maxMB)
    maxBytes = (isFinite(maxMB) && maxMB > 0) ? maxMB * 1024 * 1024 : 1024 * 1024
  }
  return {
    enabled: !!s.enabled,
    maxBytes: maxBytes,
    maxMB: maxBytes / 1024 / 1024,
    autoDelete: !!s.autoDelete,
    autoQuality: s.autoQuality !== false,
    step: isFinite(step) && step > 0 ? step : 5,
    maxTries: isFinite(maxTries) && maxTries > 0 ? Math.floor(maxTries) : 10
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

function outputPathFor (item, format) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.outputPath, item.options.outputName + ext)
}

function retryOutputPathFor (item, format, version) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.outputPath, item.options.outputName + '_v' + version + ext)
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
 * 逐格式检查输出大小；超限则按 step 降质量重压，直到达标或达 maxTries。
 * autoDelete 是历史配置键：勾选时覆盖旧结果、只留一个；未勾选时为每次重压另存版本。
 * 达到重试上限仍超限时保留最终结果并警告，绝不把唯一结果删掉。
 */
export function enforceSizeLimit (item, store, locale) {
  const limit = normalizeSizeLimit(item.options)
  if (!limit.enabled || !item.options.outputFormat || !item.options.outputFormat.length) {
    return Promise.resolve({ enforced: false })
  }

  const maxBytes = limit.maxBytes
  const formats = item.options.outputFormat.slice()
  let versioned = []
  let warned = []
  let triesUsed = 0

  // 每种格式从同一质量基线重试，避免串色
  const baseQuality = item.options.quality
    ? {
      checked: item.options.quality.checked,
      value: Number(item.options.quality.value)
    }
    : { checked: true, value: 80 }
  if (!isFinite(baseQuality.value)) { baseQuality.value = 80 }

  function checkOne (format) {
    const outPath = outputPathFor(item, format)
    let size = fs.statSize(outPath)
    if (size < 0) {
      // 输出缺失
      warned.push({ format, size: 0, missing: true })
      return Promise.resolve({ format, size: 0, action: 'warn-missing' })
    }
    if (size <= maxBytes) {
      return limit.autoDelete
        ? cleanupRetryVersions(item, format).then(() => null)
        : Promise.resolve(null)
    }

    if (!limit.autoQuality) {
      warned.push({ format, size })
      const result = { format, size, action: 'warn' }
      return limit.autoDelete
        ? cleanupRetryVersions(item, format).then(() => result)
        : Promise.resolve(result)
    }

    // 每种格式独立从原始质量起跑，上一格式降低的质量不能串给下一格式。
    item.options.quality = {
      checked: baseQuality.checked,
      value: baseQuality.value
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
      if (tries >= limit.maxTries) {
        appLog.warn(i18n.t('logGateExhausted', {
          fmt: format,
          tries: tries,
          size: formatMB(size),
          max: formatLimit(maxBytes)
        }))
        warned.push({ format, size, tries })
        return Promise.resolve({ format, size, action: 'warn-after-tries', tries })
      }

      const startQ = isFinite(baseQuality.value) ? baseQuality.value : 80
      const attempt = tries + 1
      const nextQ = Math.max(1, startQ - limit.step * attempt)
      if (nextQ >= Number(item.options.quality.value)) {
        // 已到质量下限，不再空转
        warned.push({ format, size, tries })
        return Promise.resolve({ format, size, action: 'warn-floor', tries })
      }
      item.options.quality.checked = true
      item.options.quality.value = nextQ
      triesUsed = Math.max(triesUsed, attempt)

      const targetPath = limit.autoDelete
        ? outPath
        : retryOutputPathFor(item, format, attempt + 1)
      if (!limit.autoDelete) { versioned.push(targetPath) }
      appLog.warn(i18n.t('logGateRetry', {
        fmt: format,
        tries: attempt,
        size: formatMB(size),
        max: formatLimit(maxBytes)
      }))

      store.dispatch('editProcess', {
        index: item.index,
        text: (locale.sizeLimitRetry || 'Size over limit, quality→') + nextQ +
          ' (' + formatMB(size) + ' > ' + formatLimit(maxBytes) + ') ' + attempt + '/' + limit.maxTries,
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
      if (limit.autoDelete && (!result || result.action === 'warn-after-tries' || result.action === 'warn-floor')) {
        return cleanupRetryVersions(item, format).then(() => result)
      }
      return result
    })
  }

  return formats.reduce(function (chain, format) {
    return chain.then(() => checkOne(format))
  }, Promise.resolve()).then(() => {
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
      schedule: 1
    })
    return { enforced: true, versioned, warned, triesUsed }
  })
}
