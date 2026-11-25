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
    // confirmState / answerConfirm 走具名导出（confirm 弹窗用）；沙箱里只需其定义、不需 export 关键字。
    // Vue.observable 已由 mockVue 注入，observable(obj) 原样返回对象即可。
    .replace(/^export\s+(const|function|let|var)\s/gm, '$1 ')
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
  const code = stripImports(raw) + '\n;this.__notice = notice; this.__confirmState = confirmState; this.__answerConfirm = answerConfirm;'
  vm.runInContext(code, ctx, { filename: 'notice.js(l1)' })
  return { notice: ctx.__notice, confirmState: ctx.__confirmState, answerConfirm: ctx.__answerConfirm, timers, cleared, ctx }
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

  // ---- 6) confirm 走独立模态弹窗状态，不进 toast 队列 ----
  {
    // 源码守卫：confirm() 不再 push 到 state.items（长条 toast），而是写 confirmState
    const confirmFn = raw.match(/confirm \(options\) \{[\s\S]*?\n  \},/)
    const confirmBody = confirmFn ? confirmFn[0] : ''
    ok('confirm() 不 push 进 toast 队列', !/push\(\s*\{/.test(confirmBody), { confirmBody: confirmBody.slice(0, 160) })
    ok('confirm() 写 confirmState.visible=true', /confirmState\.visible = true/.test(confirmBody))
    ok('confirm() 上一条未答先以 false 收尾', /if \(confirmState\.resolve\) confirmState\.resolve\(false\)/.test(confirmBody))
    ok('confirmState 用 Vue.observable', /export const confirmState = Vue\.observable\(/.test(raw))
    ok('answerConfirm 统一收口 Promise 并置 visible=false', /confirmState\.visible = false[\s\S]{0,240}resolve\(value === undefined \? false : value\)/.test(raw))
    // 源码守卫：toast 样式无 hover 展开变形、无 confirm 变体
    const scss = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'ui-next', 'styles', 'ui.scss'), 'utf8')
    const noticeBlock = scss.slice(scss.indexOf('.is-notice-item {'), scss.indexOf('@keyframes is-countdown'))
    ok('toast 样式无 hover 展开变形', !/&:hover &__body/.test(noticeBlock) && !/white-space: normal/.test(noticeBlock))
    ok('toast 样式无 --confirm 变体', !/&--confirm/.test(noticeBlock))
    // 行为守卫：confirm() 不新增 toast item，answerConfirm 回填 true/false 且只 settle 一次
    const { notice, confirmState, answerConfirm } = makeNotice()
    const toastCount = notice.state.items.length
    const p = notice.confirm({ title: '覆盖源文件？', text: 'a\nb' })
    ok('confirm() 不增加 toast 条数', notice.state.items.length === toastCount)
    ok('confirm() 置起 confirmState', confirmState.visible === true && confirmState.title === '覆盖源文件？')
    answerConfirm(true)
    const settled = await p
    ok('answerConfirm(true) → Promise resolve(true)', settled === true, { settled })
    ok('答完 confirmState.visible=false', confirmState.visible === false)
    answerConfirm(false) // 重复答不应再改变已 settle 的 Promise
    const again = await p
    ok('重复 answerConfirm 不再改写结果', again === true, { again })
  }

  // ---- 7) 三按钮形态（覆盖源文件：直接覆盖 vs 加后缀另存）----
  {
    // 源码守卫：confirm() 支持 altText/altValue，answerConfirm 回传原始标识
    const confirmFn = raw.match(/confirm \(options\) \{[\s\S]*?\n  \},/)
    const confirmBody = confirmFn ? confirmFn[0] : ''
    ok('confirm() 写 altText', /confirmState\.altText = opts\.altText/.test(confirmBody))
    ok('confirm() 写 altValue（缺省 true）', /confirmState\.altValue = opts\.altValue === undefined \? true : opts\.altValue/.test(confirmBody))
    ok('answerConfirm 不做 Boolean 归一（备选要回传自己的标识）', !/resolve\(Boolean\(/.test(raw))
    // 行为守卫：alt 按钮回传字符串标识，调用方据此区分两种后果
    const { notice, confirmState, answerConfirm } = makeNotice()
    const p = notice.confirm({
      title: '将覆盖源文件',
      text: 'C:\\isparta-verify\\cool.png',
      cancelText: '取消',
      altText: '直接覆盖源文件',
      altValue: 'overwrite',
      confirmText: '另存为 cool_1.png'
    })
    ok('confirm() 置起 altText/altValue', confirmState.altText === '直接覆盖源文件' && confirmState.altValue === 'overwrite')
    answerConfirm('overwrite')
    const settled = await p
    ok("answerConfirm('overwrite') → Promise 原样回传标识", settled === 'overwrite', { settled })
    // 弹窗源码守卫：alt 按钮仅在 altText 有值时渲染，且走 danger 样式
    const dlg = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'ui-next', 'components', 'IsConfirmDialog.vue'), 'utf8')
    ok('弹窗按 state.altText 条件渲染备选按钮', /v-if="state\.altText"/.test(dlg))
    ok('备选按钮走 danger 样式', /type="danger"/.test(dlg))
    ok('备选按钮回传 altValue', /answerConfirm\(this\.state\.altValue\)/.test(dlg))
    // 主操作仍 resolve(true)、取消仍 resolve(false)
    const p2 = notice.confirm({ title: 't', altText: 'a', altValue: 'overwrite' })
    answerConfirm(true)
    ok('主按钮仍 resolve(true)', (await p2) === true)
    const p3 = notice.confirm({ title: 't2' })
    answerConfirm(false)
    ok('取消仍 resolve(false)', (await p3) === false)
  }

  // ---- 8) toast 容器必须挂到 body，否则被 teleport 到 body 的 dialog 盖住 ----
  {
    // 背景：.is-notice 原来嵌在 .ib 内；日志面板 IsDialog teleport 到 body 后，
    // 两者不同层叠上下文，toast 的 z-index:3000 失效，被 dialog(2000) 盖住看不见。
    // 实测 elementFromPoint：修复前命中 dialog header，把容器移到 body 后命中 toast 自身。
    const host = require('fs').readFileSync(path.join(__dirname, '..', 'src', 'ui-next', 'components', 'IsNoticeHost.vue'), 'utf8')
    ok('IsNoticeHost 有 mounted 钩子', /mounted \(\) \{/.test(host))
    ok('IsNoticeHost 把根节点挂到 body', /document\.body\.appendChild\(this\.\$el\)/.test(host))
    ok('IsNoticeHost 挂载前判重避免重复 append', /parentNode !== document\.body/.test(host))
  }

  console.log('\nnotice L1:', passed, 'passed,', failed, 'failed')
  if (failed) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exitCode = 1 })
