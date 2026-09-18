const fs = require('fs')
const p = 'F:/iSparta/landing/index.html'
let s = fs.readFileSync(p, 'utf8')
console.log('before title', (s.match(/<title>([^<]+)/) || [])[1])
console.log('before hero', (s.match(/id="hero-version"[^>]*>([\s\S]*?)<\/li>/) || [])[1])
s = s.replace(/styles\.css\?v=[^"]+/g, 'styles.css?v=20260918-v336')
s = s.replace(/main\.js\?v=[^"]+/g, 'main.js?v=20260918-v336')
s = s.replace(/i18n\.js\?v=[^"]+/g, 'i18n.js?v=20260918-v336')
// 确保 hero 为 v3.3.6
const ver = '3.3.6'
const date = '2026-09-18'
s = s.replace(
  /(<li id="hero-version"[^>]*>)[\s\S]*?(<\/li>)/,
  '$1v' + ver + '<span class="hero-version-date mono"> · ' + date + '</span>$2'
)
s = s.replace(/"softwareVersion"\s*:\s*"[^"]*"/, '"softwareVersion": "' + ver + '"')
fs.writeFileSync(p, s, 'utf8')
const h = fs.readFileSync(p, 'utf8')
console.log('after title', (h.match(/<title>([^<]+)/) || [])[1])
console.log('after softwareVersion', (h.match(/"softwareVersion"\s*:\s*"([^"]+)"/) || [])[1])
console.log('after hero', (h.match(/id="hero-version"[^>]*>([\s\S]*?)<\/li>/) || [])[1])
console.log('css', (h.match(/styles\.css\?v=[^"]+/) || [])[0])
console.log('main.js', (h.match(/main\.js\?v=[^"]+/) || [])[0])
console.log('has rel-board', h.includes('rel-board'))
console.log('mojibake', /路 APNG|杞/.test(h))
