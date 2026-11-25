/**
 * 防覆盖的纯计算层（桌面 / CEP 共用）。
 *
 * 这里不读盘、不弹窗：碰撞判定只接受调用方传入的文件路径与 exists 回调，
 * 方便 L1 沙箱直接断言；真正的 notice.confirm / warning 在 store 的 preflight action。
 */
import { path } from './node-env'
import { outputNameFor } from './outputName'
import { basenameNoExt } from './pathUtil'

export const EXTENSIONS = { APNG: '.png', GIF: '.gif', WEBP: '.webp' }
export const SUFFIX_FORMATS = ['APNG', 'GIF', 'WEBP']

/** 路径比较统一斜杠 + 小写（Windows 文件系统语义） */
export function normalizePath (p) {
  return String(p || '').replace(/\\/g, '/').toLowerCase()
}

export function outputPathFor (dir, name, format) {
  const ext = EXTENSIONS[String(format || '').toUpperCase()] || '.png'
  return path.join(String(dir || ''), String(name || '') + ext)
}

export function isSourcePath (target, sourceFiles) {
  const t = normalizePath(target)
  return (sourceFiles || []).some(function (f) { return normalizePath(f) === t })
}

/**
 * 单文件导入时：对每种输出格式计算「base.ext」是否正好落回源文件。
 * 命中返回该格式名（大写），调用方点亮对应后缀胶囊——加后缀后目标就不再是源文件。
 * （源文件名本身已带 _apng 时同样命中 base.ext，结果仍是加后缀，源文件不会被覆盖。）
 */
export function detectSourceCollision (sourceFile, outputDir, baseName, formats) {
  const list = Array.isArray(formats) && formats.length ? formats : SUFFIX_FORMATS
  for (let i = 0; i < list.length; i++) {
    const fmt = String(list[i] || '').toUpperCase()
    if (!EXTENSIONS[fmt]) continue
    if (isSourcePath(outputPathFor(outputDir, baseName, fmt), [sourceFile])) return fmt
  }
  return ''
}

/** 落盘前保底：目标命中源文件时追加 _1（必要时递增），否则原样返回 */
export function fallbackRenameForSource (target, sourceFiles) {
  if (!isSourcePath(target, sourceFiles)) return target
  const dir = path.dirname(target)
  const base = path.basename(target)
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let n = 1
  while (true) {
    const candidate = path.join(dir, stem + '_' + n + ext)
    if (!isSourcePath(candidate, sourceFiles)) return candidate
    n++
  }
}

/**
 * 预检阶段的「加后缀另存」计划：撞源的目标 → 保底改名后的目标（cool.png → cool_1.png）。
 * 与落盘时 processor 用的 fallbackRenameForSource 是同一个函数，保证弹窗按钮上承诺的
 * 文件名和真正落盘的文件名一致（不会出现「说是 cool_1，实际落 cool_2」）。
 */
export function planSourceRename (rows) {
  return (rows || []).map(function (row) {
    const sources = ((row.item && row.item.basic && row.item.basic.fileList) || [])
    const renamed = fallbackRenameForSource(row.path, sources)
    return {
      item: row.item,
      format: String(row.format || '').toUpperCase(),
      path: row.path,
      renamed: renamed,
      name: basenameNoExt(renamed),
      file: path.basename(renamed),
      changed: renamed !== row.path
    }
  })
}

/**
 * 开始转换前的冲突分类：
 *   source  = 目标 === 源文件（必须阻断确认）
 *   existing= 目标已存在但不是源（仅 warning）
 * exists 由调用方注入（fs.existsSync），保持本函数纯；路径去重。
 */
export function classifyOutputConflicts (items, exists) {
  const sources = []
  ;(items || []).forEach(function (item) {
    const list = ((item && item.basic && item.basic.fileList) || [])
    list.forEach(function (f) { sources.push(f) })
  })
  const sourceKeys = sources.map(normalizePath)
  const sourceSet = {}
  sourceKeys.forEach(function (k) { sourceSet[k] = true })

  const seen = {}
  const result = { source: [], existing: [] }
  ;(items || []).forEach(function (item) {
    const basic = (item && item.basic) || {}
    const options = (item && item.options) || {}
    const formats = Array.isArray(options.outputFormat) ? options.outputFormat : []
    formats.forEach(function (fmt) {
      const file = path.join(basic.outputPath, outputNameFor(item, fmt) + (EXTENSIONS[String(fmt).toUpperCase()] || '.png'))
      const key = normalizePath(file)
      if (!key || seen[key]) return
      seen[key] = true
      // format 随行返回：调用方要按「格式」决定改名写进哪个 outputNameOverride 槽位，
      // 缺了它就无法只给撞源的那个格式改名（会连带把 gif/webp 也改掉）。
      if (sourceSet[key]) result.source.push({ item: item, path: file, format: String(fmt).toUpperCase() })
      else if (typeof exists === 'function' && exists(file)) result.existing.push({ item: item, path: file, format: String(fmt).toUpperCase() })
    })
  })
  return result
}
