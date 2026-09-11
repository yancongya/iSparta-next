// 统一取 Node/Electron 能力：优先 window.ispartaAPI（preload）
/* global window */
function api () {
  if (typeof window !== 'undefined' && window.ispartaAPI) {
    return window.ispartaAPI
  }
  return null
}

export function getFs () {
  const a = api()
  if (a) { return a.fs }
  throw new Error('ispartaAPI.fs missing: preload not loaded?')
}

export function getPath () {
  const a = api()
  if (a) { return a.path }
  throw new Error('ispartaAPI.path missing: preload not loaded?')
}

export function getOs () {
  const a = api()
  if (a) { return a.os }
  throw new Error('ispartaAPI.os missing: preload not loaded?')
}

export function getStorage () {
  const a = api()
  if (a) { return a.storage }
  throw new Error('ispartaAPI.storage missing: preload not loaded?')
}

export function getIpc () {
  const a = api()
  if (a) { return a.ipc }
  throw new Error('ispartaAPI.ipc missing: preload not loaded?')
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
  remove: (...a) => getFs().remove(...a),
  statSize: (p) => {
    const r = getFs().statSize && getFs().statSize(p)
    return (r && r.ok) ? r.size : 0
  }
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

export function getProcessBridge () {
  const a = api()
  if (a && a.process) { return a.process }
  throw new Error('ispartaAPI.process missing: preload not loaded?')
}

export function getChildProcess () {
  const a = api()
  if (a && a.childProcess) { return a.childProcess }
  throw new Error('ispartaAPI.childProcess missing: preload not loaded?')
}
