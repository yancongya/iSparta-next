/**
 * 路径工具：补齐 renderer 侧 bridge 的能力缺口。
 *
 * 背景：桌面（preload）/ CEP（cep-bridge）/ mockup（mock-bridge）三套 bridge
 * 暴露的 path 方法面完全一致，只有 join / dirname / basename / sep（契约见
 * docs/BRIDGE.md §2.3）。renderer 里没有 node 的 path 对象，调用面外的方法
 * （extname / resolve / relative …）会直接抛 "path.extname is not a function"。
 *
 * 所以这里用纯字符串实现，不去扩 bridge 契约（三套 bridge + 文档要同步改，
 * 收益远小于成本）。分隔符处理与 CEP bridge 的 basename 兜底一致（/ 与 \ 都认），
 * 语义与 node 的 path.basename(p, path.extname(p)) 对齐。
 */

/**
 * 文件名（不含扩展名）。
 * 等价于 node 的 path.basename(p, path.extname(p))：
 *   'cool_1.png'        → 'cool_1'
 *   'cool.tar.gz'       → 'cool.tar'（只去最后一段扩展名）
 *   '.png'              → '.png'（前导点的隐藏文件视为无扩展名）
 *   'cool.'             → 'cool'
 */
export function basenameNoExt (p) {
  const s = String(p == null ? '' : p).replace(/[\\/]+$/, '')
  const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  const base = i < 0 ? s : s.slice(i + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}
