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
 * 内置预设出厂模板：分段控件只是往「变量路径」里填一段模板，不再是独立的状态机。
 * 这样预设、手输变量、文件夹选择三种入口最终都收敛到同一个字段。
 * 预设 1 原为 {srcPath}/output（总在同级建 output 目录），已改为直接输出到源目录。
 */
export const BUILTIN_PRESETS = [
  { value: 'output', labelKey: 'outputToOutput', template: '{srcPath}' },
  { value: 'beside', labelKey: 'outputToBeside', template: '{parent}' }
]
// 向后兼容旧引用名
export const PATH_PRESETS = BUILTIN_PRESETS

// Windows 下 join 会产出反斜杠，比较模板时统一成 / 再比
function slashNorm (s) {
  return String(s || '').replace(/[\\/]+/g, '/')
}

/* --------------------------------------------------------------------------
   用户可增删改的预设层
   --------------------------------------------------------------------------
   存储形态（独立 storage 键 outputPresets，不塞进 globalSetting.options：
   ITEMS_ADD 会把全局配置整个 clone 进每条任务，塞进去会让每个任务背一份副本）：

     { builtin: { output: '<改后模板>' },          // 只存被改过的内置项
       custom: [{ id, label, template }] }

   任务只保存自己的 template 快照，所以删改预设永远不会破坏已有任务。
   -------------------------------------------------------------------------- */

export function emptyPresets () {
  return { builtin: {}, custom: [] }
}

export function normalizePresets (raw) {
  const p = raw && typeof raw === 'object' ? raw : {}
  const builtin = p.builtin && typeof p.builtin === 'object' ? p.builtin : {}
  const custom = Array.isArray(p.custom) ? p.custom.filter(function (c) {
    return c && typeof c === 'object' && typeof c.template === 'string'
  }).map(function (c, i) {
    return {
      id: typeof c.id === 'string' && c.id ? c.id : 'p-' + i,
      label: typeof c.label === 'string' ? c.label : '',
      template: c.template
    }
  }) : []
  return { builtin: builtin, custom: custom }
}

/** 渲染用的完整预设列表：内置（含改后模板与 modified 标记）+ 用户预设 */
export function presetList (raw) {
  const p = normalizePresets(raw)
  const out = BUILTIN_PRESETS.map(function (b) {
    const over = p.builtin[b.value]
    const tpl = typeof over === 'string' && over.trim() ? over : b.template
    return {
      id: b.value,
      labelKey: b.labelKey,
      template: tpl,
      builtin: true,
      modified: tpl !== b.template
    }
  })
  p.custom.forEach(function (c) {
    out.push({ id: c.id, label: c.label, template: c.template, builtin: false, modified: false })
  })
  return out
}

/** 当前模板命中哪个预设 id；返回 '' 表示未收藏的自定义路径 */
export function activePresetIdOf (holder, rawPresets) {
  const tpl = (normalizeOutputTo(holder).template || '').trim()
  if (!tpl) { return '' }
  const hit = presetList(rawPresets).filter(function (x) {
    return slashNorm(x.template) === slashNorm(tpl)
  })
  return hit.length ? hit[0].id : ''
}

/** 旧签名：只按内置匹配，返回 value 或 ''（保留给未升级的调用点） */
export function activePresetOf (holder) {
  return activePresetIdOf(holder, null)
}

/* ---------- 纯函数式增删改：都返回新对象，便于 Vue 响应式赋值 ---------- */

export function setBuiltinTemplate (raw, value, template) {
  const p = normalizePresets(raw)
  const b = BUILTIN_PRESETS.filter(function (x) { return x.value === value })[0]
  if (!b) { return p }
  const builtin = Object.assign({}, p.builtin)
  // 改回出厂模板等于取消覆盖，别留脏数据
  if (!template || template.trim() === b.template) { delete builtin[value] }
  else { builtin[value] = template.trim() }
  return { builtin: builtin, custom: p.custom }
}

export function resetBuiltinTemplate (raw, value) {
  const p = normalizePresets(raw)
  const builtin = Object.assign({}, p.builtin)
  delete builtin[value]
  return { builtin: builtin, custom: p.custom }
}

export function upsertCustomPreset (raw, entry) {
  const p = normalizePresets(raw)
  if (!entry || !String(entry.template || '').trim()) { return p }
  const next = {
    id: entry.id || ('p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)),
    label: String(entry.label || '').trim(),
    template: String(entry.template).trim()
  }
  const custom = p.custom.slice()
  const at = custom.findIndex(function (c) { return c.id === next.id })
  if (at >= 0) { custom.splice(at, 1, next) } else { custom.push(next) }
  return { builtin: p.builtin, custom: custom }
}

export function removeCustomPreset (raw, id) {
  const p = normalizePresets(raw)
  return { builtin: p.builtin, custom: p.custom.filter(function (c) { return c.id !== id }) }
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
