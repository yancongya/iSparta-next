/**
 * 输出名解析：把「基础名 + 冲突后缀」收敛到一处。
 *
 * 背景：outputName 是单一共享字段，三个输出格式共用。旧实现把 _{format} 直接
 * 拼进 outputName，导致导入 cool.png 勾 PNG/GIF/WEBP 时，三个产物都叫
 * cool_apng.*。但真正会覆盖源文件的只有与源同名的那一个格式（APNG→.png），
 * 其余格式（.gif/.webp）根本不冲突，不该跟着加后缀。
 *
 * 新实现：options.conflictFormat 记录「哪个格式撞了源文件」（大写格式名），
 * outputNameFor(item, format) 仅在该格式上加 _{小写格式名}。
 * 落盘路径与产物查找路径必须都走这里，否则会出现「生成 A 名、找 B 名」。
 *
 * 旧任务没有 conflictFormat → 读到空 → 沿用 outputName 原值（含旧后缀），
 * 行为完全不变，避免迁移改写用户已有配置。
 */

/**
 * 按格式解析该任务的实际输出名（不含扩展名）。
 * @param {object} item 任务对象（取 options.outputName / options.conflictFormat）
 * @param {string} format 格式名（APNG / GIF / WEBP）
 */
export function outputNameFor (item, format) {
  const options = (item && item.options) || {}
  const base = String(options.outputName || '')
  const f = String(format || '').toUpperCase()
  if (!f) return base
  // 一次性覆盖（跨任务同名「另存」）：只服务本次转换，processor 深拷贝带走后落盘，
  // 下次 preflight 入口清除 → 任务名回基础名 → 跨任务冲突重新识别、重新弹窗。
  // 优先于持久 override：同一轮里 transient 就是用户刚做的最新选择。
  const transient = (item && item.basic && item.basic.transientNameOverride) || {}
  if (transient[f]) return String(transient[f])
  // 持久化改名（撞源另存 / 落盘保底）：写进 basic.outputNameOverride（per-format，
  // 不污染共享的 outputName，否则又会三个格式一起变名）
  const overrides = (item && item.basic && item.basic.outputNameOverride) || {}
  if (overrides[f]) return String(overrides[f])
  const conflict = String(options.conflictFormat || '').toUpperCase()
  const enabled = options.suffixEnabled !== false
  return (enabled && conflict === f) ? base + '_' + f.toLowerCase() : base
}

/**
 * 冲突后缀是否启用。缺省视为启用（旧任务没这个字段，行为与旧版一致：自动加后缀）。
 */
export function suffixEnabledOf (item) {
  const o = (item && item.options) || {}
  return o.suffixEnabled !== false
}

/**
 * 输入框里显示的名字：基础名 +（开关启用且有冲突时）冲突格式后缀。
 * outputName='cool'、conflictFormat='APNG'、开关开 → 'cool_apng'。
 * 落盘仍由 outputNameFor 按格式决定，这里只负责输入框的可视值。
 */
export function displayNameOf (item) {
  const base = String((item && item.options && item.options.outputName) || '')
  const fmt = String((item && item.options && item.options.conflictFormat) || '').toUpperCase()
  return (fmt && suffixEnabledOf(item)) ? base + '_' + fmt.toLowerCase() : base
}

/** 把输入框里的名字去掉自动追加的冲突后缀，还原成基础名 */
export function stripConflictSuffix (value, format) {
  const s = String(value || '')
  const f = String(format || '').toUpperCase()
  if (!f) return s
  const tail = '_' + f.toLowerCase()
  return s.toLowerCase().endsWith(tail) ? s.slice(0, s.length - tail.length) : s
}

/** 冲突后缀片段（用于 UI 展示），无冲突返回空串 */
export function conflictSuffixOf (item) {
  const conflict = String((item && item.options && item.options.conflictFormat) || '').toUpperCase()
  return conflict ? '_' + conflict.toLowerCase() : ''
}
