/**
 * L1：Release Notes 覆盖门禁守卫（纯 Node）
 * 用法：node scripts/release-notes-scope.l1.js
 *
 * 锁住 v3.10.3「文案只写最近几天、漏掉整周功能」事故的修复机制：
 *  1) 脚本存在且能从 git 独立算出 prev..tag 用户可见提交清单；
 *  2) 排除规则正确：发版噪音与 preview/guard/mock 内部提交不计入；
 *  3) 声明数与实际数不符（或缺失）时 --check 必须 FAIL；
 *  4) 三份文档（RELEASE.md / AGENTS.md / TEMPLATE.md）写明门禁流程；
 *  5) CI release.yml 在 bump 前调用 --check。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const scope = require('./release-notes-scope.js')

const ROOT = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}
function runCheck (tag) {
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'release-notes-scope.js'), tag, '--check'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    return { code: 0 }
  } catch (e) {
    return { code: e.status != null ? e.status : -1, out: (e.stdout || '').toString() + (e.stderr || '').toString() }
  }
}

function main () {
  console.log('L1 Release Notes 覆盖门禁')

  // ---- 1) 脚本存在且核心导出齐全 ----
  ok('脚本导出 collect/check/DECL_RE', typeof scope.collect === 'function' && typeof scope.check === 'function' && !!scope.DECL_RE)

  // ---- 2) 用真实 git 独立算 v3.10.3 清单 ----
  const data = scope.collect('v3.10.3', 'v3.10.2')
  ok('prev..tag 清单可计算', !data.error && data.count > 0, { error: data.error, count: data.count })
  ok('用户可见提交数与内部提交分开统计', data.count === 31 && data.internalCount === 16,
    { count: data.count, internalCount: data.internalCount })
  const subjects = data.commits.map((c) => c.subject)
  ok('发版 bump 噪音已排除', subjects.every((s) => !/^(chore\(release\)|Merge\b)/i.test(s)))
  ok('preview/guard/mock 内部提交不计入可见数', data.commits.every((c) => !/\((preview|guard|mockup|mock)\b/i.test(c.subject)))
  ok('关键用户功能确实在清单中（防过滤过猛）',
    ['统一询问面板', '对比弹窗重构', '本地调试日志接口', '防覆盖主体'].every((k) =>
      subjects.some((s) => s.indexOf(k) >= 0) || data.internal.some((c) => c.subject.indexOf(k) >= 0)))

  // ---- 3) 声明正则 ----
  ok('声明正则只认整数 N', scope.DECL_RE.test('<!-- RELEASE_SCOPE: 31 -->') &&
    !scope.DECL_RE.test('<!-- RELEASE_SCOPE: x -->'))

  // CI 场景：本版 tag 在 bump 前尚未创建，collect 回退 HEAD 作终点。
  // 本地已建 tag 时终点是 tag；两者用户可见提交数应一致（bump commit 被排除）。
  const pending = scope.collect('v9.9.9-notyet', 'v3.10.2') // tag 不存在 → 终点回退 HEAD
  ok('本版 tag 未建时回退 HEAD 仍能算清单', !pending.error && pending.ref === 'HEAD' && pending.count > 0,
    { ref: pending.ref, count: pending.count, error: pending.error })

  // ---- 4) 当前文案声明与实际一致，check 通过 ----
  const notes = read('.github/release-notes/v3.10.3.md')
  ok('v3.10.3 文案含声明行', scope.DECL_RE.test(notes))
  const declared = Number((notes.match(scope.DECL_RE) || [])[1])
  ok('声明数 == 实际用户可见提交数', declared === data.count, { declared, actual: data.count })
  const r = runCheck('v3.10.3')
  ok('--check 一致时 PASS（exit 0）', r.code === 0, { code: r.code, out: (r.out || '').slice(0, 160) })

  // ---- 5) 缺失/错误声明必须 FAIL（临时改文案，finally 恢复）----
  const p = path.join(ROOT, '.github', 'release-notes', 'v3.10.3.md')
  const backup = fs.readFileSync(p, 'utf8')
  try {
    fs.writeFileSync(p, backup.replace(/<!--\s*RELEASE_SCOPE:\s*\d+\s*-->/i, ''), 'utf8')
    const miss = runCheck('v3.10.3')
    ok('缺少声明时 --check FAIL（exit 1）', miss.code === 1 && /RELEASE_SCOPE/.test(miss.out), { code: miss.code })
    fs.writeFileSync(p, backup.replace(/RELEASE_SCOPE:\s*\d+/, 'RELEASE_SCOPE: 1'), 'utf8')
    const wrong = runCheck('v3.10.3')
    ok('声明数错误时 --check FAIL（exit 1）', wrong.code === 1 && /实际有/.test(wrong.out), { code: wrong.code })
  } finally {
    fs.writeFileSync(p, backup, 'utf8')
  }
  ok('临时改动已恢复', fs.readFileSync(p, 'utf8') === backup)

  // ---- 6) 格式化仍清掉声明注释（不污染 App 弹窗）----
  const raw = read('src/util/updateCheck.js')
  ok('formatter 有 HTML 标签清理', /<\[\^>\]\+>/g.test(raw) || /<[^>]+>/g.test(raw))

  // ---- 7) 文档写明门禁流程 ----
  const releaseDoc = read('docs/RELEASE.md')
  ok('RELEASE.md 写明 scope 清单流程', /RELEASE_SCOPE|release-notes-scope/.test(releaseDoc))
  const agents = read('AGENTS.md')
  ok('AGENTS.md 写明 scope 门禁', /RELEASE_SCOPE|release-notes-scope/.test(agents))
  const tpl = read('.github/release-notes/TEMPLATE.md')
  ok('TEMPLATE.md 含声明占位', /RELEASE_SCOPE/.test(tpl))

  // ---- 8) CI 在 bump 前调用 --check ----
  const wf = read('.github/workflows/release.yml')
  const checkAt = wf.indexOf('release-notes-scope.js')
  const bumpAt = wf.indexOf('Commit & tag')
  ok('CI 调用 release-notes-scope --check', /release-notes-scope\.js[^\n]*--check/.test(wf))
  ok('CI scope 校验在 Commit & tag 之前（bump 前门禁）', checkAt > 0 && bumpAt > 0 && checkAt < bumpAt,
    { checkAt, bumpAt })

  console.log('\nrelease-notes-scope L1:', passed, 'passed,', failed, 'failed')
  if (failed) process.exitCode = 1
}

try { main() } catch (e) { console.error(e); process.exitCode = 1 }
