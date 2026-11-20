// 全局默认偏好（globalSetting）的纯函数补丁工具。
// 背景：任务设置面板的「开启压缩」总开关是单项编辑（writeOptions），但新导入任务从
//   globalSetting 派生（store ITEMS_ADD）。若总开关不落 globalSetting，用户关掉压缩后
//   导入的新序列仍拿到旧的 preserveBitDepth=false → 走量化出 8-bit（issue #3 反馈 02）。
// 这里只处理「压缩总开关」这一组的同步，其他字段（帧率/输出名等）仍是纯单项设置，不串改。
//
// 纯函数、零外部依赖：便于 L1 用 vm 沙箱直接加载测试（范式同 paletteConfig.js）。
// 不改入参，返回新对象；其余字段原样保留，旧配置零破坏。

/**
 * 把压缩总开关的变更同步进 globalSetting。
 * @param {object} globalSetting 已解析的 globalSetting 对象（可能为 null / 非法 / 缺 options）
 * @param {object} patch { preserveBitDepth:boolean, quality?:{ checked:boolean } }
 *   - preserveBitDepth 仅当为 boolean 时写入，避免 undefined/null 污染
 *   - quality.checked 仅当为 boolean 时写入，保留 quality.value 及其余字段
 * @returns {object} 新的 globalSetting 对象
 */
export function applyGlobalCompressionPatch (globalSetting, patch) {
  const src = (globalSetting && typeof globalSetting === 'object' && !Array.isArray(globalSetting))
    ? globalSetting
    : {}
  const next = Object.assign({}, src)
  const opts = (src.options && typeof src.options === 'object' && !Array.isArray(src.options))
    ? Object.assign({}, src.options)
    : {}
  const p = (patch && typeof patch === 'object') ? patch : {}

  if (typeof p.preserveBitDepth === 'boolean') {
    opts.preserveBitDepth = p.preserveBitDepth
  }
  if (p.quality && typeof p.quality.checked === 'boolean') {
    const q = (opts.quality && typeof opts.quality === 'object' && !Array.isArray(opts.quality))
      ? Object.assign({}, opts.quality)
      : {}
    q.checked = p.quality.checked
    opts.quality = q
  }

  next.options = opts
  return next
}
