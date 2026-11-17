/**
 * 版本一致性守卫：发版前确认各处版本指向同一个号，避免「package.json 升了、
 * release notes / CEP payload / mac 清单还停在旧版」这类漂移被带进安装包。
 *
 * 用法：
 *   node scripts/check-version-consistency.js                 # 以 package.json 为准
 *   node scripts/check-version-consistency.js --expect 3.8.2  # 额外确认目标版本
 *   RELEASE_VERSION=3.8.2 node scripts/check-version-consistency.js
 *
 * 真相源：package.json.version。--expect / RELEASE_VERSION 用于 CI 显式校验目标版本；
 * 两者不一致直接 FAIL（dry-run 不写回 package.json，故 CI 在非 dry-run 才调用）。
 *
 * 严格项（不一致即 FAIL）：package.json / package-lock.json / release notes 文件。
 * 宽松项（存在才校验，缺失只告警）：CEP payload version.json、mac pkg 清单 —— 本地
 * 开发未必跑过 prepare:cep 或产出安装包；CI 中这些产物由同一版本号生成，不会漂移。
 *
 * 退出码：0 通过（可带告警）/ 1 失败。
 */
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const errors = []
const warns = []

function readJson (rel) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch (e) {
    errors.push(`${rel} 不是合法 JSON：${e.message}`)
    return null
  }
}

function relExists (rel) {
  return fs.existsSync(path.join(root, rel))
}

function parseExpect (argv) {
  let expect = ''
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--expect' && argv[i + 1]) {
      expect = String(argv[++i]).trim()
    }
  }
  return expect || String(process.env.RELEASE_VERSION || '').trim()
}

function note (ok, label, detail) {
  console.log(`  ${ok ? '✔' : '✘'} ${label}${detail ? '  — ' + detail : ''}`)
}

function warn (label, detail) {
  console.log(`  · ${label}  — ${detail}`)
  warns.push(label)
}

function run () {
  const expect = parseExpect(process.argv.slice(2))

  // 真相源
  const pkg = readJson('package.json')
  if (!pkg || !pkg.version) {
    errors.push('package.json 缺少 version')
    console.log('check-version-consistency')
    errors.forEach((e) => console.log('  FAIL', e))
    console.log('Result: 1 failed')
    process.exit(1)
  }
  const version = String(pkg.version).trim()

  console.log('check-version-consistency')
  console.log(`  目标版本 ${version}${expect ? '（--expect ' + expect + '）' : ''}`)
  console.log('')

  if (expect && expect !== version) {
    errors.push(`目标版本 ${expect} 与 package.json ${version} 不一致`)
    note(false, '目标版本', expect + ' ≠ ' + version)
  } else if (expect) {
    note(true, '目标版本', expect)
  }

  // package-lock：顶层 version 与 packages[''].version 都要对齐
  const lock = readJson('package-lock.json')
  if (!lock) {
    errors.push('缺少 package-lock.json')
    note(false, 'package-lock.json', '文件缺失')
  } else {
    const top = String(lock.version || '').trim()
    const rootPkg = lock.packages && lock.packages[''] ? String(lock.packages[''].version || '').trim() : ''
    const ok = top === version && rootPkg === version
    if (!ok) errors.push(`package-lock.json 版本 ${top} / ${rootPkg || '(缺)'} 与 package.json ${version} 不一致`)
    note(ok, 'package-lock.json', `顶层 ${top || '(缺)'} · packages[""] ${rootPkg || '(缺)'}`)
  }

  // release notes：版本文件必须预先建好（CI version job 也依赖这一步）
  const notesRel = `.github/release-notes/v${version}.md`
  const notesOk = relExists(notesRel)
  if (!notesOk) errors.push(`缺少版本文案 ${notesRel}`)
  note(notesOk, 'release notes', notesRel)

  // CEP payload version.json：存在即校验
  const payloadRel = 'build/cep-payload/io.github.isparta-next/version.json'
  const payload = readJson(payloadRel)
  if (!payload) {
    if (relExists(payloadRel)) {
      errors.push(`${payloadRel} 不是合法 JSON`)
      note(false, 'CEP payload version.json', '解析失败')
    } else {
      warn('CEP payload version.json', '未生成（本地可先跑 node scripts/prepare-cep-payload.js）')
    }
  } else {
    const pv = String(payload.version || '').trim()
    const ebv = String(payload.extensionBundleVersion || '').trim()
    let manifestEbv = ''
    try {
      const xml = fs.readFileSync(path.join(root, 'targets/cep/CSXS/manifest.xml'), 'utf8')
      const m = xml.match(/ExtensionBundleVersion="([^"]+)"/)
      if (m) manifestEbv = m[1]
    } catch (e) { /* manifest 缺失由 doctor:pack 负责 */ }
    const verOk = pv === version
    const ebOk = !manifestEbv || ebv === manifestEbv
    if (!verOk) errors.push(`CEP payload version.json version=${pv || '(缺)'} 与 ${version} 不一致`)
    if (!ebOk) errors.push(`CEP payload extensionBundleVersion=${ebv || '(缺)'} 与 manifest ${manifestEbv} 不一致`)
    note(verOk && ebOk, 'CEP payload version.json', `version ${pv || '(缺)'} · ext ${ebv || '(缺)'}`)
  }

  // macOS pkg 清单：存在即校验
  const manifestRel = 'release/latest-mac-pkg.yml'
  if (!relExists(manifestRel)) {
    warn('macOS pkg 清单', `未生成 ${manifestRel}（本地未打包可忽略）`)
  } else {
    let mv = ''
    try {
      const text = fs.readFileSync(path.join(root, manifestRel), 'utf8')
      const m = text.match(/^version:\s*(\S+)\s*$/m)
      if (m) mv = m[1].trim()
    } catch (e) {
      errors.push(`${manifestRel} 不可读：${e.message}`)
    }
    const ok = mv === version
    if (!ok) errors.push(`${manifestRel} version=${mv || '(缺)'} 与 ${version} 不一致`)
    note(ok, 'macOS pkg 清单', `version ${mv || '(缺)'}`)
  }

  console.log('')
  if (errors.length) {
    errors.forEach((e) => console.log('  FAIL', e))
    console.log(`Result: ${errors.length} failed, ${warns.length} warnings`)
    process.exit(1)
  }
  console.log(`Result: OK (${warns.length} warnings)`)
}

run()
