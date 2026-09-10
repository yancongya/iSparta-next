// 统一取 Node/Electron 能力：优先 window.ispartaAPI（preload）
/* global window */
function api () {
  if (typeof window !== 'undefined' && window.ispartaAPI) {
    return window.ispartaAPI
  }
  return null
}

export function getIpc () {
  const a = api()
  if (a) { return a.ipc }
  const { ipcRenderer } = require('electron')
  return {
    invoke: (c, ...args) => ipcRenderer.invoke(c, ...args),
    send: (c, ...args) => ipcRenderer.send(c, ...args),
    on: (c, cb) => ipcRenderer.on(c, (e, ...args) => cb(...args))
  }
}

export function getFs () {
  const a = api()
  if (a) { return a.fs }
  return require('fs-extra')
}

export function getPath () {
  const a = api()
  if (a) { return a.path }
  return require('path')
}

export function getOs () {
  const a = api()
  if (a) { return a.os }
  return require('os')
}

export function getStorage () {
  const a = api()
  if (a) { return a.storage }
  return require('electron-localstorage')
}

export function getProcessBridge () {
  const a = api()
  if (a && a.process) { return a.process }
  return {
    cwd: () => process.cwd(),
    env: { NODE_ENV: process.env.NODE_ENV }
  }
}

export function getChildProcess () {
  const a = api()
  if (a && a.childProcess) { return a.childProcess }
  return require('child_process')
}

export const ipc = {
  invoke: (...args) => getIpc().invoke(...args),
  send: (...args) => getIpc().send(...args),
  on: (...args) => getIpc().on(...args)
}
export const fs = {
  existsSync: (...a) => getFs().existsSync(...a),
  ensureFileSync: (...a) => getFs().ensureFileSync(...a),
  ensureDirSync: (...a) => getFs().ensureDirSync(...a),
  readFileSync: (...a) => getFs().readFileSync(...a),
  writeFileSync: (...a) => getFs().writeFileSync(...a),
  readdirSync: (...a) => getFs().readdirSync(...a),
  lstatSync: (...a) => getFs().lstatSync(...a),
  copy: (...a) => getFs().copy(...a),
  copySync: (...a) => getFs().copySync(...a),
  writeFile: (...a) => getFs().writeFile(...a),
  remove: (...a) => getFs().remove(...a)
}
export const path = {
  join: (...a) => getPath().join(...a),
  dirname: (...a) => getPath().dirname(...a),
  basename: (...a) => getPath().basename(...a),
  get sep () { return getPath().sep }
}
export const os = {
  tmpdir: (...a) => getOs().tmpdir(...a),
  cpus: (...a) => getOs().cpus(...a)
}
export const storage = {
  setStoragePath: (...a) => getStorage().setStoragePath(...a),
  getItem: (...a) => getStorage().getItem(...a),
  setItem: (...a) => getStorage().setItem(...a)
}
