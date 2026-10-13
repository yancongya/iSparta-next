/**
 * 右键菜单：Electron 走主进程 popup；CEP / 浏览器走 DOM 菜单。
 * 打开目录：Electron 用 shell.openPath 打开目标目录；CEP 由 AE Folder.execute 跨平台打开。
 */
import { ipc } from '../../util/node-env'
import notice from '../../ui-next/notice'

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
    // contextIsolation 下渲染进程无 window.process，不能靠 versions.electron
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
    if (ua.indexOf('Electron') > -1) { return true }
    return !!(window.ispartaAPI && window.ispartaAPI.ipc && !window.ispartaCS)
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

function reportOpenFailure (error, title) {
  var detail = error && error.message ? error.message : String(error || '')
  console.error('打开目录失败：' + detail)
  notice.error(title || '打开目录失败', detail)
}

/** Open a real directory; CEP never falls through to an elevated child explorer. */
function openOsDir (dir, title) {
  var target = String(dir || '')
  if (!target) { return }
  if (isElectronHost()) {
    try {
      ipc.invoke('shell:openPath', target).then(function (error) {
        if (error) { reportOpenFailure(error, title) }
      }).catch(function (e) { reportOpenFailure(e, title) })
    } catch (e) { reportOpenFailure(e, title) }
    return
  }
  if (isCepLike()) {
    var script = 'new Folder(' + JSON.stringify(target) + ').execute()'
    try {
      if (window.ispartaCS && typeof window.ispartaCS.evalScript === 'function') {
        var result = window.ispartaCS.evalScript(script)
        if (result && typeof result.then === 'function') {
          result.then(function (value) {
            if (String(value).toLowerCase() !== 'true') reportOpenFailure('AE 未能打开：' + target, title)
          }).catch(function (e) { reportOpenFailure(e, title) })
        } else if (result !== 'true' && result !== true) {
          reportOpenFailure('AE 未能打开：' + target, title)
        }
        return
      }
      // 兼容未加载项目 CS 封装的 CEP 面板，直接使用 CEP 原生宿主回调。
      var cepHost = window.__adobe_cep__ || (window.cep && window.cep)
      if (cepHost && typeof cepHost.evalScript === 'function') {
        cepHost.evalScript(script, function (value) {
          if (String(value).toLowerCase() !== 'true') reportOpenFailure('AE 未能打开：' + target, title)
        })
        return
      }
      reportOpenFailure('CEP 没有可用的 AE 脚本接口', title)
    } catch (e) { reportOpenFailure(e, title); return }
    return
  }
  try {
    var cp = require('../../util/node-env').getChildProcess()
    var os = require('../../util/node-env').os
    var pf = ''
    try { pf = (os && os.platform && os.platform()) || '' } catch (eOs) { /* fallback */ }
    if (!pf && typeof navigator !== 'undefined') pf = String(navigator.platform || navigator.userAgent || '').toLowerCase()
    var command = /win/i.test(pf) ? 'explorer.exe' : (/mac|darwin/i.test(pf) ? 'open' : 'xdg-open')
    cp.execFile(command, [target], function (error) { if (error) reportOpenFailure(error, title) })
  } catch (e) { reportOpenFailure(e, title) }
}

function dirnameOf (p) {
  var s = String(p || '')
  if (!s) { return '' }
  var i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
  return i > 0 ? s.slice(0, i) : ''
}

/** Legacy comp without outputPath: show its real project directory, never invent a comp-named folder. */
function resolveOutDir (payload) {
  if (!payload) { return '' }
  if (payload.outputPath) { return String(payload.outputPath) }
  var srcDir = dirnameOf(payload.projectPath) || dirnameOf(payload.inputPath)
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
  // 输出目录由调用方按当前任务设置 / 默认模板解析后传入，避免误开工程目录。
  if (payload && (payload.outputPath || isComp)) {
    items.push({ id: 'openDist', label: locale.openDist || '打开输出目录' })
  }
  if (payload && payload.isRunning) {
    items.push({ id: 'stopItem', label: locale.stopItem || '终止任务' })
  }
  // 删除：与桌面原生菜单同项（background.js 的 project-item 模板最后一项）。
  // 「更改保存位置」不列在这里 —— 它要走原生目录选择弹窗，DOM 菜单做不到。
  if (payload && payload.canDelete) {
    items.push({ id: 'delItem', label: locale.delItem || '删除' })
  }

  const el = document.createElement('div')
  el.className = 'is-ctx-menu'
  // 配色走设计令牌：原先硬编码深色，浅色主题的 CEP 面板里是一块黑砖
  el.style.cssText = 'position:fixed;z-index:var(--is-z-dropdown,99999);min-width:160px;padding:4px 0;' +
    'background:var(--is-card,#2a2a2a);border:1px solid var(--is-border,#444);' +
    'border-radius:var(--is-r-md,6px);box-shadow:var(--is-shadow-lg,0 8px 24px rgba(0,0,0,.35));' +
    'font:var(--is-fs-sm,12px)/1.6 var(--is-font,sans-serif);color:var(--is-text,#eee);'
  items.forEach(function (it) {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = it.label
    // 终止任务用警示色，和「打开目录」这类无害项区分开
    const ink = it.id === 'stopItem' ? 'var(--is-warn,#c2410c)' : 'inherit'
    b.style.cssText = 'display:block;width:100%;text-align:left;padding:6px 14px;border:0;' +
      'background:transparent;color:' + ink + ';cursor:pointer;font:inherit;'
    b.onmouseenter = function () { b.style.background = 'var(--is-hover,rgba(232,240,230,.08))' }
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
        if (dir) { openOsDir(dir, payload.locale && payload.locale.noticeOpenFailed) }
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
        if (srcPath) { openOsDir(srcPath, payload.locale && payload.locale.noticeOpenFailed) }
        break
      }
      case 'openDist': {
        var outDir = resolveOutDir(payload)
        if (outDir) { openOsDir(outDir, payload.locale && payload.locale.noticeOpenFailed) }
        break
      }
      case 'changeDist':
        // 桌面原生菜单仍在用；CEP DOM 菜单不展示此项
        ipc.send('change-item-fold', payload.outputPath, payload.index)
        break
      case 'delItem':
        try {
          // 右键不改选中（见 itemRightClick 的注释），所以这里必须先按
          // storeIndex 定位到被右击的那一条，再删 —— 直接沿用当前选中会
          // 删掉别人。
          //
          // 动作名是 removeSelectedForce 而非 deleteSelected —— 后者在
          // store 里根本不存在，dispatch 静默失败，表现就是「点了没反应」。
          // 与 Delete 键 / 底栏「删除所选」同一条路径（Home.vue 用的也是它），
          // 运行中的任务会先杀进程再移除。
          const items = storeRef && storeRef.getters && storeRef.getters.getterItems
          const si = (payload && payload.storeIndex != null) ? payload.storeIndex : (payload && payload.index)
          if (storeRef && storeRef.dispatch && items && si != null && items[si]) {
            if (!items[si].isSelected) storeRef.dispatch('singleSelect', si)
            storeRef.dispatch('removeSelectedForce')
          }
        } catch (eDel) { /* ignore */ }
        break
      case 'stopItem': {
        try {
          // 桌面：多选时对已选中项批量终止（保持原语义）
          // CEP：右键不改选中，该项未选中时先定位再停
          const items = storeRef && storeRef.getters && storeRef.getters.getterItems
          // 渲染下标可能因排序/过滤 ≠ store 下标，优先用 storeIndex
          const si = (payload && payload.storeIndex != null) ? payload.storeIndex : (payload && payload.index)
          const it = items && si != null && items[si]
          if (it && !it.isSelected && storeRef.dispatch) {
            storeRef.dispatch('singleSelect', si)
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
      // 删除项是否可用：多选时菜单整组动作语义不同（桌面原生菜单也是这个约定），
      // 由调用方按当前选择态决定
      canDelete: p.canDelete != null ? p.canDelete : !isMultiItems,
      index: (p.index != null ? p.index : index),
      // 列表可能被排序/过滤，渲染下标 ≠ store 数组下标；变更类动作必须用 store 下标
      storeIndex: (p.storeIndex != null ? p.storeIndex : null),
      locale: {
        openCompLoc: locale && locale.openCompLoc,
        openOriginal: locale && locale.openOriginal,
        openDist: locale && locale.openDist,
        noticeOpenFailed: locale && locale.noticeOpenFailed,
        changeDist: locale && locale.changeDist,
        delItem: locale && locale.delItem,
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
    // x/y 必须传：原生 menu.popup 不传坐标时落点由系统决定，
    // 在多显示器 / 负坐标屏上会弹到屏幕外，表现就是「右键没反应」。
    // CEP 分支的 DOM 菜单用的是 window.__ispartaCtxX/Y，与此处同源。
    ipc.send('menu:popup', {
      menuId: 'project-item',
      x: (typeof window !== 'undefined' && window.__ispartaCtxX) || 0,
      y: (typeof window !== 'undefined' && window.__ispartaCtxY) || 0,
      payload: menuPayload
    })
  }
}

export default rightMenu
