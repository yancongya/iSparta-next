/**
 * Release Notes 覆盖门禁（本地清单 + CI 机检，纯 Node + git）
 *
 * 用法：
 *   node scripts/release-notes-scope.js [tag]                 # 列「上一版 tag..本版」提交清单（写文案前先跑）
 *   node scripts/release-notes-scope.js [tag] --prev vX.Y.Z   # 显式指定上一版 tag（CI 用）
 *   node scripts/release-notes-scope.js [tag] --check         # 机检：文案声明数 == 实际提交数，否则 exit 1
 *   node scripts/release-notes-scope.js [tag] --json          # 输出 JSON（供守卫/工具消费）
 *
 * tag 省略时取当前工作树 HEAD 对应的版本：优先 package.json.version（本地未 bump），
 * CI 里由调用方显式传 tag。prev 省略时自动 git describe 最近tag并排除本版 tag。
 *
 * 为什么要这个门禁（v3.10.3 真实事故）：
 *   v3.10.3 的 release notes 只写了最近几天（更新日志/CEP 铺满/欢迎页），漏掉整周
 *   47 个提交里的防覆盖三选、toast 统一、任务条/对比弹窗重做、调试日志、路径越界
 *   崩溃等一大批用户可见改动。根因是「只看最近 commit 写文案」，没有逐条回溯本版
 *   全部提交。Commit 与 Release 文案刻意分离，CI 此前只校验结构/摘要条数，无法发现
 *   「文案漏掉了某个功能」。本脚本把「必须看过本版全部提交」变成可机检的硬门禁：
 *
 *   1) 写文案前先跑 `node scripts/release-notes-scope.js <tag>`，逐条核对清单；
 *   2) 在文案 details 内加一行声明：`<!-- RELEASE_SCOPE: N -->`，N = 清单里的提交数；
 *   3) CI 在 bump 前跑 `--check`，用同一口径独立算提交数，与声明不符即中止发版。
 *
 * 声明用 HTML 注释：GitHub 网页渲染隐藏、src/util/updateCheck.js 的 formatReleaseNotes
 * 会把 `<...>` 清掉，不污染 App 更新弹窗；但 CI 和守卫能读原始文本。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const NOTES_DIR = path.join(ROOT, '.github', 'release-notes')
const DECL_RE = /<!--\s*RELEASE_SCOPE:\s*(\d+)\s*-->/i
// 完全不计入清单的提交：发版 bump、merge 等纯 release 噪音
const EXCLUDE_RE = /^(chore\(release\)|Merge\b|chore:\s*bump|chore:\s*version)/i
// 非用户可见 scope：本地预览台 / 守卫脚本 / mock 基础设施，不计入「需覆盖」数。
// 依据：这些改动只作用于开发预览（:8090 控制台、guide-preview）、CI 守卫或测试替身，
// 不进入发布产物行为（v3.10.3 事故复盘：预览台光晕反复迭代十几笔，不该绑架文案计数）。
const INTERNAL_SCOPE_RE = /^(feat|fix|refactor|chore|test)\((preview|guard|mockup|mock)\b/i

function git (args) {
  return execFileSync('git', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
}

function parseArgs (argv) {
  const o = { tag: null, prev: null, check: false, json: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--check') o.check = true
    else if (a === '--json') o.json = true
    else if (a === '--prev' && argv[i + 1]) o.prev = String(argv[++i]).trim()
    else if (!a.startsWith('--') && !o.tag) o.tag = String(a).trim()
  }
  return o
}

function normalizeTag (t) {
  if (!t) return null
  return String(t).startsWith('v') ? String(t) : 'v' + String(t)
}

function resolveTag (given) {
  if (given) return normalizeTag(given)
  // 本地未 bump：package.json 版本即本版；已 bump（CI resume）也一致
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  return normalizeTag(pkg.version)
}

function resolvePrev (given, tag) {
  if (given) return normalizeTag(given)
  try {
    const out = git(['describe', '--tags', '--abbrev=0', '--exclude=' + tag])
    return out.trim() || null
  } catch (e) {
    return null
  }
}

/**
 * 返回 tag 相对 prev 的「用户可见改动」提交清单。
 * ref 用 tag（CI 里 tag 已存在）；tag 不存在时回退 HEAD（本地写文案阶段）。
 */
function collect (tag, prev) {
  if (!prev) return { tag, prev: null, commits: [], count: 0, error: 'no-prev-tag' }
  let end = tag
  try { git(['rev-parse', '--verify', 'refs/tags/' + tag]) } catch (e) { end = 'HEAD' }
  const range = prev + '..' + end
  let raw
  try { raw = git(['log', range, '--no-merges', '--format=%h%x09%s']) } catch (e) {
    return { tag, prev, commits: [], count: 0, error: 'bad-range:' + range }
  }
  const lines = raw.split(/\r?\n/).filter(Boolean)
  const all = lines.map(function (line) {
    const p = line.split('\t')
    const hash = (p[0] || '').trim()
    const subject = (p.slice(1).join('\t') || '').trim()
    const m = subject.match(/^(\w+)(\([^)]*\))?(!)?:\s*(.*)$/)
    return { hash, subject, type: m ? m[1].toLowerCase() : 'other' }
  })
  const kept = all.filter(function (c) { return !EXCLUDE_RE.test(c.subject) })
  // 用户可见提交 = 需被文案覆盖；内部提交单列，供写文案的人参考但不计入声明数
  const commits = kept.filter(function (c) { return !INTERNAL_SCOPE_RE.test(c.subject) })
  const internal = kept.filter(function (c) { return INTERNAL_SCOPE_RE.test(c.subject) })
  const byType = {}
  commits.forEach(function (c) { byType[c.type] = (byType[c.type] || 0) + 1 })
  return {
    tag, prev, ref: end, range, commits, internal,
    count: commits.length, byType,
    excluded: all.length - kept.length, internalCount: internal.length
  }
}

function groupLines (data) {
  if (data.error) return ['  （无法计算提交清单：' + data.error + '）']
  const order = ['feat', 'fix', 'refactor', 'perf', 'docs', 'chore', 'test', 'other']
  const grouped = {}
  data.commits.forEach(function (c) { (grouped[c.type] = grouped[c.type] || []).push(c) })
  const out = [
    '  ' + data.range + ' 共 ' + data.count + ' 个用户可见提交（需逐条在文案体现）：',
    '  另 ' + (data.internalCount || 0) + ' 个内部提交（preview/guard/mock，不计入声明数）、' +
      (data.excluded || 0) + ' 个发版噪音（已排除）。', ''
  ]
  order.forEach(function (t) {
    const list = grouped[t]
    if (!list || !list.length) return
    out.push('  [' + t + '] × ' + list.length)
    list.forEach(function (c) { out.push('    ' + c.hash + '  ' + c.subject) })
  })
  if (data.internal && data.internal.length) {
    out.push('  [internal · 无需写入文案] × ' + data.internal.length)
    data.internal.forEach(function (c) { out.push('    ' + c.hash + '  ' + c.subject) })
  }
  return out
}

function notesPath (tag) {
  const v = String(tag).replace(/^v/, '')
  return path.join(NOTES_DIR, tag + '.md')
}

function check (data, tag) {
  const p = notesPath(tag)
  if (!fs.existsSync(p)) {
    console.error('FAIL  缺少文案文件：' + path.relative(ROOT, p))
    return false
  }
  const text = fs.readFileSync(p, 'utf8')
  const m = text.match(DECL_RE)
  if (!m) {
    console.error('FAIL  ' + path.relative(ROOT, p) + ' 缺少声明行 <!-- RELEASE_SCOPE: N -->')
    console.error('      写文案前请先运行：node scripts/release-notes-scope.js ' + tag)
    console.error('      逐条核对下面清单后，把提交数写进 details 内的声明行：')
    groupLines(data).forEach(function (l) { console.error(l) })
    return false
  }
  const declared = Number(m[1])
  if (data.error === 'no-prev-tag') {
    // 仓库首个版本没有上一版 tag 可对比：声明形同虚设，跳过而非误报失败。
    console.warn('SKIP  仓库无上一版 tag，无法复算提交数；跳过覆盖校验（仅首版适用）')
    return true
  }
  if (data.error) {
    console.error('FAIL  无法独立计算提交清单：' + data.error)
    return false
  }
  if (declared !== data.count) {
    console.error('FAIL  RELEASE_SCOPE 声明 ' + declared + ' 个提交，但 ' + data.range + ' 实际有 ' + data.count + ' 个（差 ' + (data.count - declared) + '）')
    console.error('      文案很可能只覆盖了最近几天，漏掉本版早中期改动。请逐条核对：')
    groupLines(data).forEach(function (l) { console.error(l) })
    return false
  }
  console.log('PASS  ' + path.relative(ROOT, p) + ' 声明 ' + declared + ' 个提交，与 ' + data.range + ' 实际一致')
  return true
}

function main () {
  const o = parseArgs(process.argv.slice(2))
  const tag = resolveTag(o.tag)
  const prev = resolvePrev(o.prev, tag)
  const data = collect(tag, prev)

  if (o.json) {
    console.log(JSON.stringify(data, null, 2))
    process.exitCode = 0
    return
  }
  if (o.check) {
    process.exitCode = check(data, tag) ? 0 : 1
    return
  }

  console.log('Release notes 覆盖清单  ' + tag + '  (上一版 ' + (prev || '?') + ')')
  console.log('写文案前请逐条核对下列提交，确认每一项都已在文案体现；')
  console.log('再把提交总数写进 details 内的声明行：<!-- RELEASE_SCOPE: ' + data.count + ' -->')
  console.log('')
  groupLines(data).forEach(function (l) { console.log(l) })
  console.log('')
  console.log('声明示例：<!-- RELEASE_SCOPE: ' + data.count + ' -->')
}

try { main() } catch (e) { console.error(e); process.exitCode = 1 }

module.exports = { collect, check, DECL_RE, resolveTag, resolvePrev }
