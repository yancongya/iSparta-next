/**
 * 本地调试日志开关控制器（桌面 / CEP 共用一份源码）。
 *
 * 参考 AE-Image-Toolkit 的 local-debug-log.ts：open(core) 由宿主注入，返回一个
 * { start(onError) -> Promise<url>, stop() } 的服务对象（即 debugLogCore.createDebugLogServer
 * 的产物，或桌面 IPC 的等价代理）。控制器与具体 UI / 文件系统无关，可 L1 单测。
 *
 * 关键契约（勿破坏）：
 * - 只在真正 listening 后才报告 ready；被关闭或被新操作取代的旧启动一律作废。
 * - disable 用操作代次 generation 防「迟到的成功」覆盖关闭态。
 * - 剪贴板失败不改变开关结果，由 UI 层单独处理。
 * - 开启失败时状态为 error（可带 EADDRINUSE 等 code），由 UI 映射到具体文案。
 */

export function createDebugLogController (core, open) {
  let state = { enabled: false, status: 'off' }
  let server = null
  let generation = 0
  const listeners = []

  const update = function (next) {
    state = next
    listeners.slice().forEach(function (fn) { try { fn(state) } catch (e) { /* listener must not break controller */ } })
  }
  const stopServer = function () {
    generation++
    if (server) { try { server.stop() } catch (e) { /* ignore */ } }
    server = null
  }

  return {
    getSnapshot: function () { return state },
    subscribe: function (listener) {
      listeners.push(listener)
      return function () {
        const i = listeners.indexOf(listener)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
    enable: function () {
      if (state.enabled) return Promise.resolve(state)
      const current = ++generation
      const fail = function (error) {
        if (generation !== current) return
        stopServer()
        const code = error && typeof error === 'object' && error.code ? String(error.code) : ''
        update({ enabled: false, status: 'error', errorCode: /^[A-Z_]{2,40}$/.test(code) ? code : undefined })
      }
      let candidate = null
      try {
        candidate = typeof open === 'function' ? open(core) : null
      } catch (e) {
        fail(e)
        return Promise.resolve(state)
      }
      if (!candidate) { update({ enabled: false, status: 'unavailable' }); return Promise.resolve(state) }
      server = candidate
      update({ enabled: true, status: 'starting' })
      return Promise.resolve(candidate.start(fail)).then(function (url) {
        if (generation !== current) { try { candidate.stop() } catch (e) { /* ignore */ } return null }
        update({ enabled: true, status: 'ready', url: url })
        return state
      }).catch(function (error) {
        if (generation !== current) return null
        fail(error)
        return state
      })
    },
    disable: function () {
      stopServer()
      update({ enabled: false, status: 'off' })
      return state
    },
    dispose: function () {
      stopServer()
      update({ enabled: false, status: 'off' })
      listeners.length = 0
    }
  }
}
