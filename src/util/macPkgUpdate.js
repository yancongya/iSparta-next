/* macOS pkg channel used by the desktop updater. No Electron dependency. */
const fs = require('fs')
const os = require('os')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const { spawn } = require('child_process')

function get (url, onResponse, redirects) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'iSparta-next-updater' } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume()
        resolve(get(new URL(response.headers.location, url).toString(), onResponse, redirects - 1))
        return
      }
      if (response.statusCode !== 200) {
        response.resume()
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }
      resolve(onResponse(response))
    })
    request.on('error', reject)
    request.setTimeout(30000, () => request.destroy(new Error('download-timeout')))
  })
}

async function text (url) {
  return get(url, (stream) => new Promise((resolve, reject) => {
    let body = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => { body += chunk; if (body.length > 65536) stream.destroy(new Error('manifest-too-large')) })
    stream.on('end', () => resolve(body))
    stream.on('error', reject)
  }), 5)
}

function manifestFile (body, name) {
  const version = (body.match(/^version:\s*(\S+)/m) || [])[1]
  const rows = body.split(/\r?\n/)
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].trim() !== `- url: ${name}`) continue
    const sha512 = (rows[i + 1] || '').match(/^\s+sha512:\s*(\S+)/)
    const size = (rows[i + 2] || '').match(/^\s+size:\s*(\d+)/)
    if (sha512 && size) return { version, sha512: sha512[1], size: Number(size[1]) }
  }
  return null
}

async function download (version, arch, onProgress) {
  if (!/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(version)) throw new Error('invalid-version')
  if (!['x64', 'arm64'].includes(arch)) throw new Error('invalid-arch')
  const name = `isparta-next-${version}-mac-${arch}.pkg`
  const base = 'https://github.com/yancongya/iSparta-next/releases/latest/download/'
  const entry = manifestFile(await text(base + 'latest-mac-pkg.yml'), name)
  if (!entry || entry.version !== version) throw new Error('missing-checksum')
  const dir = path.join(os.tmpdir(), 'iSparta', 'update')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, name)
  const partial = file + '.part'
  try {
    await get(base + `isparta-next-mac-${arch}.pkg`, (stream) => new Promise((resolve, reject) => {
      const output = fs.createWriteStream(partial)
      const hash = crypto.createHash('sha512')
      let received = 0
      stream.on('data', (chunk) => {
        received += chunk.length
        hash.update(chunk)
        onProgress(Math.min(99, received / entry.size * 100))
      })
      stream.pipe(output)
      stream.on('error', reject)
      output.on('error', reject)
      output.on('finish', () => {
        if (received !== entry.size || hash.digest('base64') !== entry.sha512) reject(new Error('checksum-mismatch'))
        else resolve()
      })
    }), 5)
    fs.renameSync(partial, file)
    for (const old of fs.readdirSync(dir)) {
      if (old !== name && /^isparta-next-[\w.+-]+-mac-(?:x64|arm64)\.pkg$/.test(old)) {
        try { fs.unlinkSync(path.join(dir, old)) } catch (e) { /* cleanup is best effort */ }
      }
    }
    onProgress(100)
    return file
  } catch (error) {
    try { fs.unlinkSync(partial) } catch (e) { /* partial absent */ }
    throw error
  }
}

function install (file) {
  return new Promise((resolve, reject) => {
    const quoted = `'${file.replace(/'/g, `'\\''`)}'`
    const script = `do shell script ${JSON.stringify(`/usr/sbin/installer -pkg ${quoted} -target /`)} with administrator privileges`
    const child = spawn('/usr/bin/osascript', ['-e', script], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (data) => { stderr += data.toString().slice(0, 1024) })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(code === 1 && /User canceled|canceled/.test(stderr) ? 'authorization-cancelled' : `installer-failed (${code})`))
    })
  })
}

module.exports = { manifestFile, download, install }
