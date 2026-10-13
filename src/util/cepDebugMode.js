/**
 * macOS CEP 调试模式：扩展落盘后自动开启 AE 的 PlayerDebugMode。
 *
 * 为什么不自己拼 `defaults write` 命令
 * ------------------------------------
 * 支持的 CSXS 版本区间是**唯一真相源**：public/install/install-as-admin。
 * 那份脚本随 payload 一起分发（prepare-cep-payload → stageInstallHelpers），
 * 早就发给用户手动执行过。Adobe 哪天加了 CSXS.26，只会去改那个脚本；
 * 在这里再抄一份版本列表必然漂移。所以直接跑 payload 里那一份。
 *
 * 为什么只在 mac 生效
 * ------------------
 * Windows 由 NSIS 组件页写注册表（build/installer.nsh 的 installSection），
 * 应用再写一遍是重复劳动；macOS pkg 在安装时部署系统级扩展，
 * 而桌面应用每次启动都会自检并刷新扩展目录（util/cepSync），这里正好接上。
 *
 * 何时跑
 * ------
 * · 扩展刚被重拷 / 新装（ensureCepExtension 返回 refreshed）
 * · 或扩展目录里没有 .player-debug-mode 标记（覆盖「扩展早就装好了、
 *   但应用是第一次带上本机制」的升级场景）
 *
 * 标记**写在扩展目录内**：刷新扩展会连目录一起重建，标记随之消失 ——
 * 语义正好是「这一份扩展已应用过调试模式」。顺带避免了每次启动都跑一遍
 * killall cfprefsd（那会重启用户的偏好守护进程，不该反复惊动）。
 *
 * 副作用边界：只在缺标记时写，且脚本本身幂等；用户手动关掉调试模式后，
 * 应用不会再去动它（除非扩展被再次安装 / 更新）。
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const SCRIPT_NAME = 'install-as-admin'
const MARKER_NAME = '.player-debug-mode'
const SCRIPT_TIMEOUT_MS = 20000

function markerPath (destDir) {
  // The pkg installs CEP in /Library, which the desktop app cannot write.
  // Keep the per-user debug-mode marker outside the system extension.
  if (process.platform === 'darwin') {
    const version = (() => {
      try { return JSON.parse(fs.readFileSync(path.join(destDir, 'version.json'), 'utf8')).version || '' } catch (e) { return '' }
    })()
    return path.join(require('os').homedir(), 'Library', 'Application Support', 'iSparta-next', `${MARKER_NAME}-${version}`)
  }
  return path.join(destDir, MARKER_NAME)
}

/** 扩展目录里是否已经落过标记 */
function isApplied (destDir) {
  try {
    return !!destDir && fs.existsSync(markerPath(destDir))
  } catch (e) {
    return false
  }
}

/**
 * macOS 扩展落盘后开启 CEP 调试模式。
 * @param {object} opts
 *   platform {string}  默认 process.platform
 *   dest {string}      扩展目录（ensureCepExtension 返回的 dest）
 *   payloadDir {string} payload 根目录（内含 install/install-as-admin）
 *   refreshed {boolean} 本次启动是否刚重拷过扩展
 *   force {boolean}    无条件重跑
 * @returns {{ applied: boolean, reason: string, script?: string, error?: string }}
 */
function ensurePlayerDebugMode (opts) {
  const o = opts || {}
  const platform = o.platform || process.platform

  if (platform !== 'darwin') {
    // win32 由 NSIS 写注册表；linux 未提供桌面端安装包，都不归这里管
    return { applied: false, reason: platform === 'win32' ? 'nsis-installer' : 'unsupported-platform' }
  }

  const dest = o.dest || ''
  if (!dest) return { applied: false, reason: 'no-dest' }
  if (!fs.existsSync(dest)) return { applied: false, reason: 'not-installed' }
  if (!o.force && !o.refreshed && isApplied(dest)) {
    return { applied: false, reason: 'already-applied' }
  }

  const script = path.join(o.payloadDir || '', 'install', SCRIPT_NAME)
  if (!o.payloadDir || !fs.existsSync(script)) {
    return { applied: false, reason: 'no-script', script: script }
  }

  try {
    // 显式走 /bin/bash，不依赖可执行位：zip 解压出来权限位经常已丢。
    // stdio 必须显式给全，否则受限环境下 execFileSync 会 EBUSY。
    execFileSync('/bin/bash', [script], {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: SCRIPT_TIMEOUT_MS
    })
  } catch (e) {
    // 不写标记：下次启动还会重试（可能是 AE 正在退出占用偏好域）
    return {
      applied: false,
      reason: 'exec-failed',
      script: script,
      error: String((e && e.message) || e)
    }
  }

  try {
    fs.mkdirSync(path.dirname(markerPath(dest)), { recursive: true })
    fs.writeFileSync(markerPath(dest), new Date().toISOString() + '\n', 'utf8')
  } catch (e) {
    // 脚本已生效，只是下次会多跑一遍 —— 不当失败处理
    return { applied: true, reason: 'ok-no-marker', script: script }
  }
  return { applied: true, reason: 'ok', script: script }
}

module.exports = {
  SCRIPT_NAME,
  MARKER_NAME,
  isApplied,
  ensurePlayerDebugMode
}
