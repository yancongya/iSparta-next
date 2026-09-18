const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('l3api', {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload)
})
