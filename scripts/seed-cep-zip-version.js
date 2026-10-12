/**
 * 给 CI 打的独立 CEP zip 播种 version.json 版本清单。
 *
 * 为什么需要：CI 的 Pack CEP 步骤是 rsync targets/cep（源码树不维护 version.json），
 * 与本地 pack-cep-zip.js（走 prepare-cep-payload，payload 自带清单）不一致 ——
 * 缺清单的后果：
 *   - 桌面启动自检（src/util/cepSync.js compareVersions）把手动安装判成 not-installed，
 *     每次启动都全量重拷一遍；
 *   - CEP 面板 updater:meta 读不到清单，回退 brand 静态版本（当前值恰好正确，
 *     但违背「清单为已装版本事实源」的设计，落盘侧版本变化将不可观测）；
 *   - 排障时没有 builtAt / payload / binaries / install 元数据。
 *
 * 字段与 prepare-cep / NSIS / cepSync 自检刷新对齐（唯一组装来源：
 * cep-payload-common.buildVersionDoc）。
 *
 * 用法：node scripts/seed-cep-zip-version.js <staged-ext-dir>
 * 退出码：0 成功 / 1 失败（目录不是扩展根、清单未写出）。
 */
const fs = require('fs')
const path = require('path')
const {
  SKIP_COPY,
  writeVersionJson,
  readVersionJson,
  readExtensionBundleVersion,
  buildVersionDoc
} = require('../src/util/cep-payload-common')

const root = path.join(__dirname, '..')

function fail (msg) {
  console.error('seed-cep-zip-version FAIL', msg)
  process.exit(1)
}

/** 收集 stage/bin/<plat>/<tool> 为 ['win64/apngasm.exe', ...]（跳过 README 等非工具） */
function collectBinaries (extDir) {
  const binRoot = path.join(extDir, 'bin')
  const out = []
  if (!fs.existsSync(binRoot)) return out
  for (const plat of fs.readdirSync(binRoot)) {
    const p = path.join(binRoot, plat)
    try {
      if (!fs.statSync(p).isDirectory()) continue
    } catch (e) { continue }
    for (const f of fs.readdirSync(p)) {
      if (SKIP_COPY.has(f) || f.endsWith('.md')) continue
      out.push(plat + '/' + f)
    }
  }
  return out.sort()
}

function main () {
  const stage = process.argv[2]
  if (!stage) fail('用法：node scripts/seed-cep-zip-version.js <staged-ext-dir>')
  const extDir = path.resolve(stage)
  if (!fs.existsSync(path.join(extDir, 'CSXS', 'manifest.xml'))) {
    fail('不是扩展根目录（缺 CSXS/manifest.xml）：' + extDir)
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (!pkg.version) fail('package.json 无 version')

  const extBundleVersion = readExtensionBundleVersion(
    path.join(extDir, 'CSXS', 'manifest.xml'),
    pkg.version
  )
  const doc = writeVersionJson(extDir, buildVersionDoc({
    version: pkg.version,
    extensionBundleVersion: extBundleVersion,
    binaries: collectBinaries(extDir)
  }))

  // 回读校验：写不出 / 内容对不上一律失败，别让坏清单进 zip
  const back = readVersionJson(extDir)
  if (!back || back.version !== pkg.version || back.id !== doc.id) {
    fail('写出后回读不一致：' + JSON.stringify(back))
  }
  console.log('seed-cep-zip-version OK')
  console.log('  dir    ', path.relative(root, extDir) || extDir)
  console.log('  version', doc.version, '/ ext', doc.extensionBundleVersion)
  console.log('  bins   ', doc.binaries.length ? doc.binaries.length + ' 个' : '(none)')
}

main()
