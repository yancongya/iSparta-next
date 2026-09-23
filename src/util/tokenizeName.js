/**
 * 输出名智能分词
 *
 * 把「项目A-角色待机 序列_输出」这样的混合命名切成保留分隔符的 token 序列：
 *   项目A | - | 角色待机 | (空格) | 序列 | _ | 输出
 *
 * 分隔符单独成 token，用户就能通过点掉某些胶囊来决定最终名字
 * （例如只留「角色待机 序列」拼成 角色待机序列）。
 */

// 连续汉字 / 连续字母 / 连续数字 / 单个其它字符（分隔符逐个字，便于精确点掉）
const TOKEN_RE = /[\u4e00-\u9fff]+|[A-Za-z]+|\d+|[^A-Za-z0-9\u4e00-\u9fff]/g
const SEP_RE = /^[^A-Za-z0-9\u4e00-\u9fff]+$/

/**
 * @param {string} name
 * @returns {Array<{text: string, sep: boolean}>}
 */
export function tokenizeName (name) {
  if (!name) { return [] }
  const parts = String(name).match(TOKEN_RE) || []
  return parts.map(function (text) {
    return { text: text, sep: SEP_RE.test(text) }
  })
}

/** 由 token 列表拼回名字（只取被选中的） */
export function joinTokens (tokens) {
  return (tokens || []).reduce(function (acc, t) {
    return t.on === false ? acc : acc + t.text
  }, '')
}

/**
 * 初始输出名：桌面 file.js 与 CEP 合成共用。
 * tokenizeName/joinTokens 同规则（分隔符保留），再去掉空格（与历史 .replace(/[ ]/g, '') 一致）；
 * outputSuffix 非空才拼 `_suffix`，避免悬尾下划线。
 */
export function buildInitialOutputName (baseName, options) {
  const tokens = tokenizeName(baseName || '')
  const joined = joinTokens(
    tokens
      .filter(function (t) { return t.text !== ' ' })
      .map(function (t) { return { text: t.text, sep: t.sep, on: true } })
  )
  const suffix = options && options.outputSuffix
  return suffix ? joined + '_' + suffix : joined
}

export default tokenizeName
