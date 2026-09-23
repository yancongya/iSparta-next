// hostAdapter：双端只换实现，不换调用方（docs/EXEC-WAVE2.md §2.1）
// W6-shell 可继续扩展 openPath/pickFolder 细节；此处先冻结接口名与 supportsCompImport。
/* global window */

function detectKind () {
  if (typeof window === 'undefined') { return 'browser-mock' }
  // CEP 优先：注入 ispartaAPI 后 process 形状会像 Electron，必须先认宿主
  if (window.__adobe_cep__ || window.cep || window.ispartaCS || window.ispartaCepBridge) {
    return 'cep'
  }
  if (window.ispartaAPI && window.ispartaAPI.ipc) {
    return 'electron'
  }
  return 'browser-mock'
}

const kind = detectKind()
const isCep = kind === 'cep'
const isElectron = kind === 'electron'

function ipc () {
  return (typeof window !== 'undefined' && window.ispartaAPI && window.ispartaAPI.ipc) || null
}

function cs () {
  return (typeof window !== 'undefined' && window.ispartaCS) || null
}

export const hostAdapter = {
  kind,
  updatePolicy: isElectron ? 'full' : (isCep ? 'none' : 'none'),
  supportsFileImport: !isCep,
  supportsCompImport: isCep,
  // 逐帧 delay：合成 fps 已由 AE 定，CEP 不适用（hostAdapter 隐藏，不删桌面功能）
  supportsFrameDelay: !isCep,

  openPath (target) {
    const ip = ipc()
    if (ip) {
      return ip.invoke('shell:openPath', target).catch(() => {})
    }
    return Promise.resolve(false)
  },
  reveal (target) {
    const ip = ipc()
    if (ip) {
      return ip.invoke('shell:showItemInFolder', target).catch(() => {})
    }
    return Promise.resolve(false)
  },
  pickFolder (defaultPath) {
    const host = cs()
    if (host) {
      return host.evalJson(
        'ispartaPickOutputFolder(' + JSON.stringify(String(defaultPath || '')) + ')'
      ).then((res) => {
        if (res && res.ok && res.path) { return res.path }
        return null
      })
    }
    const ip = ipc()
    if (ip) {
      return ip.invoke('dialog:openDirectory', {
        properties: ['openDirectory'],
        defaultPath: defaultPath || undefined
      }).then((result) => {
        if (!result || result.canceled) { return null }
        if (result.filePaths && result.filePaths[0]) { return result.filePaths[0] }
        if (result.path) { return result.path }
        return null
      }).catch(() => null)
    }
    return Promise.resolve(null)
  },

  /**
   * 转换前准备（Comp→渲序列填 fileList）；无 sourceAdapter 时原样返回。
   * opts 可选：{ store, locale, onProgress } — 渲染进度经 store.editProcess 回写；
   * onProgress({ text, schedule }) 优先，便于 processor 直接绑 editProcess。
   */
  prepareItem (item, opts) {
    const impl = _sourceAdapter
    if (impl && typeof impl.prepareSequence === 'function') {
      return impl.prepareSequence(item, opts)
    }
    return Promise.resolve(item)
  },

  /** 外链：CEP 用 cep.util.openURLInDefaultBrowser（非 window.open / location.href）；Electron 走白名单 IPC */
  openExternal (url) {
    if (isCep) {
      try {
        if (typeof window !== 'undefined' && window.ispartaCS && window.ispartaCS.openURLInDefaultBrowser) {
          return Promise.resolve(!!window.ispartaCS.openURLInDefaultBrowser(String(url)))
        }
      } catch (e) { /* fall through */ }
      try {
        if (typeof window !== 'undefined' && window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
          window.cep.util.openURLInDefaultBrowser(String(url))
          return Promise.resolve(true)
        }
      } catch (e2) { /* fall through */ }
      // CEP 禁止 location.href 兜底（会导航走面板）
      return Promise.resolve(false)
    }
    const ip = ipc()
    if (ip) {
      return ip.invoke('shell:openExternal', String(url)).then(function (r) {
        return !!(r && r.opened)
      }).catch(function () { return false })
    }
    if (typeof location !== 'undefined') {
      location.href = String(url)
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  }
}

export function getHostAdapter () {
  return hostAdapter
}

/** W7 合成输入源注册（src/cep/comp-source.js 注入，避免与 host-env 循环依赖） */
let _sourceAdapter = null
export function registerSourceAdapter (impl) {
  _sourceAdapter = impl || null
}
export function getSourceAdapter () {
  return _sourceAdapter
}

export default hostAdapter
