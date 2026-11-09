/**
 * 任务运行状态与产物的单一实现（任务列表 / 顶栏复制 / 合成树共用）。
 *
 * 之前 projectList.vue（列表显示）与 Home.vue（顶栏复制）各自维护了一份
 * 「outputName + 格式扩展名 → 产物路径」和大小格式化；合成树状态列也要用，
 * 因此收口到这里：状态判定、主产物、含阈值重试版本的候选、存在性过滤、大小与 tooltip。
 *
 * fs / path 一律走 node-env 桥，渲染层不直接碰 window.process / require('fs')。
 */
import { fs, path } from './node-env'

const EXTENSIONS = { APNG: '.png', GIF: '.gif', WEBP: '.webp' }

/** schedule: 0/undefined 待处理，(0,1) 进行中，1 成功，-1 失败 */
export function stateOf (process) {
  const s = process && process.schedule
  if (s === 1) return 'done'
  if (s === -1) return 'fail'
  if (s > 0 && s < 1) return 'running'
  return 'pending'
}

/** 与任务列表状态点同一套图标 */
export function statusIcon (process) {
  switch (stateOf(process)) {
    case 'done': return 'check-circle'
    case 'fail': return 'x-circle'
    case 'running': return 'loader'
    default: return 'clock'
  }
}

/** 主产物路径（与 projectList 原 outputFilesOf 同语义，不含重试版本） */
export function outputFilesOf (item) {
  const basic = (item && item.basic) || {}
  const options = (item && item.options) || {}
  const formats = options.outputFormat || []
  if (!basic.outputPath || !options.outputName || !formats.length) return []
  return formats.map(function (format) {
    const ext = format === 'GIF' ? '.gif' : format === 'WEBP' ? '.webp' : '.png'
    return path.join(basic.outputPath, options.outputName + ext)
  })
}

/**
 * 含大小阈值重试版本的候选路径（与顶栏复制原逻辑一致）。
 * autoDelete 关闭且启用自动降质时，转换器会保留 name_v2.. 等版本，复制需一并带上。
 */
export function outputCandidatesOf (item) {
  const basic = (item && item.basic) || {}
  const options = (item && item.options) || {}
  const dir = basic.outputPath || ''
  const name = options.outputName || ''
  if (!dir || !name) return []
  const sizeLimit = options.sizeLimit || {}
  const keepRetryVersions = !sizeLimit.autoDelete && sizeLimit.autoQuality !== false
  const retryCount = keepRetryVersions
    ? Math.max(0, Math.floor(Number(sizeLimit.maxTries) || 0))
    : 0
  const files = []
  const formats = Array.isArray(options.outputFormat) ? options.outputFormat : []
  formats.forEach(function (format) {
    const ext = EXTENSIONS[String(format).toUpperCase()]
    if (!ext) return
    files.push(path.join(dir, name + ext))
    for (let version = 2; version <= retryCount + 1; version++) {
      files.push(path.join(dir, name + '_v' + version + ext))
    }
  })
  return files
}

/** 只保留真实存在的产物（去重），供复制与产物大小使用 */
export function existingOutputFilesOf (item) {
  const files = []
  outputCandidatesOf(item).forEach(function (file) {
    try {
      if (fs.existsSync(file) && files.indexOf(file) < 0) files.push(file)
    } catch (e) { /* 跳过已被移动或删除的输出 */ }
  })
  return files
}

/** 汇总字节数；任一文件不可读返回 -1（不把缺文件当成 0 字节） */
export function sizeBytesOfFiles (files) {
  if (!files || !files.length) return -1
  const sizes = files.map(function (file) {
    try {
      const size = fs.statSize(file)
      return typeof size === 'number' && size >= 0 ? size : -1
    } catch (e) { return -1 }
  })
  if (sizes.some(function (size) { return size < 0 })) return -1
  return sizes.reduce(function (sum, size) { return sum + size }, 0)
}

/** 与任务列表原 outputSizeOf 同一格式：KB / MB */
export function sizeTextOfFiles (files) {
  const bytes = sizeBytesOfFiles(files)
  if (bytes <= 0) return ''
  return bytes < 1024 * 1024
    ? (bytes / 1024).toFixed(1) + ' KB'
    : (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

/** hover 完整信息：逐文件列出路径与精确字节数 */
export function sizeTipOfFiles (files) {
  return (files || []).map(function (file) {
    let size = -1
    try {
      const r = fs.statSize(file)
      size = typeof r === 'number' && r >= 0 ? r : -1
    } catch (e) { /* 不可读取 */ }
    return file + ' — ' + (size >= 0 ? size.toLocaleString() + ' B' : '不可读取')
  }).join('\n')
}

/** 任务列表显示用的便捷封装（保持主产物语义不变） */
export function outputSizeOf (item) {
  return sizeTextOfFiles(outputFilesOf(item))
}

export function outputSizeTip (item) {
  return sizeTipOfFiles(outputFilesOf(item))
}
