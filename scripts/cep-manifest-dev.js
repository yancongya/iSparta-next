/**
 * [已废弃 v1] CEP 开发态入口切换——保留为兼容转发器，不再直接写源码 manifest。
 *
 * 历史：v1 靠 writeFileSync 改写 targets/cep/CSXS/manifest.xml 的 MainPath
 *       来切换 dev-hmr.html / ui/index.html，导致热更后忘记 off 就把生产
 *       manifest 污染成热更页（发版事故隐患）。
 * 现状：v2（scripts/dev/cep-mode.js dev/restore）用独立 ID + 用户级派生 manifest，
 *       源码 manifest 恒为生产值 ./ui/index.html，永不改写。
 * 本文件只为兼容旧调用（package.json / dev-all.js / 外部脚本）而保留：
 *   on  → 转发 cep-mode.js dev
 *   off → 转发 cep-mode.js restore
 * 绝不写源码 manifest。守卫 scripts/cep-dev-mode.l1.js 锁死此契约。
 */
const path = require('path')
const { spawnSync } = require('child_process')

const MODE = path.join(__dirname, 'dev', 'cep-mode.js')
const arg = process.argv[2] === 'on' ? 'dev' : 'restore'

console.log('[cep-manifest-dev] v1 已废弃，转发到 v2: node scripts/dev/cep-mode.js ' + arg)
console.log('[cep-manifest-dev] v2 用独立 ID 派生 manifest，源码 manifest 永不改写。')

const res = spawnSync(process.execPath, [MODE, arg], { stdio: 'inherit', cwd: path.join(__dirname, '..'), env: process.env })
if (res.error) { console.error(res.error.message); process.exit(1) }
process.exit(res.status == null ? 1 : res.status)
