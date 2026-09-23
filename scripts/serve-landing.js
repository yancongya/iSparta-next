/**
 * 落地页静态预览（零依赖）
 * 用法：node scripts/serve-landing.js [port]
 * 默认 http://127.0.0.1:8080 指向 landing/
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'landing')
const PORT = Number(process.argv[2] || process.env.LANDING_PORT || 8080)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
}

const server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent(String(req.url || '/').split('?')[0])
  if (urlPath.endsWith('/')) { urlPath += 'index.html' }
  var file = path.normalize(path.join(ROOT, urlPath))
  if (!file.startsWith(ROOT)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found: ' + urlPath)
      return
    }
    var ext = path.extname(file).toLowerCase()
    res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream' })
    res.end(buf)
  })
})

server.listen(PORT, '127.0.0.1', function () {
  console.log('[landing] http://127.0.0.1:' + PORT + ' → ' + ROOT)
})
