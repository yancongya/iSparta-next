/**
 * 引导页预览台静态服务（零依赖）
 * 用法：node scripts/dev/serve-guide-preview.js [port]
 * 默认 http://127.0.0.1:8090 → scripts/dev/guide-preview/
 *
 * 用途：不打包、不起 Electron，直接在浏览器里迭代引导页视觉与动图 SVG。
 *      正式组件落地后用现成的 dev 链预览（桌面 Web :8081 / CEP :8082）。
 *
 * ⚠ 端口为什么从 8083 挪到 8090：
 *   vue-cli 的 dev server 在 8081 被占时会**自动顺延**（8081 → 8082 → 8083…），
 *   正好会霸占本预览台的旧默认端口。表现极具误导性 —— 打开 :8083 看到的是
 *   「应用本体（RootGate → 引导页）」而不是预览台，很容易误判成预览台坏了。
 *   8090 在顺延链之外（顺延只会 +1），且本脚本还会在**端口被别的服务应答**时
 *   继续顺延，并把真实端口显著打印出来，不再静默假成功。
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, 'guide-preview')
const PREFERRED = Number(process.argv[2] || process.env.GUIDE_PREVIEW_PORT || 8090)
/** 页面上独有的标记：用来确认「应答这个端口的确实是我们自己」 */
const MARKER = 'id="dots"'
const MAX_TRIES = 20

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
  '.txt': 'text/plain; charset=utf-8'
}

function handler (req, res) {
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
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    })
    res.end(buf)
  })
}

/** 问一下这个端口上到底是谁在应答；连不上返回 null */
function probe (port) {
  return new Promise(function (resolve) {
    var req = http.get({ host: '127.0.0.1', port: port, path: '/' }, function (res) {
      var body = ''
      res.on('data', function (c) { body += c })
      res.on('end', function () { resolve(body) })
    })
    req.setTimeout(800, function () { req.destroy(); resolve(null) })
    req.on('error', function () { resolve(null) })
  })
}

function start (port, tries) {
  var server = http.createServer(handler)

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE' && tries > 0) {
      console.log('[guide-preview] :' + port + ' 已被占用 → 试 :' + (port + 1))
      start(port + 1, tries - 1)
      return
    }
    console.error('[guide-preview] 起不来：' + err.message)
    process.exit(1)
  })

  server.listen(port, '127.0.0.1', function () {
    probe(port).then(function (body) {
      // 连上了但不是我们 → 这个端口实际上被别的服务抢答了（如 vue-cli 顺延过来的 dev server）
      if (body !== null && body.indexOf(MARKER) < 0) {
        console.log('[guide-preview] :' + port + ' 被别的服务应答（不是预览台）→ 试 :' + (port + 1))
        server.close(function () {
          if (tries > 0) { start(port + 1, tries - 1) } else { process.exit(1) }
        })
        return
      }
      console.log('')
      console.log('  iSparta-next · 引导页预览台')
      console.log('  →  http://127.0.0.1:' + port)
      console.log('     源目录  ' + ROOT)
      console.log('     深链    #step=N&rt=cep|desktop&lang=zh-CN|zh-TW|en&theme=dark|light')
      console.log('')
    })
  })
}

start(PREFERRED, MAX_TRIES)
