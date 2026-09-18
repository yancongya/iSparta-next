const fs = require('fs')
const path = 'F:/iSparta/landing/index.html'
let s = fs.readFileSync(path, 'utf8')
s = s.replace(/styles\.css\?v=[^"]+/g, 'styles.css?v=20260918-live-api')
s = s.replace(/main\.js\?v=[^"]+/g, 'main.js?v=20260918-live-api')
s = s.replace(/i18n\.js\?v=[^"]+/g, 'i18n.js?v=20260918-live-api')
// 静态兜底仍写当前已知版本，仅在 API 全失败时展示
s = s.replace(/"softwareVersion"\s*:\s*"[^"]*"/, '"softwareVersion": "3.3.6"')
s = s.replace(
  /(<li id="hero-version"[^>]*>)[\s\S]*?(<\/li>)/,
  '$1v3.3.6<span class="hero-version-date mono"> · 2026-09-18</span>$2'
)
fs.writeFileSync(path, s, 'utf8')
const h = fs.readFileSync(path, 'utf8')
console.log('title', (h.match(/<title>([^<]+)/) || [])[1])
console.log('hero', (h.match(/id="hero-version"[^>]*>([\s\S]*?)<\/li>/) || [])[1])
console.log('css', (h.match(/styles\.css\?v=[^"]+/) || [])[0])
console.log('main', (h.match(/main\.js\?v=[^"]+/) || [])[0])
console.log('mojibake', /杞|路 APNG/.test(h))
