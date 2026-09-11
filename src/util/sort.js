/**
 * 帧序自然排序
 *
 * 修复 file_10 排在 file_2 之前导致的导出帧错乱：把文件名里的每段数字
 * 左补零到固定宽度后再比较，使 2 / 10 / 100 按数值顺序排列。
 *
 * 此前提取散落在 4 处（LandingPage / Home / projectList / mainUpload）的
 * 同一份实现，统一走这里。
 */

const PAD = 8
const ZERO = '0'

function padNumber (digits) {
  if (digits.length >= PAD) return digits
  return ZERO.repeat(PAD - digits.length) + digits
}

/** 生成可比较的键：所有数字段补零 */
export function sortKey (name) {
  if (!name || typeof name !== 'string') return ''
  return name.replace(/(\d+)/g, (m) => padNumber(m))
}

/**
 * Array.prototype.sort 比较器
 * 用法：fileList.sort(naturalSort)
 */
export function naturalSort (a, b) {
  const ka = sortKey(a)
  const kb = sortKey(b)
  if (ka === kb) return 0
  return ka > kb ? 1 : -1
}

export default naturalSort
