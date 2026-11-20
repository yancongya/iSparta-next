/**
 * L1：notice.js toast 自动关闭定时器回归（纯 Node，不启浏览器）
 * 用法：node scripts/notice.l1.js
 *
 * 背景（延续多版的假修复根因）：
 *   schedule() 曾用 setTimeout(() => close(item.id), item.remaining)，
 *   item（toast 对象）上没有 remaining 字段 → undefined → setTimeout 按 0ms →
 *   每条 toast push 后下一事件循环即被 close，肉眼永远看不到。
 *   正确值是 entry.remaining（对比 resume() 的写法）。
 * 本脚本双守卫：① 行为断言 delay === duration；② 源码反向守卫禁止 item.remaining 回到定时器。
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const SRC = path.join(__dirname, '..', 'src', 'ui-next', 'notice.js')
const raw = fs.readFileSync(SRC, 'utf8')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

// 剥掉 import 行，注入 mock 依赖（范式同 preserve-bitdepth.l1.js 的 stripAll）
function stripImports (code) {
  return code
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/^export default[^\n]*\n?/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
}

function makeNotice (overrides) {
  const timers = []
  const cleared = []
  const mockVue = {
    observable: (obj) => obj // Vue.observable 在 Node 里退化为普通对象即可测逻辑
  }
  const mockAppLog = { info () {}, ok () {}, warn () {}, error () {}, debug () {} }
  const ctx = {
    Vue: mockVue,
    appLog: mockAppLog,
    Date, Math, Number, String, Object, Array, isFinite, Promise,
    console,
    setTimeout: (fn, delay) => { const h = { fn, delay }; timers.push(h); return h },
    clearTimeout: (h) => { cleared.push(h) }
  }
  if (overrides) Object.assign(ctx, overrides)
  vm.createContext(ctx)
  const code = stripImports(raw) + '\n;this.__notice = notice;'
  vm.runInContext(code, ctx, { filename: 'notice.js(l1)' })
  return { notice: ctx.__notice, timers, cleared, ctx }
}

async function main () {
  console.log('L1 notice toast 自动关闭定时器')

  // ---- 1) 行为断言：success 自动关闭的 delay 必须等于 duration(3200) ----
  {
    const { notice, timers } = makeNotice()
    notice.success('复制成功')
    const delay = timers.length ? timers[0].delay : 'NO_TIMER'
    ok('success 注册了自动关闭定时器', timers.length === 1, { timers: timers.length })
    ok('success 定时器 delay === 3200（非 undefined/0）', delay === 3200, { delay })
  }

  // ---- 2) info / warning / error 各档 delay === 各自 duration ----
  {
    const cases = [
      ['info', 3200],
      ['warning', 8000],
      ['error', 10000]
    ]
    cases.forEach(([type, expect]) => {
      const { notice, timers } = makeNotice()
      notice[type]('test')
      ok(type + ' 定时器 delay === ' + expect, timers.length === 1 && timers[0].delay === expect, { delay: timers.length ? timers[0].delay : 'NO_TIMER' })
    })
  }

  // ---- 3) 常驻通知 duration=0 不注册定时器（progress 的进度气泡）----
  {
    const { notice, timers } = makeNotice()
    const handle = notice.progress('正在复制…')
    ok('progress(duration=0) 不注册定时器', timers.length === 0, { timers: timers.length })
    // done 换出的 success 仍须正确 delay
    handle.done('success', '完成')
    ok('progress.done(success) 定时器 delay === 3200', timers.length === 1 && timers[0].delay === 3200, { delay: timers.length ? timers[0].delay : 'NO_TIMER' })
  }

  // ---- 4) 源码反向守卫：定时器不得再用 item.remaining（笔误根因）----
  {
    const scheduleMatch = raw.match(/function schedule\s*\(item\)\s*\{[\s\S]*?\n\}/)
    const scheduleBody = scheduleMatch ? scheduleMatch[0] : ''
    ok('schedule() 中存在 setTimeout', /setTimeout\s*\(/.test(scheduleBody))
    ok('schedule() 定时器延迟用 entry.remaining', /setTimeout\([^,]+,\s*entry\.remaining\s*\)/.test(scheduleBody), { scheduleBody: scheduleBody.slice(0, 200) })
    ok('schedule() 不得出现 item.remaining（防笔误回归）', !/setTimeout\([^,]+,\s*item\.remaining\s*\)/.test(scheduleBody))
  }

  // ---- 5) pause/resume 冻结后，resume 的 delay === entry.remaining ----
  {
    const { notice, timers, cleared } = makeNotice()
    const id = notice.success('测试')
    // 模拟 1 秒后暂停：remaining 应减到约 2200
    const RealDate = Date.now
    let now = RealDate()
    // 直接调 pause（用真实的 timers 状态），再 resume
    notice.pause(id)
    ok('pause 清掉了原定时器', cleared.length === 1, { cleared: cleared.length })
    notice.resume(id)
    const resumeDelay = timers.length > 1 ? timers[1].delay : 'NO_TIMER'
    ok('resume 重建定时器 delay 在 (0,3200] 区间', typeof resumeDelay === 'number' && resumeDelay > 0 && resumeDelay <= 3200, { resumeDelay })
  }

  console.log('\nnotice L1:', passed, 'passed,', failed, 'failed')
  if (failed) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
