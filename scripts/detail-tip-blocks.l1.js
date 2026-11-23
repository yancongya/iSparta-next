/**
 * L1：4 类长提示可视化气泡 —— detailTipBlocks 纯函数守卫 + 新 block 类型/防注入守卫。
 * 用法：node scripts/detail-tip-blocks.l1.js
 *
 * 覆盖：
 *  1) buildTitleTipBlocks / buildBadgeTipBlocks / buildOutputSizeTipBlocks / buildStateTipBlocks 结构
 *  2) stateTipOf 失败态 stderr 全文保留、完成态文件列表、badge tone
 *  3) filelist 长路径/特殊字符原样保留（渲染层负责省略 + title 全文）
 *  4) tip.js renderBlocks 支持 kvlist/filelist/stderr 且全程 textContent，无 innerHTML
 *  5) 新 block 样式含 CEP 窄屏适配（min-width:0 / ellipsis / break-all / @media 320）
 *  6) 三语 key 齐（outputSizeTipLabel / unreadable）
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const read = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8')
const strip = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export default.*$/gm, '')
  .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
  .replace(/^export function /gm, 'function ')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

// ---- 载入 detailTipBlocks（纯函数，无外部依赖）----
const src = strip(read('../src/util/detailTipBlocks.js')) + '\nglobalThis.api = { buildTitleTipBlocks, buildBadgeTipBlocks, buildOutputSizeTipBlocks, buildStateTipBlocks }'
const ctx = { Math, Number, String, Array, Object, Boolean, JSON }
vm.createContext(ctx)
vm.runInContext(src, ctx, { filename: 'detailTipBlocks.l1.vm.js' })
const api = ctx.api
const find = (b, type) => b.find((x) => x.type === type)
const types = (b) => b.map((x) => x.type)

function main () {
  console.log('L1 长提示可视化气泡 blocks')

  // 1) 标题：head 名 + kvlist 三行，值是原始路径
  const title = api.buildTitleTipBlocks({
    name: 'banner',
    rows: [
      { label: '输入目录', value: '/mock-assets/banner', mono: true, tone: 'cool' },
      { label: '输出目录', value: '/mock-assets', mono: true, tone: 'accent' },
      { label: '输出名字', value: 'banner', mono: true, tone: 'ok' }
    ]
  })
  ok('title: head + kvlist', types(title).join(',') === 'head,kvlist', types(title))
  ok('title: head 值为合成名', find(title, 'head').value === 'banner', find(title, 'head'))
  ok('title: kv 三行', find(title, 'kvlist').items.length === 3, null)
  ok('title: 路径原样保留+mono', find(title, 'kvlist').items[0].value === '/mock-assets/banner' && find(title, 'kvlist').items[0].mono === true, null)
  ok('title: head 默认强调色', find(title, 'head').tone === 'accent', find(title, 'head'))
  ok('title: 空入参加安全返回 []', api.buildTitleTipBlocks(null).length === 0, null)
  ok('title: 三行语义色透传', find(title, 'kvlist').items.map((x) => x.tone).join(',') === 'cool,accent,ok', find(title, 'kvlist').items)

  // 2) 格式角标：head(格式+总量) + filelist + hint(复制)
  const badge = api.buildBadgeTipBlocks({
    label: 'APNG', total: '1.24 MB',
    files: [{ name: 'banner_apng.png', size: '1.24 MB' }, { name: 'banner_apng_v2.png', size: '0.98 MB' }],
    copyText: '点击复制 APNG 产物'
  })
  ok('badge: head+filelist+hint', types(badge).join(',') === 'head,filelist,hint', types(badge))
  ok('badge: head label=格式 value=总量', find(badge, 'head').label === 'APNG' && find(badge, 'head').value === '1.24 MB', null)
  ok('badge: filelist 两项', find(badge, 'filelist').items.length === 2, null)
  ok('badge: hint 复制文案', find(badge, 'hint').text.indexOf('复制') >= 0, null)
  ok('badge: head/文件列表强调色', find(badge, 'head').tone === 'accent' && find(badge, 'filelist').items[0].tone === 'accent', null)

  // 3) 产物大小：sub label + filelist（完整路径），空文件不崩
  const size = api.buildOutputSizeTipBlocks({
    label: '产物明细 · 精确字节',
    files: [{ name: '/very/long/path/to/banner_apng.png', size: '1,300,121 B' }]
  })
  ok('size: sub+filelist', types(size).join(',') === 'sub,filelist', types(size))
  ok('size: 完整路径保留', find(size, 'filelist').items[0].name === '/very/long/path/to/banner_apng.png', null)
  ok('size: 精确字节保留', find(size, 'filelist').items[0].size === '1,300,121 B', null)
  ok('size: 空文件仅 sub', types(api.buildOutputSizeTipBlocks({ label: 'x', files: [] })).join(',') === 'sub', null)
  ok('size: 标签强调色 / 文件冷蓝色', find(size, 'sub').tone === 'accent' && find(size, 'filelist').items[0].tone === 'cool', null)

  // 4) 状态：失败态 stderr 全文；完成态 filelist + hint；badge tone
  const stderr = 'Error: frame 12 decode failed\n  at readChunk (apngasm.cpp:88)\n  at decode (main.cpp:42)'
  const fail = api.buildStateTipBlocks({
    stateLabel: '失败 · 1.2 KB', stateTone: 'bad', badgeText: '失败', detail: stderr, files: [], copyText: ''
  })
  ok('state(fail): head+stderr', types(fail).join(',') === 'head,stderr', types(fail))
  ok('state(fail): stderr 全文含换行', find(fail, 'stderr').text === stderr && find(fail, 'stderr').text.split('\n').length === 3, null)
  ok('state(fail): badge=失败', find(fail, 'head').badge === '失败', null)
  ok('state(fail): head 红色语义', find(fail, 'head').tone === 'bad', null)
  const done = api.buildStateTipBlocks({
    stateLabel: '成功 · 1.2 KB', stateTone: 'ok', detail: '',
    files: [{ name: '/out/banner.png', size: '1,300 B' }], copyText: '点击复制产物'
  })
  ok('state(done): head+filelist+hint', types(done).join(',') === 'head,filelist,hint', types(done))
  ok('state(done): 无 stderr 块', !find(done, 'stderr'), null)
  ok('state(done): 无失败 badge', !find(done, 'head').badge, null)
  ok('state(done): head/文件成功绿', find(done, 'head').tone === 'ok' && find(done, 'filelist').items[0].tone === 'ok', null)

  // 5) 注入安全：路径/stderr 里的 < > 原样当文本（渲染层 textContent，不做 HTML）
  const evil = api.buildOutputSizeTipBlocks({ label: 'x', files: [{ name: '<img src=x onerror=1>.png', size: '1 B' }] })
  ok('安全: 特殊字符原样保留为数据', find(evil, 'filelist').items[0].name === '<img src=x onerror=1>.png', null)

  // 6) tip.js：三种新 block 渲染 + 全程 textContent + 无 innerHTML
  const tipSrc = read('../src/ui-next/tip.js')
  const renderFn = (tipSrc.match(/function renderBlocks[\s\S]*?\n\}/) || [''])[0]
  ok('tip: 支持 kvlist 渲染', /b\.type === 'kvlist'/.test(renderFn), null)
  ok('tip: 支持 filelist 渲染', /b\.type === 'filelist'/.test(renderFn), null)
  ok('tip: 支持 stderr 渲染', /b\.type === 'stderr'/.test(renderFn), null)
  ok('tip: 无 innerHTML', !/innerHTML/.test(renderFn) && !/insertAdjacentHTML/.test(renderFn), null)
  ok('tip: textContent 数量足够', (renderFn.match(/textContent/g) || []).length >= 14, (renderFn.match(/textContent/g) || []).length)
  ok('tip: filelist 用 title 保留完整名', /n\.title = it\.name/.test(renderFn), null)
  ok('tip: 语义色白名单仅 5 种', /const TONES = \['accent', 'cool', 'ok', 'warn', 'bad'\]/.test(tipSrc), null)
  ok('tip: head/sub/kvrow/filerow 均接入 toneClass', /head\.className = 'is-tip-r__head' \+ toneClass\(b\.tone\)/.test(renderFn) && /sub\.className = 'is-tip-r__sub' \+ toneClass\(b\.tone\)/.test(renderFn) && /row\.className = 'is-tip-r__kvrow' \+ toneClass\(it\.tone\)/.test(renderFn) && /row\.className = 'is-tip-r__filerow' \+ toneClass\(it\.tone\)/.test(renderFn), null)

  // 6b) 归属域判定：单例浮层下，同域内子 tip 让位后恢复父级详情，不被 hide 劫持
  ok('tip: ownerOf 向上找 data-tip-owner 祖先', /function ownerOf[\s\S]*?hasAttribute\('data-tip-owner'\)[\s\S]*?p = p\.parentElement/.test(tipSrc), null)
  ok('tip: onLeave 同域恢复主 tip 而非 hide', /function onLeave[\s\S]*?to === from && from\._tip[\s\S]*?show\(from, from\._tip\.binding, evt\)/.test(tipSrc), null)
  ok('tip: 非归属域回退 scheduleHide（40+ 普通 tip 零变化）', /function onLeave[\s\S]*?scheduleHide\(\)/.test(tipSrc), null)
  ok('tip: bind 的 leave 走 onLeave 而非直接 scheduleHide', /leave: \(evt\) => onLeave\(el, evt\)/.test(tipSrc) && !/leave: scheduleHide/.test(tipSrc), null)
  const plSrc = read('../src/components/projectList/projectList.vue')
  ok('接入: 任务条根标 data-tip-owner', /data-tip-owner[\s\S]{0,120}v-tip="titleTipOf\(project\)"/.test(plSrc), null)

  // 7) 样式：窄屏适配与防溢出（CEP 小尺寸硬约束）
  const scss = read('../src/ui-next/styles/ui.scss')
  ok('scss: kvval min-width:0 + break-all', /&__kvval \{[\s\S]*?min-width: 0;[\s\S]*?word-break: break-all/.test(scss), null)
  ok('scss: filename ellipsis', /&__filename \{[\s\S]*?text-overflow: ellipsis/.test(scss), null)
  ok('scss: stderr pre-wrap + break-all', /&__stderr \{[\s\S]*?white-space: pre-wrap;[\s\S]*?word-break: break-all/.test(scss), null)
  ok('scss: CEP ≤320 断点适配新 block', /@media \(max-width: 320px\) \{[\s\S]*?kvrow[\s\S]*?filerow[\s\S]*?stderr/.test(scss), null)
  ok('scss: 语义色行样式齐全', ['accent', 'cool', 'ok', 'warn', 'bad'].every(function (t) { return scss.indexOf('is-tone-' + t) >= 0 }), null)
  const kvkeyBlock = (scss.match(/&__kvkey \{[\s\S]*?\n  \}/) || [''])[0]
  ok('scss: kv 仅文字异色（无底色/边框/胶囊）', !/border-left|background|padding|border-radius/.test(kvkeyBlock) && /\.is-tone-accent & \{ color: var\(--is-accent-fg\);/.test(kvkeyBlock), null)
  ok('scss: 文件行无底色、仅文件名分色', !/&__filerow \{[\s\S]*?is-tone-cool \{ background/.test(scss) && /&__filerow \{[\s\S]*?is-tone-cool \.is-tip-r__filename \{ color: var\(--is-cool-fg\)/.test(scss), null)

  // 8) 三语 key 齐
  for (const f of ['zh-cn', 'zh-tw', 'en-us']) {
    const loc = read('../src/locales/' + f + '.js')
    ok('i18n: ' + f + ' 含 outputSizeTipLabel/unreadable', loc.indexOf('"outputSizeTipLabel"') >= 0 && loc.indexOf('"unreadable"') >= 0, null)
  }

  // 9) 组件接入：4 个方法都在 v-tip，导入存在
  const pl = read('../src/components/projectList/projectList.vue')
  const ct = read('../src/components/compTree/compTree.vue')
  ok('接入: projectList 导入 3 个 builder', /buildTitleTipBlocks, buildBadgeTipBlocks, buildOutputSizeTipBlocks/.test(pl), null)
  ok('接入: compTree 导入 buildStateTipBlocks', /buildStateTipBlocks/.test(ct), null)
  ok('接入: stateTipOf 返回 blocks', /stateTipOf \(node\)[\s\S]*?return \{ blocks: buildStateTipBlocks/.test(ct), null)
  ok('接入: titleTipOf 输入/输出/名字分色', /tipInputDir[^\n]*tone: 'cool'/.test(pl) && /tipOutputDir[^\n]*tone: 'accent'/.test(pl) && /outputName[^\n]*tone: 'ok'/.test(pl), null)

  console.log('\n通过 ' + passed + ' / 失败 ' + failed)
  process.exitCode = failed ? 1 : 0
}

main()
