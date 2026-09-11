// 输出路径策略：output/ 旁级 自定义 + 变量
import { path as npath } from '../node-env'

export function normalizeOutputTo (options) {
  const o = (options && options.outputTo) || {}
  const mode = o.mode === 'beside' || o.mode === 'custom' ? o.mode : 'output'
  return {
    mode: mode,
    customPath: typeof o.customPath === 'string' ? o.customPath : '',
    template: typeof o.template === 'string' ? o.template : ''
  }
}

export function sourceDirOf (item) {
  const input = item && item.basic && item.basic.inputPath
  if (!input) { return '' }
  if (item.basic.type === 'PNGs') {
    return input
  }
  // 单文件：inputPath 为 address + '/' + base（无扩展），取其上级目录
  const list = item.basic.fileList
  if (list && list[0]) {
    return npath.dirname(list[0])
  }
  return npath.dirname(input)
}

export function resolveVars (text, ctx) {
  if (!text) { return '' }
  return String(text).replace(/\{([a-zA-Z]+)\}/g, (m, key) => {
    if (key === 'name') { return ctx.name || '' }
    if (key === 'src') { return ctx.src || '' }
    if (key === 'type') { return ctx.type || '' }
    if (key === 'srcPath') { return ctx.srcPath || '' }
    if (key === 'parent') { return ctx.parent || '' }
    if (key === 'date') { return ctx.date || '' }
    return m
  })
}

/**
 * 计算输出目录
 * mode=output  → {源目录}/output
 * mode=beside  → {源目录}/../  （源目录旁级）
 * mode=custom  → customPath 或 template 展开变量
 */
export function resolveOutputPath (item, options) {
  const o = normalizeOutputTo(options || item.options)
  const srcPath = sourceDirOf(item)
  const name = (item && item.options && item.options.outputName) || ''
  const type = (item && item.basic && item.basic.type) || ''
  const src = srcPath ? npath.basename(srcPath) : ''
  const parent = srcPath ? npath.dirname(srcPath) : ''
  const d = new Date()
  const date = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')

  const ctx = { name, src, type, srcPath, parent, date }

  if (!srcPath) {
    return o.customPath || ''
  }

  if (o.mode === 'output') {
    return npath.join(srcPath, 'output')
  }
  if (o.mode === 'beside') {
    return parent || srcPath
  }
  // custom
  if (o.template && o.template.trim()) {
    const expanded = resolveVars(o.template.trim(), ctx)
    if (expanded) { return expanded }
  }
  if (o.customPath && o.customPath.trim()) {
    return resolveVars(o.customPath.trim(), ctx)
  }
  return npath.join(srcPath, 'output')
}

export function outputPathPreviewLabel (o) {
  const mode = normalizeOutputTo(o).mode
  if (mode === 'output') { return '{源目录}/output' }
  if (mode === 'beside') { return '{源目录}/../（旁级）' }
  return '{自定义目录}'
}
