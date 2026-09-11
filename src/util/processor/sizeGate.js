// 输出文件大小阈值：检测 / 超限警告 / 自动删 / 自动降质量重压
import { fs, path } from '../node-env'
import apngCompress from './apngCompress'
import apng2gif from './apng2gif'
import apng2webp from './apng2webp'
import TYPE from '../../store/enum/type'

export function normalizeSizeLimit (options) {
  const s = (options && options.sizeLimit) || {}
  const maxMB = Number(s.maxMB)
  const step = Number(s.step)
  const maxTries = Number(s.maxTries)
  return {
    enabled: !!s.enabled,
    maxMB: isFinite(maxMB) && maxMB > 0 ? maxMB : 1,
    autoDelete: !!s.autoDelete,
    autoQuality: s.autoQuality !== false,
    step: isFinite(step) && step > 0 ? step : 5,
    maxTries: isFinite(maxTries) && maxTries > 0 ? Math.floor(maxTries) : 10
  }
}

export function formatMB (bytes) {
  if (!bytes || bytes < 0) { return '?' }
  return (bytes / 1024 / 1024).toFixed(2) + 'MB'
}

function outputPathFor (item, format) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.outputPath, item.options.outputName + ext)
}

function tmpPathFor (item, format) {
  const ext = format === TYPE.GIF ? '.gif' : format === TYPE.WEBP ? '.webp' : '.png'
  return path.join(item.basic.tmpOutputDir, item.options.outputName + ext)
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

function reExportFormat (item, format, store, locale) {
  if (format === TYPE.APNG) {
    return fs.copy(
      path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
      outputPathFor(item, TYPE.APNG)
    )
  }
  if (format === TYPE.GIF) {
    return apng2gif(item, store, locale).then(() => {
      return fs.copy(tmpPathFor(item, TYPE.GIF), outputPathFor(item, TYPE.GIF))
    })
  }
  if (format === TYPE.WEBP) {
    return apng2webp(item, store, locale).then(() => {
      return fs.copy(tmpPathFor(item, TYPE.WEBP), outputPathFor(item, TYPE.WEBP))
    })
  }
  return Promise.resolve()
}

/**
 * 逐格式检查输出大小；超限则按 step 降质量重压，直到达标或达 maxTries。
 * 仍超限：autoDelete 则删除，否则保留并警告。
 */
export function enforceSizeLimit (item, store, locale) {
  const limit = normalizeSizeLimit(item.options)
  if (!limit.enabled || !item.options.outputFormat || !item.options.outputFormat.length) {
    return Promise.resolve({ enforced: false })
  }

  const maxBytes = limit.maxMB * 1024 * 1024
  const formats = item.options.outputFormat.slice()
  let deleted = []
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
      return Promise.resolve(null)
    }

    if (!limit.autoQuality) {
      if (limit.autoDelete) {
        return fs.remove(outPath).then(() => {
          deleted.push(format)
          return { format, size, action: 'delete' }
        })
      }
      warned.push({ format, size })
      return Promise.resolve({ format, size, action: 'warn' })
    }

    // 自动降质量重压（从 baseQuality 起算）
    function retry (tries) {
      size = fs.statSize(outPath)
      if (size < 0) {
        warned.push({ format, size: 0, missing: true })
        return Promise.resolve({ format, size: 0, action: 'warn-missing' })
      }
      if (size <= maxBytes) {
        return Promise.resolve(null)
      }
      if (tries >= limit.maxTries) {
        if (limit.autoDelete) {
          return fs.remove(outPath).then(() => {
            deleted.push(format)
            return { format, size, action: 'delete-after-tries', tries }
          })
        }
        warned.push({ format, size, tries })
        return Promise.resolve({ format, size, action: 'warn-after-tries', tries })
      }

      if (!item.options.quality) {
        item.options.quality = { checked: true, value: baseQuality.value }
      }
      item.options.quality.checked = true
      const startQ = isFinite(baseQuality.value) ? baseQuality.value : 80
      const nextQ = Math.max(1, startQ - limit.step * (tries + 1))
      if (nextQ === Number(item.options.quality.value) && tries > 0) {
        // 已到质量下限，不再空转
        if (limit.autoDelete) {
          return fs.remove(outPath).then(() => {
            deleted.push(format)
            return { format, size, action: 'delete-floor', tries }
          })
        }
        warned.push({ format, size, tries })
        return Promise.resolve({ format, size, action: 'warn-floor', tries })
      }
      item.options.quality.value = nextQ
      triesUsed = Math.max(triesUsed, tries + 1)

      store.dispatch('editProcess', {
        index: item.index,
        text: (locale.sizeLimitRetry || 'Size over limit, quality→') + nextQ +
          ' (' + formatMB(size) + ' > ' + limit.maxMB + 'MB) ' + (tries + 1) + '/' + limit.maxTries,
        schedule: 0.85
      })

      restoreMasterApng(item)
      return apngCompress(item, 0, store, locale)
        .then(() => reExportFormat(item, format, store, locale))
        .then(() => retry(tries + 1))
        .catch((err) => {
          warned.push({ format, size, error: String(err && err.err || err) })
          return { format, size, action: 'warn-error' }
        })
    }

    return retry(0)
  }

  return formats.reduce(function (chain, format) {
    return chain.then(() => checkOne(format))
  }, Promise.resolve()).then(() => {
    let text = locale.convertSuccess + '！'
    if (deleted.length) {
      text = (locale.sizeLimitDeleted || 'Over limit, deleted') + ': ' + deleted.join(', ')
    } else if (warned.length) {
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
    return { enforced: true, deleted, warned, triesUsed }
  })
}
