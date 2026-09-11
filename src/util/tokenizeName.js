/**
 * 输出名智能分词
 *
 * 把「英巴区-户外野餐 挂件_输出」这样的混合命名切成保留分隔符的 token 序列：
 *   英巴区 | - | 户外野餐 | (空格) | 挂件 | _ | 输出
 *
 * 分隔符单独成 token，用户就能通过点掉某些胶囊来决定最终名字
 * （例如只留「英巴区 户外野餐 挂件」拼成 英巴区户外野餐挂件）。
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

export default tokenizeName
