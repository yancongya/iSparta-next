/**
 * L1：updateCheck 纯逻辑测试（不启动 Electron）
 * 用法：node scripts/updateCheck.l1.js
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

async function main () {
  const mod = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'util', 'updateCheck.js')).href)
  const {
    parseVersionTag,
    compareSemver,
    buildArtifactName,
    buildUrls,
    buildReleaseAssetUrl,
    checkUpdate,
    isAllowedExternalUrl,
    resolveUpdateConfig,
    formatReleaseNotes,
    THROTTLE_MS
  } = mod

  console.log('L1 updateCheck')

  // parse / semver
  ok('parse location', parseVersionTag('https://github.com/o/r/releases/tag/v3.3.4') === '3.3.4')
  ok('parse bare', parseVersionTag('v9.10.0-beta.2') === '9.10.0-beta.2')
  ok('parse invalid', parseVersionTag('nope') === null)
  ok('semver 3.10>3.9', compareSemver('3.10.0', '3.9.0') === 1)
  ok('semver prerelease', compareSemver('3.3.4-beta.1', '3.3.4') === -1)
  ok('semver eq', compareSemver('v3.3.4', '3.3.4') === 0)

  // artifact names
  ok('win artifact', buildArtifactName('win32', 'x64') === 'isparta-next-win-x64.exe')
  ok('mac arm', buildArtifactName('darwin', 'arm64') === 'isparta-next-mac-arm64.zip')
  ok('linux appimage', buildArtifactName('linux', 'x64') === 'isparta-next-linux-x64.AppImage')

  // urls
  const cfg = resolveUpdateConfig({})
  const urls = buildUrls(cfg)
  ok('urls latest', urls.latestRedirect === 'https://github.com/yancongya/iSparta-next/releases/latest')
  ok('urls api default', urls.api === 'https://api.github.com/repos/yancongya/iSparta-next/releases/latest')
  const cfgHttp = resolveUpdateConfig({
    ISPARTA_UPDATE_BASE_URL: 'http://localhost:8124',
    ISPARTA_UPDATE_API_URL: 'http://localhost:8124/api'
  })
  const urlsHttp = buildUrls(cfgHttp)
  ok('http base', urlsHttp.latestRedirect === 'http://localhost:8124/yancongya/iSparta-next/releases/latest')
  // API URL 默认是 host（会补 /repos）；也可直接写到 .../repos
  ok('api env', urlsHttp.api === 'http://localhost:8124/api/repos/yancongya/iSparta-next/releases/latest', urlsHttp.api)
  const cfgHttpRepos = resolveUpdateConfig({
    ISPARTA_UPDATE_API_URL: 'http://localhost:8124/api/repos'
  })
  ok('api env full', buildUrls(cfgHttpRepos).api === 'http://localhost:8124/api/repos/yancongya/iSparta-next/releases/latest')
  ok('asset 2hop', buildReleaseAssetUrl(cfg, '3.3.4', 'isparta-next-win-x64.zip') ===
    'https://github.com/yancongya/iSparta-next/releases/download/v3.3.4/isparta-next-win-x64.zip')

  function stub (opts) {
    const calls = []
    return {
      calls,
      deps: Object.assign({
        env: {},
        currentVersion: '3.3.4',
        platform: 'win32',
        arch: 'x64',
        now: 1000000,
        timeoutMs: 1000,
        force: true,
        enabled: true,
        lastCheckAt: 0,
        skipVersion: '',
        cachedResult: null,
        fetchHead: async (url) => {
          calls.push(['HEAD', url])
          if (opts.head) { return opts.head(url) }
          return { status: 404, location: null }
        },
        fetchJson: async (url) => {
          calls.push(['GET', url])
          if (opts.json) { return opts.json(url) }
          return { status: 404, json: null }
        }
      }, opts.deps || {})
    }
  }

  // 1 available + asset ok
  {
    const s = stub({
      head: (url) => {
        if (/\/releases\/latest$/.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' }
        }
        return { status: 302, location: 'https://release-assets.githubusercontent.com/x' }
      }
    })
    const r = await checkUpdate(s.deps)
    ok('case1 available', r.state === 'available' && r.latest === '9.9.9' && r.assetMissing === false, r)
    ok('case1 downloadUrl', /isparta-next-win-x64\.exe$/.test(r.downloadUrl), r.downloadUrl)
  }

  // 2 latest
  {
    const s = stub({
      head: () => ({ status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v3.3.4' })
    })
    const r = await checkUpdate(s.deps)
    ok('case2 latest', r.state === 'latest', r.state)
  }

  // 3 prerelease not newer than release when current is same core? 9.10.0-beta.2 vs 3.3.4 is newer
  // true prerelease false-positive: current 3.3.4, latest 3.3.4-beta.2 → should be latest
  {
    const s = stub({
      head: () => ({ status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v3.3.4-beta.2' })
    })
    const r = await checkUpdate(s.deps)
    ok('case3 prerelease < release', r.state === 'latest', r.state)
  }

  // 6 asset missing (2nd hop 404)
  {
    const s = stub({
      head: (url) => {
        if (/\/releases\/latest$/.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' }
        }
        if (/\/releases\/download\/v9\.9\.9\//.test(url)) {
          return { status: 404, location: null }
        }
        return { status: 302, location: 'https://x' }
      }
    })
    const r = await checkUpdate(s.deps)
    ok('case6 assetMissing', r.state === 'available' && r.assetMissing === true && /\/releases$/.test(r.fallbackUrl), r)
  }

  // first-hop-only 302 must NOT mark missing — simulate old wrong probe path still ok if 2nd hop exists
  {
    const s = stub({
      head: (url) => {
        if (/\/releases\/latest$/.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' }
        }
        if (/\/latest\/download\//.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/download/v9.9.9/isparta-next-win-x64.zip' }
        }
        return { status: 302, location: 'https://release-assets.githubusercontent.com/ok' }
      }
    })
    const r = await checkUpdate(s.deps)
    ok('case6b asset present via 2hop', r.assetMissing === false, r)
  }

  // 8 mac
  {
    const s = stub({
      deps: { platform: 'darwin', arch: 'arm64' },
      head: (url) => {
        if (/\/releases\/latest$/.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' }
        }
        return { status: 302, location: 'https://release-assets.githubusercontent.com/x' }
      }
    })
    const r = await checkUpdate(s.deps)
    ok('case8 mac', r.needsGatekeeperHint === true && /mac-arm64\.zip$/.test(r.downloadUrl), r)
  }

  // 4 offline
  {
    const s = stub({
      head: () => { throw new Error('ENOTFOUND') },
      json: () => { throw new Error('ECONNREFUSED') }
    })
    const r = await checkUpdate(s.deps)
    ok('case4 offline', r.state === 'offline', r.state)
  }

  // 5 rate-limit
  {
    const s = stub({
      head: () => { throw new Error('net down') },
      json: () => ({ status: 403, json: { message: 'rate limit' } })
    })
    const r = await checkUpdate(s.deps)
    ok('case5 rate-limit', r.state === 'rate-limit', r.state)
  }

  // 9 throttle
  {
    const cached = { state: 'latest', current: '3.3.4', latest: '3.3.4', checkedAt: 1 }
    const s = stub({
      deps: { force: false, lastCheckAt: 1000000 - 1000, now: 1000000, cachedResult: cached },
      head: () => { throw new Error('should not hit network') }
    })
    const r = await checkUpdate(s.deps)
    ok('case9 throttle', r.throttled === true && r.state === 'latest' && s.calls.length === 0, { r, calls: s.calls.length })
  }

  // 10 skip
  {
    const s = stub({
      deps: { skipVersion: '9.9.9' },
      head: () => ({ status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' })
    })
    const r = await checkUpdate(s.deps)
    ok('case10 skipped', r.state === 'skipped', r.state)
  }

  // 11 disabled
  {
    const s = stub({ deps: { enabled: false } })
    const r = await checkUpdate(s.deps)
    ok('case11 disabled', r.state === 'disabled' && s.calls.length === 0, { r, calls: s.calls.length })
  }

  // 12 whitelist
  ok('whitelist good', isAllowedExternalUrl('https://github.com/yancongya/iSparta-next/releases/latest', {}) === true)
  ok('whitelist evil', isAllowedExternalUrl('https://evil.example/x', {}) === false)
  ok('whitelist traversal', isAllowedExternalUrl('https://github.com/yancongya/iSparta-next/../evil', {}) === false)
  ok('whitelist ftp', isAllowedExternalUrl('ftp://github.com/yancongya/iSparta-next/x', {}) === false)
  ok('whitelist fixture http', isAllowedExternalUrl('http://localhost:8124/yancongya/iSparta-next/releases', {
    ISPARTA_UPDATE_BASE_URL: 'http://localhost:8124'
  }) === true)

  // throttle ms sanity
  ok('throttle 24h', THROTTLE_MS === 24 * 60 * 60 * 1000)

  // release notes formatting
  {
    const raw = [
      '## 更新说明 / What\'s Changed',
      '',
      '### 新功能 Features',
      '- feat: 新增自动更新',
      '- fix: 修复弹窗',
      '',
      '### 工程 / CI',
      '- chore(release): v3.3.5 [skip ci]',
      '- ci: bump',
      '',
      '---',
      '**Full Changelog**: https://github.com/o/r/compare/v1...v2'
    ].join('\n')
    const pretty = formatReleaseNotes(raw)
    ok('notes keep feat/fix', pretty && pretty.indexOf('feat:') >= 0 && pretty.indexOf('fix:') >= 0, pretty)
    ok('notes drop chore', pretty && pretty.indexOf('chore(release)') < 0, pretty)
    ok('notes drop compare url', pretty && pretty.indexOf('/compare/') < 0, pretty)
  }

  // available always attaches notes when API returns matching tag body
  {
    const s = stub({
      head: (url) => {
        if (/\/releases\/latest$/.test(url)) {
          return { status: 302, location: 'https://github.com/yancongya/iSparta-next/releases/tag/v9.9.9' }
        }
        return { status: 302, location: 'https://release-assets.githubusercontent.com/x' }
      },
      json: () => ({
        status: 200,
        json: {
          tag_name: 'v9.9.9',
          body: '## Features\n- feat: demo notes\n\n### 工程 / CI\n- chore: x [skip ci]'
        }
      })
    })
    const r = await checkUpdate(s.deps)
    ok('case notes attached', r.state === 'available' && r.notes && r.notes.indexOf('demo notes') >= 0, r.notes)
  }

  console.log('\nResult:', passed, 'passed,', failed, 'failed')
  if (failed) { process.exitCode = 1 }
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
