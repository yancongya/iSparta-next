/**
 * L1：预估角标富气泡（方案 B）纯函数守卫 + v-tip 向后兼容/转义守卫。
 * 用法：node scripts/estimate-tip-blocks.l1.js
 *
 * 覆盖：
 *  1) buildEstimateTipBlocks 各语义分支（超目标/无目标/多格式/位深/GIF 受限/估算声明）
 *  2) block 结构合法（type 白名单、文本字段均为字符串、gauge ratio 数值）
 *  3) 无目标态降级：不出 gauge / 不出超目标胶囊 / 不出目标指标
 *  4) tip.js：normalize 对纯文本仍返回 sig（40+ 老调用零改动）
 *  5) tip.js：富气泡渲染全程 textContent，禁止 innerHTML（防路径注入）
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

// ---- 载入 estimateTipBlocks（带真实 humanSize）----
const blocksSrc = [
  strip(read('../src/util/qualityEstimate.js')),
  strip(read('../src/util/estimateTipBlocks.js')),
  '\nglobalThis.api = { buildEstimateTipBlocks, humanSize }'
].join('\n')
const qa = {
  Math, Number, String, Array, Object, Boolean, JSON, isFinite, isNaN, parseInt, parseFloat,
  console, Promise,
  fs: { existsSync: () => false }, path,
  TYPE: { APNG: 'APNG', GIF: 'GIF', WEBP: 'WEBP' },
  appLog: { info () {}, warn () {}, error () {} },
  i18n: {},
  apngCompress: () => Promise.resolve(), apng2gif: () => Promise.resolve(), apng2webp: () => Promise.resolve()
}
vm.createContext(qa)
vm.runInContext(blocksSrc, qa, { filename: 'estimateTipBlocks.l1.vm.js' })
const { buildEstimateTipBlocks } = qa.api

// 简单 t：回显 key 并插值，便于断言
const t = (k, vars) => {
  let s = k
  if (vars) Object.keys(vars).forEach((x) => { s = s + '|' + x + '=' + vars[x] })
  return s
}
const types = (blocks) => blocks.map((b) => b.type)
const find = (blocks, type) => blocks.find((b) => b.type === type)

function main () {
  console.log('L1 预估角标富气泡 blocks')

  // 1) 超目标：有 head.badge + gauge(over) + 目标指标 + 免责
  {
    const e = {
      mode: 'quality', quality: 20, text: '21.52 MB', bytes: 21520000,
      target: 1000000, sourceBytes: 40000000, over: true, hasTarget: true, estimated: true,
      details: [{ format: 'APNG', bytes: 21520000, over: true }]
    }
    const b = buildEstimateTipBlocks(e, t)
    ok('over: head 存在且带 badge', !!find(b, 'head') && !!find(b, 'head').badge, find(b, 'head'))
    ok('over: gauge ratio>1', !!find(b, 'gauge') && find(b, 'gauge').ratio > 1, find(b, 'gauge'))
    ok('over: gauge 右侧文案存在', !!find(b, 'gauge').captionRight, find(b, 'gauge'))
    ok('over: metrics 含源与目标两项', find(b, 'metrics').items.length === 2, find(b, 'metrics'))
    ok('over: foot 为估算声明', find(b, 'foot').text.indexOf('estimateDisclaimerEstimated') === 0, find(b, 'foot'))
    ok('over: 含 basis(Q) 说明条', types(b).indexOf('basis') >= 0, types(b))
  }

  // 2) 无目标态降级：无 gauge / 无 badge / 无目标指标
  {
    const e = {
      mode: 'quality', quality: 20, text: '21.52 MB', bytes: 21520000,
      target: 0, sourceBytes: 40000000, over: false, hasTarget: false, estimated: false,
      details: [{ format: 'APNG', bytes: 21520000, over: false }]
    }
    const b = buildEstimateTipBlocks(e, t)
    ok('no-target: 无 gauge', !find(b, 'gauge'), types(b))
    ok('no-target: head 无 badge', !!find(b, 'head') && !find(b, 'head').badge, find(b, 'head'))
    ok('no-target: metrics 仅源一项', find(b, 'metrics').items.length === 1, find(b, 'metrics'))
    ok('no-target: foot 为经验声明', find(b, 'foot').text.indexOf('estimateDisclaimer') === 0, find(b, 'foot'))
  }

  // 3) 位深 + GIF 受限：出 info note + warn note
  {
    const e = {
      mode: 'preserve', text: '40 MB', bytes: 40000000, target: 0, sourceBytes: 40000000,
      over: false, hasTarget: false, estimated: false, preserve: true,
      srcBits: 8, srcIndexed: false,
      limitedFormats: ['GIF'],
      details: [{ format: 'APNG', bytes: 40000000, over: false }, { format: 'GIF', bytes: 20000000, over: false }]
    }
    const b = buildEstimateTipBlocks(e, t)
    const notes = b.filter((x) => x.type === 'note')
    ok('bitdepth: 有 info note', notes.some((n) => n.tone === 'info'), notes)
    ok('bitdepth: GIF 受限有 warn note', notes.some((n) => n.tone === 'warn'), notes)
    ok('bitdepth: basis 为 preserve', b.some((x) => x.type === 'basis' && x.text.indexOf('estRichBasisPreserve') === 0), types(b))
    const fmtList = find(b, 'fmtlist')
    ok('bitdepth: fmtlist 结构化含 APNG/GIF', !!fmtList && fmtList.items.some((i) => i.format === 'APNG') && fmtList.items.some((i) => i.format === 'GIF'), fmtList)
    ok('bitdepth: fmtlist item 字段合法', !!fmtList && fmtList.items.every((i) => typeof i.format === 'string' && typeof i.value === 'string' && typeof i.over === 'boolean'), fmtList)
    ok('bitdepth: 含轮换提示 hint', !!find(b, 'hint') && find(b, 'hint').text.indexOf('estimateCycleHint') === 0, find(b, 'hint'))
  }

  // 4) 所有 block type 在白名单内、文本字段均为字符串
  {
    const e = {
      mode: 'colors', colors: 128, text: '2 MB', bytes: 2000000, target: 1000000,
      sourceBytes: 40000000, over: true, hasTarget: true, estimated: false,
      details: [{ format: 'WEBP', bytes: 2000000, over: true }, { format: 'GIF', bytes: 1500000, over: true }]
    }
    const b = buildEstimateTipBlocks(e, t)
    const allowed = ['head', 'gauge', 'basis', 'fmtlist', 'hint', 'sub', 'metrics', 'note', 'foot']
    ok('schema: 所有 type 合法', b.every((x) => allowed.indexOf(x.type) >= 0), b.map((x) => x.type))
    ok('schema: 超目标 fmtlist item 带 overText', find(b, 'fmtlist') && find(b, 'fmtlist').items.filter((i) => i.over).every((i) => typeof i.overText === 'string' && !!i.overText), find(b, 'fmtlist'))
    ok('schema: 文本字段均为字符串', b.every((x) => {
      if (x.text != null && typeof x.text !== 'string') return false
      if (x.label != null && typeof x.label !== 'string') return false
      if (x.value != null && typeof x.value !== 'string') return false
      if (x.badge != null && typeof x.badge !== 'string') return false
      return true
    }), null)
    ok('schema: gauge ratio 为有限数值', isFinite(find(b, 'gauge').ratio), find(b, 'gauge'))
  }

  // ---- tip.js 守卫 ----
  const tipRaw = read('../src/ui-next/tip.js')
  {
    // normalize：纯文本字符串 → sig 等于文案本身（向后兼容）
    const normSrc = strip(tipRaw).match(/function normalize[\s\S]*?\n\}/)[0]
    const ctx = { Array, JSON }
    vm.createContext(ctx)
    vm.runInContext(normSrc + '\n;this.normalize = normalize', ctx, { filename: 'tip.normalize.l1.vm.js' })
    const s = ctx.normalize('hello <b>&</b>')
    ok('tip: 纯文本 normalize 保持 sig=文案', s.sig === 'hello <b>&</b>' && s.text === 'hello <b>&</b>' && s.blocks === null, s)
    const o = ctx.normalize({ blocks: [{ type: 'foot', text: 'x' }] })
    ok('tip: 结构化 normalize 用 JSON 签名', typeof o.sig === 'string' && o.sig.indexOf('foot') >= 0 && Array.isArray(o.blocks), o)
  }
  {
    // 反向源码守卫：渲染函数里禁止 innerHTML / outerHTML / insertAdjacentHTML
    const renderFn = tipRaw.match(/function renderBlocks[\s\S]*?\n\}/)[0]
    ok('tip: renderBlocks 无 innerHTML', !/innerHTML/.test(renderFn) && !/insertAdjacentHTML/.test(renderFn), null)
    ok('tip: renderBlocks 用 textContent', (renderFn.match(/textContent/g) || []).length >= 6, (renderFn.match(/textContent/g) || []).length)
    // 类名冲突守卫：basis 不得用全局 .is-info（信息图标类带 inline-flex+width:16px，
    // 会把容器压成 16px 导致文字逐字竖排）。必须用 tip 专属类。
    ok('tip: basis 未使用全局 is-info', !/basis[\s\S]{0,120}' is-info'/.test(renderFn) && renderFn.indexOf('is-tip-basis-info') >= 0, null)
    // flex 文字项必须有 min-width:0，否则窄面板下中文逐字竖排
    const scssSrc = read('../src/ui-next/styles/ui.scss')
    const basisCss = (scssSrc.match(/&__basis \{[\s\S]*?\n  \}/) || [''])[0]
    ok('scss: basis 文字 span 有 flex+min-width:0', /span:last-child \{ flex: 1; min-width: 0/.test(basisCss) && /display: flex/.test(basisCss), basisCss.slice(0, 200))

    // 用户 2026-11-20 12:53 最终拍板：富气泡贴近鼠标但不裁切（撤销方案 A 的固定定位）。
    // 守卫：place() 接收 point 鼠标坐标，富气泡用它定位且两轴都 clamp；
    // 已移除固定定位(anchorH)与高亮(is-tip-anchor)；纯文本分支仍跟随触发元素。
    const placeFn = (tipRaw.match(/function place \(el, opts, point\) \{[\s\S]*?\n\}/) || [''])[0]
    // 定位用的富气泡分支以 `const px = point` 开头（前面那个 if(opts.blocks) 是渲染分支）
    const richBranch = (placeFn.match(/const px = point[\s\S]*?window\.innerHeight - tr\.height - pad\)\)/) || [''])[0]
    ok('tip: place 接收鼠标 point', /function place \(el, opts, point\)/.test(tipRaw) && /point\.x/.test(placeFn) && /point\.y/.test(placeFn), null)
    ok('tip: 富气泡两轴 clamp 不裁切', (richBranch.match(/Math\.max\(pad, Math\.min\(/g) || []).length >= 2, richBranch.slice(0, 240))
    ok('tip: 富气泡无旧固定定位 anchorH', !/anchorH/.test(richBranch), null)
    ok('tip: 无高亮残留 is-tip-anchor', !/is-tip-anchor/.test(tipRaw) && !/is-tip-anchor/.test(scssSrc), null)
    ok('tip: show 记录鼠标坐标到 _tip.point', /el\._tip\.point = \{ x: evt\.clientX, y: evt\.clientY \}/.test(tipRaw), null)
    ok('tip: 纯文本分支仍跟随角标', /r\.left \+ r\.width \/ 2 - tr\.width \/ 2/.test(placeFn), null)
  }

  console.log('\n通过 ' + passed + ' / 失败 ' + failed)
  process.exitCode = failed ? 1 : 0
}

main()
