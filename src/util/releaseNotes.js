/**
 * 应用内「更新日志」读取层：两端共用，不读文件系统、不发网络请求。
 *
 * 数据来源：scripts/bake-release-notes.js 从 .github/release-notes/*.md 烘焙的纯数据；
 * 格式化复用 updateCheck.js 的 formatReleaseNotes —— 与「检查更新」弹窗同一套纯文本口径
 * （`· 条目` 摘要 + `【新增】/【修复】/【文档】` 分组），不在 UI 层再写一份解析。
 */
import { RELEASE_NOTES, RELEASE_VERSIONS } from '../generated/releaseNotes'
import { formatReleaseNotes } from './updateCheck'
import { APP_VERSION } from '../brand'

const cache = Object.create(null)

function cleanVersion (version) {
  return String(version || '').trim().replace(/^v/i, '')
}

/** 取指定版本的可读日志；无编辑源或格式化后为空时返回 null */
export function notesForVersion (version) {
  var v = cleanVersion(version)
  var raw = RELEASE_NOTES[v]
  if (!raw) { return null }
  if (cache[v] === undefined) {
    var text = formatReleaseNotes(String(raw).replace(/\{\{TAG\}\}/g, 'v' + v))
    cache[v] = text || ''
  }
  return cache[v] || null
}

/** 当前安装包版本由 package.json 单一来源决定（见 brand.js） */
export function currentVersion () {
  return cleanVersion(APP_VERSION)
}

export function currentNotes () {
  return notesForVersion(currentVersion())
}

/** 倒序版本列表（新 → 旧），供弹窗内切换历史日志 */
export function versionList () {
  return RELEASE_VERSIONS.slice()
}

export default {
  notesForVersion,
  currentVersion,
  currentNotes,
  versionList
}
