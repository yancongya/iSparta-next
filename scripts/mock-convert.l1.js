/**
 * L1：浏览器 mock 环境「点开始能跑模拟转换」链路守卫（纯 Node，不启浏览器）
 * 用法：node scripts/mock-convert.l1.js
 *
 * 背景：mockup 下帧内容是 'mock' 占位字符串、无真实编码器，走真实链必然
 *   「目标文件已存在（种子预写产物）+ invalid PNG frame → 转换中断」。
 * 修复收三处：① node-env 的 isMockEnv 单一判据；② processor 走 mockConvert
 *   （写 mock 产物 + 分段进度到完成）；③ store preflightOutputs 豁免 mock 冲突。
 * 本脚本静态守住这三处契约，防止任一被误改回「mockup 报错」。
 */
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')

let passed = 0
const failures = []
function check (name, fn) {
  try { fn(); passed++ } catch (e) { failures.push(name + ': ' + e.message) }
}

const nodeEnv = read('src/util/node-env.js')
const processor = read('src/util/processor/index.js')
const store = read('src/store/index.js')

check('node-env exposes single isMockEnv judge', () => {
  assert(/export function isMockEnv \(\)/.test(nodeEnv), 'missing isMockEnv() export')
  assert(/window\.__ispartaMockBridge === true/.test(nodeEnv), 'must key off mock-bridge install flag')
  assert(/VUE_APP_LANDING_DEMO === '1'/.test(nodeEnv), 'must cover landing demo build')
})

check('processor imports isMockEnv and drops landing-only branch', () => {
  assert(/import \{ fs, path, os, isMockEnv \}/.test(processor), 'processor must import isMockEnv')
  assert(/if \(isMockEnv\(\)\)/.test(processor), 'processor must gate on isMockEnv()')
  assert(!/VUE_APP_LANDING_DEMO === '1'/.test(processor), 'processor must not keep landing-only branch')
})

check('processor mockConvert writes outputs and advances progress to done', () => {
  assert(/function mockConvert \(items, store, locale\)/.test(processor), 'missing mockConvert()')
  assert(/outputFilesOf\(item\)\.forEach/.test(processor), 'mockConvert must write output files')
  assert(/fs\.writeFileSync\(file, 'mock output/.test(processor), 'mockConvert must write mock content')
  assert(/store\.dispatch\('editProcess'/.test(processor), 'mockConvert must dispatch progress')
  assert(/schedule === 1/.test(processor), 'mockConvert must reach done state')
  assert(/return mockConvert\(action\.items, store, locale\)/.test(processor), 'mock branch must call mockConvert')
})

check('store preflightOutputs exempts mock env before conflict scan', () => {
  assert(/import \{[^\n]*isMockEnv[^\n]*\} from '\.\.\/util\/node-env'/.test(store), 'store must import isMockEnv')
  const start = store.indexOf('async preflightOutputs (context, items) {')
  assert(start >= 0, 'missing preflightOutputs')
  const slice = store.slice(start, start + 300)
  assert(/if \(isMockEnv\(\)\) \{ return true \}/.test(slice),
    'preflightOutputs must short-circuit mock env before conflict scan')
})

if (failures.length) {
  console.error('mock convert L1 FAILED (' + failures.length + '):')
  failures.forEach((f) => console.error('  - ' + f))
  process.exit(1)
}
console.log('mock convert L1 OK (' + passed + ' checks)')
