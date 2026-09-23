/**
 * cli.js — 扩展内编码器子集的定位与自检（W2u 降级）
 *
 * 编码路径已统一走 src/util/processor/*（挂 cep-bridge → ispartaAPI）。
 * 本文件只保留：平台识别、bin 路径、mac 自愈（chmod + 清 quarantine）、自检。
 * 不再提供 pngsToApng / pngsToWebp 等旁路编码。
 *
 * 二进制放在 <extension>/bin/<win32|win64|mac|linux>/，见 bin/README.md。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cep-bridge'), require('./cs'))
  } else {
    root.ispartaCli = factory(root.ispartaCepBridge, root.ispartaCS)
  }
})(typeof self !== 'undefined' ? self : this, function (bridge, cs) {
  var fs = bridge.fs
  var path = bridge.path

  function platformId () {
    if (typeof process !== 'undefined' && process.platform === 'win32') {
      return (process.arch === 'ia32') ? 'win32' : 'win64'
    }
    if (typeof process !== 'undefined' && process.platform === 'darwin') {
      return 'mac'
    }
    if (typeof process !== 'undefined' && process.platform === 'linux') {
      return 'linux'
    }
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
    if (/Mac/i.test(ua) || /Mac/i.test(navigator.platform || '')) { return 'mac' }
    if (/Win64|WOW64|x64/i.test(ua)) { return 'win64' }
    if (/Win/i.test(ua)) { return 'win32' }
    return 'linux'
  }

  function isWindows () {
    return platformId() === 'win32' || platformId() === 'win64'
  }

  function extensionRoot () {
    var root = cs.getExtensionPath()
    if (root) { return root }
    return path.join(__dirname, '..')
  }

  function binDir () {
    return path.join(extensionRoot(), 'bin', platformId())
  }

  /** 扩展内 bin 工具绝对路径；Windows 自动补 .exe（与 processor Action.bin 同布局） */
  function toolPath (name) {
    var file = isWindows() ? (name + '.exe') : name
    return path.join(binDir(), file)
  }

  function ensureRunnable (binPath) {
    if (!bridge.hasNode) { return }
    try {
      require('fs').chmodSync(binPath, 0o755)
    } catch (e) { /* spawn 时再报 */ }

    if (platformId() !== 'mac') { return }
    var sentinel = path.join(path.dirname(binPath), '.quarantine-cleared')
    try {
      if (fs.existsSync(sentinel)) { return }
    } catch (e) { /* fallthrough */ }

    var targets = [binPath, path.dirname(binPath)]
    for (var i = 0; i < targets.length; i++) {
      try {
        require('child_process').execFileSync(
          '/usr/bin/xattr',
          ['-r', '-d', 'com.apple.quarantine', targets[i]],
          { stdio: 'ignore' }
        )
      } catch (e) { /* 无属性属正常 */ }
    }
    try { fs.writeFileSync(sentinel, String(new Date().getTime())) } catch (e) { /* ignore */ }
  }

  /** 扩展自检：processor 将用到的 bin 子集是否齐全 */
  function checkTools () {
    var names = ['apngasm', 'apngquant', 'apngopt', 'apng2gif', 'apng2webp', 'cwebp', 'dwebp', 'webpmux']
    var missing = []
    for (var i = 0; i < names.length; i++) {
      if (!fs.existsSync(toolPath(names[i]))) {
        missing.push(names[i])
      }
    }
    return {
      ok: missing.length === 0,
      platform: platformId(),
      binDir: binDir(),
      missing: missing
    }
  }

  return {
    platformId: platformId,
    isWindows: isWindows,
    extensionRoot: extensionRoot,
    binDir: binDir,
    toolPath: toolPath,
    ensureRunnable: ensureRunnable,
    checkTools: checkTools
  }
})
