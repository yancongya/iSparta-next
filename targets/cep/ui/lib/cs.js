/**
 * cs.js — 最小 CSInterface 封装（不引入完整 Adobe CSInterface.js）
 * 路径 / evalScript / 基础事件，够 W2 面板用。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.ispartaCS = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function adobe () {
    return (typeof window !== 'undefined' && window.__adobe_cep__) || null
  }

  function getSystemPath (pathType) {
    var a = adobe()
    if (!a || !a.getSystemPath) { return '' }
    var raw = String(a.getSystemPath(pathType || 'extension') || '')
    try { raw = decodeURI(raw) } catch (e) { /* keep raw */ }
    // CEP 可能给 file:///C:/... 或 /C:/...，统一成 Windows 路径，避免 bin 拼到 CEP\extensions\
    raw = raw.replace(/^file:\/+/i, '')
    if (/^\/[A-Za-z]:/.test(raw)) { raw = raw.substring(1) }
    return raw.replace(/[\\/]+$/, '')
  }

  function getExtensionPath () {
    return getSystemPath('extension')
  }

  function evalScript (script) {
    return new Promise(function (resolve, reject) {
      if (typeof window === 'undefined') {
        reject(new Error('window.cep.evalScript unavailable'))
        return
      }
      // CEP 原生桥是 __adobe_cep__；window.cep 仅在加载 CSInterface 等脚本后存在
      var host = (window.cep && window.cep.evalScript && window.cep) ||
        (window.__adobe_cep__ && window.__adobe_cep__.evalScript && window.__adobe_cep__) ||
        null
      if (!host) {
        reject(new Error('window.cep.evalScript unavailable'))
        return
      }
      host.evalScript(script, function (result) {
        if (result === 'EvalScript error.') {
          reject(new Error('EvalScript error'))
          return
        }
        resolve(result)
      })
    })
  }

  /** 解析 hostscript 返回的 JSON 字符串；失败原样抛错 */
  function evalJson (script) {
    return evalScript(script).then(function (raw) {
      if (raw === null || raw === undefined || raw === '' || raw === 'undefined') {
        throw new Error('empty host result')
      }
      try {
        return JSON.parse(raw)
      } catch (e) {
        throw new Error('host JSON parse failed: ' + String(raw).slice(0, 200))
      }
    })
  }

  /** CEP 打开系统默认浏览器（cep-playground：cep.util.openURLInDefaultBrowser） */
  function openURLInDefaultBrowser (url) {
    if (typeof window !== 'undefined' && window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
      window.cep.util.openURLInDefaultBrowser(String(url))
      return true
    }
    // 铁律：外链只用 cep.util.openURLInDefaultBrowser。
    // 禁止 location.href 兜底（会把面板自身导航走，扩展白屏）。
    return false
  }

  /** 收 jsx CSXSEvent（__adobe_cep__.addEventListener）；无宿主返回 false */
  function addEventListener (type, listener) {
    var a = adobe()
    if (a && typeof a.addEventListener === 'function') {
      a.addEventListener(String(type), listener)
      return true
    }
    return false
  }

  function removeEventListener (type, listener) {
    var a = adobe()
    if (a && typeof a.removeEventListener === 'function') {
      a.removeEventListener(String(type), listener)
      return true
    }
    return false
  }

  return {
    getSystemPath: getSystemPath,
    getExtensionPath: getExtensionPath,
    evalScript: evalScript,
    evalJson: evalJson,
    openURLInDefaultBrowser: openURLInDefaultBrowser,
    addEventListener: addEventListener,
    removeEventListener: removeEventListener
  }
})
