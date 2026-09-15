// 输出路径策略：output/ 旁级 自定义 + 变量
import { path as npath } from './node-env'

/**
 * 从「options 容器」或「已解开的 outputTo 对象」里取出 outputTo。
 * 历史上两种传法都出现过，传错时 mode 会静默兜底成 'output'，
 * 表现为「点了旁级但弹回 output」，这里统一容错。
 */
function pickOutputTo (holder) {
  if (!holder || typeof holder !== 'object') { return {} }
  if (holder.outputTo && typeof holder.outputTo === 'object') { return holder.outputTo }
  if ('mode' in holder || 'template' in holder || 'customPath' in holder) { return holder }
  return {}
}

export function normalizeOutputTo (holder) {
  const o = pickOutputTo(holder)
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
 * 变量上下文：供 resolveVars 展开，也供界面做路径模板的实时预览
 */
export function outputContext (item) {
  const srcPath = sourceDirOf(item)
  const name = (item && item.options && item.options.outputName) || ''
  const type = (item && item.basic && item.basic.type) || ''
  const src = srcPath ? npath.basename(srcPath) : ''
  const parent = srcPath ? npath.dirname(srcPath) : ''
  const d = new Date()
  const date = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')

  return { name, src, type, srcPath, parent, date }
}

/**
 * 预设：分段控件只是往「变量路径」里填一段模板，不再是独立的状态机。
 * 这样预设、手输变量、文件夹选择三种入口最终都收敛到同一个字段。
 * 预设 1 原为 {srcPath}/output（总在同级建 output 目录），已改为直接输出到源目录。
 */
export const PATH_PRESETS = [
  { value: 'output', template: '{srcPath}' },
  { value: 'beside', template: '{parent}' }
]

// Windows 下 join 会产出反斜杠，比较预设时统一成 / 再比
function slashNorm (s) {
  return String(s || '').replace(/[\\/]+/g, '/')
}

/** 当前模板命中哪个预设；返回 '' 表示自定义 */
export function activePresetOf (holder) {
  const tpl = (normalizeOutputTo(holder).template || '').trim()
  if (!tpl) { return '' }
  const hit = PATH_PRESETS.filter(function (p) {
    return slashNorm(p.template) === slashNorm(tpl)
  })
  return hit.length ? hit[0].value : ''
}

/**
 * 计算输出目录
 * 模板非空 → 直接展开模板（唯一真相源）
 * 模板为空 → 兼容历史数据，按 mode / customPath 兜底
 */
export function resolveOutputPath (item, options) {
  const ctx = outputContext(item)
  const o = normalizeOutputTo(options || item.options)
  const tpl = (o.template || '').trim()

  if (tpl) { return resolveVars(tpl, ctx) }

  if (!ctx.srcPath) { return o.customPath || '' }
  if (o.mode === 'beside') { return ctx.parent || ctx.srcPath }
  if (o.customPath && o.customPath.trim()) { return resolveVars(o.customPath.trim(), ctx) }
  // 历史数据（模板为空、mode=output）：直接输出到源目录，不再追加 /output
  return ctx.srcPath || ''
}

export function outputPathPreviewLabel (o) {
  const mode = normalizeOutputTo(o).mode
  if (mode === 'output') { return '{源目录}' }
  if (mode === 'beside') { return '{源目录}/../（旁级）' }
  return '{自定义目录}'
}
