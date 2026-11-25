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
 *   source   = 目标 === 源文件（必须阻断确认）
 *   crossItem= 同一目标被两个不同任务写入（必须阻断确认，否则后者静默覆盖前者）
 *   existing = 目标已存在但不是源、也不是本批次其他任务的目标（仅 warning）
 * exists 由调用方注入（fs.existsSync），保持本函数纯。
 *
 * 注意 seen 不能简单地按路径丢弃重复：多任务同输出名 + 同输出目录时，
 * 两个 WEBP 会落到同一个 cool.webp，旧实现把第二个直接 return 掉，
 * 既不报 source 也不报 existing → 预检全盲、静默覆盖（6 个产物只剩 5 个）。
 * 现在按「首次拥有者」记：同任务重复才去重，不同任务同名归 crossItem。
 *
 * outputPathOverride：「输出到目录」时传入的真实落盘目录。预检必须和 processor
 * 用同一个目录，否则会出现「预检查旧目录、实际写新目录」的错判：旧目录的旧产物
 * 被误报已存在，新目录里真同名反而查不到。不传则用 item 自身 outputPath。
 */
export function classifyOutputConflicts (items, exists, outputPathOverride) {
  const sources = []
  ;(items || []).forEach(function (item) {
    const list = ((item && item.basic && item.basic.fileList) || [])
    list.forEach(function (f) { sources.push(f) })
  })
  const sourceKeys = sources.map(normalizePath)
  const sourceSet = {}
  sourceKeys.forEach(function (k) { sourceSet[k] = true })

  const seen = {}
  const result = { source: [], crossItem: [], existing: [] }
  ;(items || []).forEach(function (item) {
    const basic = (item && item.basic) || {}
    const options = (item && item.options) || {}
    const formats = Array.isArray(options.outputFormat) ? options.outputFormat : []
    // 落盘目录以 override 为准（「输出到目录」场景），与 processor 的 sameOutputPath 对齐。
    const outDir = outputPathOverride || basic.outputPath
    formats.forEach(function (fmt) {
      const file = path.join(outDir, outputNameFor(item, fmt) + (EXTENSIONS[String(fmt).toUpperCase()] || '.png'))
      const key = normalizePath(file)
      if (!key) return
      // format 随行返回：调用方要按「格式」决定改名写进哪个 outputNameOverride 槽位，
      // 缺了它就无法只给撞源的那个格式改名（会连带把 gif/webp 也改掉）。
      const row = { item: item, path: file, format: String(fmt).toUpperCase() }
      const owner = seen[key]
      if (owner) {
        // 同一任务的同一目标重复出现 → 去重；不同任务撞到同一目标 → 跨任务冲突。
        if (owner.item !== item) {
          result.crossItem.push({
            item: item,
            path: file,
            format: row.format,
            conflictWith: owner.item,
            conflictPath: owner.path
          })
        }
        return
      }
      seen[key] = row
      if (sourceSet[key]) result.source.push(row)
      else if (typeof exists === 'function' && exists(file)) result.existing.push(row)
    })
  })
  return result
}

/**
 * 列出本批次所有任务的落盘目标（按格式展开），供跨任务改名时避让。
 * 与 classifyOutputConflicts 用同一套 outputNameFor + outputPathOverride 口径。
 */
export function allOutputTargets (items, outputPathOverride) {
  const rows = []
  ;(items || []).forEach(function (item) {
    const basic = (item && item.basic) || {}
    const options = (item && item.options) || {}
    const formats = Array.isArray(options.outputFormat) ? options.outputFormat : []
    const outDir = outputPathOverride || basic.outputPath
    formats.forEach(function (fmt) {
      const f = String(fmt).toUpperCase()
      rows.push({
        item: item,
        format: f,
        path: path.join(outDir, outputNameFor(item, f) + (EXTENSIONS[f] || '.png'))
      })
    })
  })
  return rows
}

/**
 * 跨任务同名的「加后缀另存」计划：给后一个任务生成不撞车的目标名。
 * 候选会同时避开 occupied（本批次所有目标）与 exists（磁盘已存在），
 * 与 planSourceRename 一样返回 name/file 供弹窗承诺和落盘保持一致。
 */
export function planCrossItemRename (rows, occupied, exists) {
  const taken = {}
  ;(occupied || []).forEach(function (p) { taken[normalizePath(p)] = true })
  const isTaken = function (p) {
    if (taken[normalizePath(p)]) return true
    return typeof exists === 'function' && exists(p)
  }
  return (rows || []).map(function (row) {
    const target = row.path
    const dir = path.dirname(target)
    const base = path.basename(target)
    const dot = base.lastIndexOf('.')
    const stem = dot > 0 ? base.slice(0, dot) : base
    const ext = dot > 0 ? base.slice(dot) : ''
    let candidate = target
    let n = 1
    while (isTaken(candidate)) {
      candidate = path.join(dir, stem + '_' + n + ext)
      n++
    }
    taken[normalizePath(candidate)] = true
    return {
      item: row.item,
      format: String(row.format || '').toUpperCase(),
      path: target,
      renamed: candidate,
      name: basenameNoExt(candidate),
      file: path.basename(candidate),
      changed: candidate !== target
    }
  })
}
