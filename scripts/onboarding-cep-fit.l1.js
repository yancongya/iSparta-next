/**
 * L1：CEP 指导面板「按面板高度铺满、不滚动」契约（纯 Node，不启浏览器）
 * 用法：node scripts/onboarding-cep-fit.l1.js
 *
 * 背景：AE 面板仅 ~400–520px 高。桌面版「内容自然高度 + 上下滚动」在 CEP 下
 *       会把三种导入方式的第 2/3 种、准备就绪页的 2×2 卡片挤出首屏。
 *       CEP 下：导入方式单列三等分（图形左 / 文案右），准备就绪缩动图 +
 *       卡片两等分铺满；桌面端必须保持原样，其他步骤仍可滚动。
 * 守卫：① 步骤根有 ob-step--<key> 钩子；② 铺满规则只命中 import/finish；
 *       ③ 三等分 / 两等分网格与 margin 归零齐全；④ 规则在非 scoped 全局块、
 *       位于 compact 媒体查询之后；⑤ 桌面基线（三列 / 2×2）保留。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'src', 'ui-next', 'onboarding')
const SRC = path.join(ROOT, 'Onboarding.vue')
const raw = fs.readFileSync(SRC, 'utf8')
// 桌面基线（三列导入）在子组件 scoped 样式里，单独读
const importStep = fs.readFileSync(path.join(ROOT, 'steps', 'ImportStep.vue'), 'utf8')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

function block (selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}')
  const m = raw.match(re)
  return m ? m[1] : null
}

// 模板：<component ... class="ob-step" :class="'ob-step--' + current.key" />
const componentTag = (raw.match(/<component[\s\S]*?\/>/) || [''])[0]
ok('步骤根挂 ob-step--<key> 钩子', /:class="'ob-step--'\s*\+\s*current\.key"/.test(componentTag))
ok('步骤根保留 ob-step 基础类', /class="ob-step"/.test(componentTag))

// 只针对 import / finish 铺满，不能把全部步骤改成不滚动
const fillSel = '.ob--cep .ob-step--import,\n.ob--cep .ob-step--finish'
const fill = block(fillSel)
ok('CEP 铺满规则只命中 import/finish', !!fill)
ok('铺满规则含 flex:1 1 auto', !!fill && /flex:\s*1 1 auto/.test(fill))
ok('铺满规则含 min-height:0', !!fill && /min-height:\s*0/.test(fill))
ok('铺满规则把 margin:auto 归零（否则抢走剩余空间）', !!fill && /margin:\s*0 auto/.test(fill))
ok('铺满规则含 overflow:hidden', !!fill && /overflow:\s*hidden/.test(fill))
ok('未把所有 CEP 步骤一刀切为不滚动', !/\.ob--cep\s+\.ob-step\s*\{[^}]*overflow:\s*hidden/.test(raw))

// CEP 规则必须落在非 scoped 全局块（步骤页样式共享块），否则命中不到子组件根节点
const globalIdx = raw.indexOf('<style lang="scss">')
const scopedIdx = raw.indexOf('<style scoped lang="scss">')
ok('存在非 scoped 的共享样式块', globalIdx > -1)
ok('CEP 铺满规则写在共享样式块内', globalIdx > -1 && raw.indexOf(fillSel) > globalIdx && (scopedIdx < 0 || raw.indexOf(fillSel) > scopedIdx))
const compactIdx = raw.indexOf('@media (max-width: $bp-compact)')
ok('CEP 规则位于 compact 媒体查询之后', compactIdx > -1 && raw.indexOf(fillSel) > compactIdx)

// 三种导入方式：单列三等分、图形左文案右
const ways = block('.ob--cep .ob-step--import .ob-ways')
ok('导入列表 CEP 改单列', !!ways && /grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(ways))
ok('导入列表竖向三等分', !!ways && /grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(ways))
ok('导入列表吃满剩余高度', !!ways && /flex:\s*1 1 auto/.test(ways) && /min-height:\s*0/.test(ways))
const way = block('.ob--cep .ob-step--import .ob-way')
ok('单个导入项改 grid 横排（图形左/文案右）', !!way && /display:\s*grid/.test(way) && /grid-template-columns:\s*96px minmax\(0,\s*1fr\)/.test(way))
const art = block('.ob--cep .ob-step--import .ob-way__art')
ok('图形区占两行且高度撑满行', !!art && /grid-row:\s*1 \/ 3/.test(art) && /height:\s*100%/.test(art))
ok('CEP 图形缩到 96×68', /\.ob--cep\s+\.ob-step--import\s+\.ia__svg\s*\{[^}]*width:\s*96px[^}]*height:\s*68px/.test(raw))

// 准备就绪：缩动图 + 2×2 两等分
ok('CEP 动图缩到 84×84', /\.ob--cep\s+\.ob-step--finish\s+\.demo__svg\s*\{[^}]*width:\s*84px[^}]*height:\s*84px/.test(raw))
const cards = block('.ob--cep .ob-step--finish .ob-cards')
ok('准备就绪卡片两等分铺满', !!cards && /grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(cards) && /flex:\s*1 1 auto/.test(cards))
ok('CTA 不参与拉伸', /\.ob--cep\s+\.ob-step--finish\s+\.ob-cta\s*\{[^}]*flex:\s*0 0 auto/.test(raw))

// 桌面基线不能被 CEP 改动吃掉
ok('桌面导入仍三列横排', /\.ob-ways\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(importStep))
ok('桌面准备就绪仍 2×2', /\.ob-cards\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(raw))

console.log('\n' + passed + ' passed, ' + failed + ' failed')
process.exit(failed ? 1 : 0)
