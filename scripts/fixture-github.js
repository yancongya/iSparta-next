/**
 * 批次 C 前用：假 GitHub fixture（http，端口 8124）
 * 用法：node scripts/fixture-github.js
 * env:
 *   FIXTURE_MODE=available|latest|offline|asset-missing|prerelease|timeout
 *   FIXTURE_VERSION=9.9.9
 *   FIXTURE_CURRENT=3.3.4
 */
const http = require('http')

const PORT = Number(process.env.FIXTURE_PORT || 8124)
const MODE = process.env.FIXTURE_MODE || 'available'
const VERSION = process.env.FIXTURE_VERSION || '9.9.9'
const CURRENT = process.env.FIXTURE_CURRENT || '3.3.4'

function tagForMode () {
  if (MODE === 'latest') { return 'v' + CURRENT }
  if (MODE === 'prerelease') { return 'v9.10.0-beta.2' }
  return 'v' + VERSION
}

const server = http.createServer((req, res) => {
  const url = req.url || ''
  console.log('[fixture]', MODE, req.method, url)

  if (MODE === 'timeout') {
    // 挂起不响应
    return
  }

  if (MODE === 'offline') {
    res.destroy()
    return
  }

  // API
  if (url.indexOf('/api/repos/') === 0 || (url.indexOf('/repos/') >= 0 && url.indexOf('releases/latest') >= 0)) {
    if (MODE === 'rate-limit') {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ message: 'API rate limit exceeded' }))
      return
    }
    const notesBody = [
      '## 更新说明 / What\'s Changed',
      '',
      '### 新功能 Features',
      '- feat: fixture 演示用更新说明',
      '- fix: 修复弹窗展示',
      '',
      '### 工程 / CI',
      '- chore(release): v' + tagForMode().replace(/^v/, '') + ' [skip ci]',
      '- ci: dummy',
      '',
      '---',
      '**Full Changelog**: https://github.com/yancongya/iSparta-next/compare/v0...v1'
    ].join('\n')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      tag_name: tagForMode(),
      body: notesBody,
      assets: []
    }))
    return
  }

  // latest redirect
  if (/\/releases\/latest\/download\//.test(url)) {
    // 第一跳：恒 302 到 tag 资产路径（与真实 GitHub 一致）
    const artifact = url.split('/').pop()
    const loc = '/yancongya/iSparta-next/releases/download/' + tagForMode() + '/' + artifact
    res.writeHead(302, { Location: loc })
    res.end()
    return
  }

  if (/\/releases\/download\//.test(url)) {
    if (MODE === 'asset-missing') {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    res.writeHead(302, { Location: 'https://release-assets.githubusercontent.com/fixture' })
    res.end()
    return
  }

  if (/\/releases\/latest$/.test(url) || /\/releases\/latest\/?$/.test(url)) {
    res.writeHead(302, { Location: '/yancongya/iSparta-next/releases/tag/' + tagForMode() })
    res.end()
    return
  }

  if (/\/releases$/.test(url)) {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end('<html><body>Releases</body></html>')
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('fixture github on http://127.0.0.1:' + PORT + ' mode=' + MODE + ' tag=' + tagForMode())
})
