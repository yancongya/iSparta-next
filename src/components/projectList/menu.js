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
