/**
 * 落地页构建期烘焙：GitHub Releases → landing/releases.json + index.html 兜底值
 * 用法：node scripts/bake-landing.js
 * CI：pages.yml 在 upload artifact 前调用（可 continue-on-error）
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const REPO = process.env.ISPARTA_UPDATE_REPO || 'yancongya/iSparta-next'
const PER_PAGE = Number(process.env.LANDING_RELEASE_COUNT || 8)
const ROOT = path.join(__dirname, '..')
const LANDING = path.join(ROOT, 'landing')
const OUT_JSON = path.join(LANDING, 'releases.json')
const INDEX = path.join(LANDING, 'index.html')

function getJson (url) {
  return new Promise(function (resolve, reject) {
    const headers = { 'User-Agent': 'isparta-landing-bake', Accept: 'application/vnd.github+json' }
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN
    }
    https.get(url, { headers }, function (res) {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', function (c) { body += c })
      res.on('end', function () {
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ' ' + url))
          return
        }
        try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

/** 面向用户：滤掉 chore/ci/[skip ci]/compare/Installers 噪音 */
function formatNotes (body) {
  if (typeof body !== 'string' || !body.trim()) { return null }
  const lines = body.split(/\r?\n/)
  const out = []
  let skip = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const t = line.trim()
    if (/^#{1,6}\s/.test(t)) {
      skip = /工程|CI|Chore|chore|Other|其他|Commits|Full Changelog|Installers|安装包/i.test(t)
      if (/功能|修复|Features|Fixes|Docs|文档/i.test(t) && !skip) { out.push(line) }
      continue
    }
    if (skip) { continue }
    if (/^\[skip ci\]|^chore(\(|:)|^ci(\(|:)|^build(\(|:)|^refactor(\(|:)|^perf(\(|:)/i.test(t)) { continue }
    if (/github\.com\/.*\/compare\//i.test(t)) { continue }
    if (/^\|.*\|$/ && /Platform|Asset|Windows|Linux|macOS/i.test(t)) { continue }
    if (/^>|Gatekeeper|未签名|xattr/i.test(t)) { continue }
    if (/^---\s*$/.test(t)) { continue }
    out.push(line)
  }
  const text = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return text || null
}

function pickAsset (assets, patterns) {
  const names = {}
  ;(assets || []).forEach(function (a) { names[a.name] = a })
  for (let i = 0; i < patterns.length; i++) {
    const re = patterns[i]
    for (const n in names) {
      if (re.test(n)) {
        return {
          name: n,
          url: names[n].browser_download_url,
          size: names[n].size || 0,
          downloadCount: names[n].download_count || 0
        }
      }
    }
  }
  return null
}

function mapRelease (rel) {
  const assets = rel.assets || []
  return {
    tag: rel.tag_name || '',
    name: rel.name || rel.tag_name || '',
    publishedAt: rel.published_at || rel.created_at || '',
    notes: formatNotes(rel.body),
    assets: {
      win: pickAsset(assets, [/win-x64\.exe$/i, /win-x64\.zip$/i]),
      macArm: pickAsset(assets, [/mac-arm64\.zip$/i]),
      macX64: pickAsset(assets, [/mac-x64\.zip$/i]),
      linux: pickAsset(assets, [/linux-x64\.AppImage$/i, /linux-x64\.tar\.gz$/i])
    },
    htmlUrl: rel.html_url || ('https://github.com/' + REPO + '/releases/tag/' + (rel.tag_name || ''))
  }
}

function formatDate (iso) {
  if (!iso) { return '' }
  const d = new Date(iso)
  if (isNaN(d.getTime())) { return '' }
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

function bakeHtmlFallbacks (latest) {
  if (!fs.existsSync(INDEX)) { return }
  let html = fs.readFileSync(INDEX, 'utf8')
  const ver = (latest.tag || '').replace(/^v/i, '') || '3.3.4'
  const date = formatDate(latest.publishedAt) || '2026-09-18'
  html = html.replace(/"softwareVersion"\s*:\s*"[^"]*"/, '"softwareVersion": "' + ver + '"')
  html = html.replace(
    /(<li id="hero-version"[^>]*>)[^<]*(<\/li>)/,
    '$1v' + ver + '<span class="hero-version-date mono"> · ' + date + '</span>$2'
  )
  // 兼容纯文本形式
  html = html.replace(
    /(<li id="hero-version"[^>]*>)v[\d.]+(<\/li>)/,
    '$1v' + ver + '<span class="hero-version-date mono"> · ' + date + '</span>$2'
  )
  fs.writeFileSync(INDEX, html, 'utf8')
  console.log('index.html fallback:', 'v' + ver, date)
}

function bakeSitemap (iso) {
  const p = path.join(LANDING, 'sitemap.xml')
  if (!fs.existsSync(p) || !iso) { return }
  const mod = formatDate(iso)
  if (!mod) { return }
  let xml = fs.readFileSync(p, 'utf8')
  xml = xml.replace(/<lastmod>[^<]*<\/lastmod>/g, '<lastmod>' + mod + '</lastmod>')
  if (xml.indexOf('<lastmod>') < 0) {
    xml = xml.replace(/<changefreq>/g, '<lastmod>' + mod + '</lastmod>\n    <changefreq>')
  }
  fs.writeFileSync(p, xml, 'utf8')
  console.log('sitemap lastmod:', mod)
}

async function main () {
  const url = 'https://api.github.com/repos/' + REPO + '/releases?per_page=' + PER_PAGE
  console.log('bake', url)
  let list
  try {
    list = await getJson(url)
  } catch (e) {
    console.error('bake failed, keep previous releases.json:', e.message)
    process.exitCode = 0
    return
  }
  const releases = (list || []).filter(function (r) { return !r.draft }).map(mapRelease)
  const payload = {
    generatedAt: new Date().toISOString(),
    repo: REPO,
    releases: releases
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log('wrote', OUT_JSON, 'count=', releases.length)
  if (releases[0]) {
    bakeHtmlFallbacks(releases[0])
    bakeSitemap(releases[0].publishedAt)
  }
}

main().catch(function (e) {
  console.error(e)
  process.exitCode = 0
})
