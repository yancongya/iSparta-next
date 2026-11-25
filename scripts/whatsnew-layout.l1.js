/**
 * L1：升级后 What's New 单屏的CEP铺满契约（纯 Node，不启浏览器）
 * 用法：node scripts/whatsnew-layout.l1.js
 *
 * 背景：CEP 面板仅 ~666px 宽，卡片 max-width:460px 居中会左右各留 ~100px，
 *       顶栏铺满而弹窗缩进，观感割裂。release notes 承诺「CEP 更新弹窗铺满面板」，
 *       同一口径已用于 IsUpdateDialog（.is-dialog.upd-dialog padding:6px + .upd-panel--full width:100%）。
 *       What's New 单屏须同样在 CEP 下去掉 460px 上限铺满，桌面端仍保持 460px 居中卡片。
 * 守卫：① 模板有 isCep → .own--cep 钩子；② CEP 规则去掉 max-width；
 *       ③ 桌面基线 max-width:460px 仍在；④ CEP padding 与 upd-dialog 同口径(6px)。
 */
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, '..', 'src', 'ui-next', 'onboarding', 'OnboardingWhatsNew.vue')
const raw = fs.readFileSync(SRC, 'utf8')

let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}

// 模板：<div class="own" :class="{ 'own--cep': isCep }">
ok('模板挂 isCep → own--cep 钩子', /class="own"[^>]*:class="\{[^}]*'own--cep'\s*:\s*isCep/.test(raw) || /'own--cep'\s*:\s*isCep/.test(raw))
// computed: isCep () { return hostAdapter.kind === 'cep' }
ok('isCep 基于 hostAdapter.kind', /isCep\s*\(\)\s*\{\s*return\s+hostAdapter\.kind === 'cep'/.test(raw))

// 桌面基线保留 460px
ok('桌面卡片 max-width:460px 基线保留', /\.own-card\s*\{[^}]*max-width:\s*460px/.test(raw))

// CEP 规则：.own--cep .own-card { max-width: none }
const cepCard = raw.match(/\.own--cep\s+\.own-card\s*\{([^}]*)\}/)
ok('CEP 规则 .own--cep .own-card 存在', !!cepCard)
ok('CEP 下去掉 max-width（none）', !!cepCard && /max-width:\s*none/.test(cepCard[1]))
ok('CEP 规则位于 compact 媒体查询之后（避免被覆盖）', (() => {
  const cepIdx = raw.indexOf('.own--cep {')
  const compactIdx = raw.indexOf('@media (max-width: $bp-compact)')
  return cepIdx > -1 && compactIdx > -1 && cepIdx > compactIdx
})())
// CEP padding 6px 与 upd-dialog 同口径
const cepRoot = raw.match(/\.own--cep\s*\{([^}]*)\}/)
ok('CEP 外层 padding:6px（对齐 upd-dialog）', !!cepRoot && /padding:\s*6px/.test(cepRoot[1]))

// 反向守卫：不能把整屏改成 display:none / 移除组件
ok('未把 Whats New 单屏整体隐藏', !/class="own"[^>]*v-show="false"/.test(raw) && !/\.own\s*\{[^}]*display:\s*none/.test(raw))

console.log('\n' + passed + ' passed, ' + failed + ' failed')
process.exit(failed ? 1 : 0)
