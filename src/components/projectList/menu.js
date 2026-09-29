/**
 * 右键菜单：Electron 走主进程 popup；CEP / 浏览器走 DOM 菜单。
 * 打开目录：Windows execFile('explorer.exe')，mac execFile('open')。
 */
import { ipc } from '../../util/node-env'

let storeRef = null
let bound = false
let domMenuEl = null

function isCepLike () {
  if (typeof window === 'undefined') { return false }
  return !!(window.__adobe_cep__ || window.cep || window.ispartaCS || window.ispartaCepBridge)
}

function isElectronHost () {
  if (isCepLike()) { return false }
  try {
    return !!(window.ispartaAPI && window.ispartaAPI.ipc &&
      window.process && window.process.versions && window.process.versions.electron)
  } catch (e) { return false }
}

function closeDomMenu () {
  if (domMenuEl && domMenuEl.parentNode) {
    domMenuEl.parentNode.removeChild(domMenuEl)
  }
  domMenuEl = null
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', closeDomMenu, true)
    document.removeEventListener('keydown', onMenuKey, true)
  }
}

function onMenuKey (ev) {
  if (ev && ev.key === 'Escape') { closeDomMenu() }
}

/** Windows: explorer.exe；mac/linux: open / xdg-open。参数数组，禁止拼 shell 串 */
function openOsDir (dir) {
  if (!dir) { return }
  var target = String(dir)
  try {
    var cp = require('../../util/node-env').getChildProcess()
    var os = require('../../util/node-env').os
    var pf = ''
    try {
      pf = (os && os.platform && os.platform()) || ''
    } catch (eOs) { /* fall through */ }
    if (!pf && typeof navigator !== 'undefined') {
      pf = String(navigator.platform || navigator.userAgent || '').toLowerCase()
    }
    if (/win/i.test(pf)) {
      cp.execFile('explorer.exe', [target], function () { /* 打开失败不打断 */ })
      return
    }
    if (/mac|darwin/i.test(pf)) {
      cp.execFile('open', [target], function () { /* ignore */ })
      return
    }
    cp.execFile('xdg-open', [target], function () { /* ignore */ })
    return
  } catch (e) { /* fall through */ }
  try {
    ipc.invoke('shell:showItemInFolder', target)
  } catch (e2) { /* ignore */ }
}

function dirnameOf (p) {
  var s = String(p || '')
  if (!s) { return '' }
  var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  return i > 0 ? s.slice(0, i) : ''
}

/** 合成节点没有现成 outputPath 时，按默认模板 {srcPath}/{srcName} 推导 */
function resolveOutDir (payload) {
  if (!payload) { return '' }
  if (payload.outputPath) { return String(payload.outputPath) }
  var srcDir = dirnameOf(payload.projectPath) || dirnameOf(payload.inputPath)
  var name = payload.compName || payload.name || ''
  if (srcDir && name) {
    return srcDir.replace(/[\\/]+$/, '') + '/' + name
  }
  return srcDir
}

function fireAction (action, payload) {
  // 与 Electron menu:clicked 同一处理入口
  try {
    if (typeof window !== 'undefined' && window.__ispartaMenuClicked) {
      window.__ispartaMenuClicked({ menuId: 'project-item', action: action, payload: payload })
      return
    }
  } catch (e) { /* ignore */ }
  try {
    ipc.send && ipc.send('menu:clicked', { menuId: 'project-item', action: action, payload: payload })
  } catch (e2) { /* ignore */ }
}

function showDomMenu (payload, x, y) {
  closeDomMenu()
  if (typeof document === 'undefined') { return }
  const locale = (payload && payload.locale) || {}
  const isComp = !!(payload && (payload.type === 'Comp' || payload.compIndex != null || payload.compName))
  const items = []

  if (isComp) {
    // CEP/合成任务：打开合成位置 · 打开输出目录 · 终止任务
    items.push({ id: 'openCompLoc', label: locale.openCompLoc || '打开合成位置' })
  } else {
    items.push({ id: 'openOriginal', label: locale.openOriginal || '打开文件目录' })
  }
  // 合成树节点没有现成 outputPath，也按默认模板推导，与桌面任务列表保持两项
  if (payload && (payload.outputPath || isComp)) {
    items.push({ id: 'openDist', label: locale.openDist || '打开输出目录' })
  }
  if (payload && payload.isRunning) {
    items.push({ id: 'stopItem', label: locale.stopItem || '终止任务' })
  }

  const el = document.createElement('div')
  el.className = 'is-ctx-menu'
  el.style.cssText = 'position:fixed;z-index:99999;min-width:160px;padding:4px 0;' +
    'background:#2a2a2a;border:1px solid #444;border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.35);' +
    'font:12px/1.6 sans-serif;color:#eee;'
  items.forEach(function (it) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = it.label
    b.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 14px;border:0;' +
      'background:transparent;color:inherit;cursor:pointer;font:inherit;'
    b.onmouseenter = function () { b.style.background = '#3d5a80' }
    b.onmouseleave = function () { b.style.background = 'transparent' }
    b.onclick = function (ev) {
      ev.preventDefault()
      ev.stopPropagation()
      closeDomMenu()
      fireAction(it.id, payload)
    }
    el.appendChild(b)
  })
  document.body.appendChild(el)
  const rect = el.getBoundingClientRect()
  const left = Math.min(x, (window.innerWidth || 800) - rect.width - 8)
  const top = Math.min(y, (window.innerHeight || 600) - rect.height - 8)
  el.style.left = Math.max(4, left) + 'px'
  el.style.top = Math.max(4, top) + 'px'
  domMenuEl = el
  setTimeout(function () {
    document.addEventListener('click', closeDomMenu, true)
    document.addEventListener('keydown', onMenuKey, true)
  }, 0)
}

function bindMenuClicked () {
  if (bound) { return }
  bound = true
  const handler = function (msg) {
    if (!msg || msg.menuId !== 'project-item') { return }
    const payload = msg.payload || {}
    switch (msg.action) {
      case 'openCompLoc': {
        // 打开合成位置：工程文件所在目录
        const dir = dirnameOf(payload.projectPath) || dirnameOf(payload.inputPath)
        if (dir) { openOsDir(dir) }
        break
      }
      case 'openOriginal': {
        if (payload && (payload.type === 'Comp' || payload.compIndex != null || payload.compName)) {
          try {
            const hostEnv = require('../../util/host-env')
            const src = hostEnv.getSourceAdapter && hostEnv.getSourceAdapter()
            if (src && typeof src.openSource === 'function') {
              src.openSource({
                basic: {
                  type: 'Comp',
                  compIndex: payload.compIndex,
                  compName: payload.compName,
                  inputPath: payload.inputPath
                }
              })
              break
            }
          } catch (e) { /* fall through */ }
        }
        const srcPath = dirnameOf(payload.inputPath)
        if (srcPath) { openOsDir(srcPath) }
        break
      }
      case 'openDist': {
        var outDir = resolveOutDir(payload)
        if (outDir) { openOsDir(outDir) }
        break
      }
      case 'stopItem': {
        try {
          if (payload && typeof payload.index === 'number' && storeRef && storeRef.dispatch) {
            storeRef.dispatch('singleSelect', payload.index)
          }
          if (storeRef && storeRef.dispatch) {
            storeRef.dispatch('stopSelectedTasks')
          }
        } catch (eStop) { /* ignore */ }
        break
      }
      default:
        break
    }
  }
  if (typeof window !== 'undefined') {
    window.__ispartaMenuClicked = handler
  }
  ipc.on('menu:clicked', handler)
}

class rightMenu {
  static init (store, payload, index, isMultiItems, locale) {
    storeRef = store
    bindMenuClicked()
    const p = payload || {}
    const menuPayload = {
      isMultiItems: !!isMultiItems,
      isRunning: !!p.isRunning,
      inputPath: p.inputPath,
      outputPath: p.outputPath,
      projectPath: p.projectPath,
      type: p.type,
      compIndex: p.compIndex,
      compName: p.compName,
      index: (p.index != null ? p.index : index),
      locale: {
        openCompLoc: locale && locale.openCompLoc,
        openOriginal: locale && locale.openOriginal,
        openDist: locale && locale.openDist,
        stopItem: locale && locale.stopItem
      }
    }
    // CEP / 浏览器：DOM 菜单（menu:popup 不存在或无原生菜单）
    if (isCepLike() || !isElectronHost()) {
      const x = (typeof window !== 'undefined' && window.__ispartaCtxX) || 120
      const y = (typeof window !== 'undefined' && window.__ispartaCtxY) || 120
      showDomMenu(menuPayload, x, y)
      return
    }
    ipc.send('menu:popup', {
      menuId: 'project-item',
      payload: menuPayload
    })
  }
}

export default rightMenu
