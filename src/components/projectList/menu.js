// 右键菜单：主进程 popup，渲染进程执行动作（Phase1 去 remote）
import { ipc } from '../../util/node-env'

let storeRef = null
let bound = false

function bindMenuClicked () {
  if (bound) { return }
  bound = true
  ipc.on('menu:clicked', (msg) => {
    if (!msg || msg.menuId !== 'project-item') { return }
    const payload = msg.payload || {}
    switch (msg.action) {
      case 'openOriginal': {
        // AE 合成项：定位合成；文件项：显示源目录
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
        // 兼容 Windows 反斜杠与 POSIX
        const srcPath = String(payload.inputPath || '').replace(/[\\/][^\\/]*$/, '')
        ipc.invoke('shell:showItemInFolder', srcPath)
        break
      }
      case 'openDist':
        ipc.invoke('shell:showItemInFolder', payload.outputPath)
        break
      case 'changeDist':
        ipc.send('change-item-fold', payload.outputPath, payload.index)
        break
      case 'stopItem':
        if (storeRef) { storeRef.dispatch('stopSelectedTasks') }
        break
      case 'delItem':
        if (storeRef) { storeRef.dispatch('removeSelectedForce') }
        break
      default:
        break
    }
  })
}

class rightMenu {
  static init (store, payload, index, isMultiItems, locale) {
    storeRef = store
    bindMenuClicked()
    const p = payload || {}
    ipc.send('menu:popup', {
      menuId: 'project-item',
      payload: {
        isMultiItems: !!isMultiItems,
        isRunning: !!p.isRunning,
        inputPath: p.inputPath,
        outputPath: p.outputPath,
        type: p.type,
        compIndex: p.compIndex,
        compName: p.compName,
        index: index,
        locale: {
          openOriginal: locale && locale.openOriginal,
          openDist: locale && locale.openDist,
          changeDist: locale && locale.changeDist,
          delItem: locale && locale.delItem,
          stopItem: locale && locale.stopItem
        }
      }
    })
  }
}

export default rightMenu
