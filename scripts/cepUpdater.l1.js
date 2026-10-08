/**
 * L1：cepUpdater 纯函数测试（不启动 Electron / CEP，只测适配层不碰 ipc 的部分）
 * 用法：node scripts/cepUpdater.l1.js
 *
 * 覆盖 latest.yml 解析（CEP 下载前拿 sha512 的唯一来源，YAML 极易手写出错）、
 * 安装包落盘目录、桥快照 → UI auto 形状的映射。
 */
const path = require('path')
const { pathToFileURL } = require('url')

let passed = 0
let failed = 0

function ok (name, cond, detail) {
  if (cond) {
    passed += 1
    console.log('  PASS', name)
  } else {
    failed += 1
    console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail))
  }
}

/** electron-builder 真实产出的 latest.yml 形状（files 列表 + 顶层 path/sha512 并存） */
const YML = [
  'version: 3.5.0',
  'files:',
  '  - url: isparta-next-3.5.0-win-x64.exe',
  '    sha512: AAA111',
  '    size: 104465408',
  '  - url: isparta-next-3.5.0-win-x64.exe.blockmap',
  '    sha512: BBB222',
  '    size: 123456',
  'path: isparta-next-3.5.0-win-x64.exe',
  'sha512: AAA111',
  "releaseDate: '2026-10-08T00:00:00.000Z'"
].join('\n')

async function main () {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'util', 'cepUpdater.js')).href)
  const { parseLatestYml, installerDir, toAutoState, POLL_MS } = mod

  console.log('L1 cepUpdater')

  // ---------- parseLatestYml ----------
  const hit = parseLatestYml(YML, 'isparta-next-3.5.0-win-x64.exe')
  ok('yml 命中指定资产', !!hit && hit.sha512 === 'AAA111' && hit.size === 104465408, hit)
  ok('yml 带出顶层版本号', !!hit && hit.version === '3.5.0', hit)

  // blockmap 与主包同前缀，必须能区分（选错就会下到差量包上）
  const mapHit = parseLatestYml(YML, 'isparta-next-3.5.0-win-x64.exe.blockmap')
  ok('yml 区分 blockmap 与主包', !!mapHit && mapHit.sha512 === 'BBB222', mapHit)

  ok('yml 无匹配资产返回 null', parseLatestYml(YML, 'nope.exe') === null)
  ok('yml 空文本返回 null', parseLatestYml('', 'x.exe') === null)
  ok('yml null 输入返回 null', parseLatestYml(null, 'x.exe') === null)

  const first = parseLatestYml(YML, '')
  ok('yml 不给资产名时退首个 entry', !!first && first.sha512 === 'AAA111', first)

  // 老版 electron-builder 只写顶层 path/sha512/size
  const flat = parseLatestYml(
    ['version: 1.0.0', 'path: a.exe', 'sha512: CCC333', 'size: 10'].join('\n'),
    'a.exe'
  )
  ok('yml 顶层 path 形态', !!flat && flat.sha512 === 'CCC333' && flat.size === 10, flat)

  const crlf = parseLatestYml(YML.replace(/\n/g, '\r\n'), 'isparta-next-3.5.0-win-x64.exe')
  ok('yml 兼容 CRLF', !!crlf && crlf.sha512 === 'AAA111', crlf)

  // ---------- installerDir ----------
  const dir = installerDir({ tmpdir: () => '/tmp' }, { join: (...a) => a.join('/') })
  ok('安装包落盘目录 = tmpdir/iSparta/update', dir === '/tmp/iSparta/update', dir)

  // ---------- toAutoState（桥快照 → UI auto 形状）----------
  const st = toAutoState(
    { downloading: true, downloaded: false, progress: 0.42, verified: false, file: 'C:/x.exe', active: true },
    { launched: false }
  )
  ok('autoState 映射下载中', st.downloading === true && st.downloaded === false && st.progress === 0.42, st)
  ok('autoState mode = installer（UI 据此切 CEP 终态文案）', st.mode === 'installer', st.mode)
  ok('autoState 无桥环境 supported=false', st.supported === false, st.supported)

  const st2 = toAutoState({ downloaded: true, verified: true, file: 'C:/x.exe' })
  ok('autoState 映射已完成 + 校验位', st2.downloaded === true && st2.verified === true, st2)

  const st3 = toAutoState(null, null)
  ok('autoState 空快照仍返回完整形状', !!st3 && st3.downloading === false && st3.progress === 0, st3)

  ok('autoState extra 覆盖', toAutoState({}, { version: '9.9.9' }).version === '9.9.9')

  // ---------- 轮询常量 ----------
  ok('POLL_MS 为正整数', Number.isInteger(POLL_MS) && POLL_MS > 0, POLL_MS)

  console.log('\nResult:', passed, 'passed,', failed, 'failed')
  if (failed) { process.exitCode = 1 }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
