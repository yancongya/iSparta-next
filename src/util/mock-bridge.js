/**
 * 浏览器调试 mock 桥（dev only）
 *
 * 用途：`vue-cli-service serve` 纯浏览器运行渲染层，用于 UI/动效快速迭代，
 *       无需启动 Electron。真实桥见 src/preload.js —— 改 preload 时同步维护此处语义。
 *
 * 启用条件：开发构建 && window.ispartaAPI 缺失（Electron 下 preload 已注入，本模块自动空转）。
 * 注入时机：必须是 main.js 的第一个 import —— store/index.js 在模块顶层即调用
 *           getProcessBridge()/storage，晚于它注入就会在 bundle 求值阶段崩溃。
 *
 * 语义保真要点（防“浏览器好的、Electron 坏的”假阳性）：
 * - storage 与 preload 完全同构：绑定 storagePath 的 JSON 文件读写，getItem 只返回 string|null
 * - statSize 失败返回 {ok:false}（node-env 包装层会转成 -1，不能返回 0 冒充“空文件”）
 * - readFileSync 对未知路径返回 ''（让 store 走“首次初始化”分支，而非抛错）
 * - 无 removeItem 语义：清除键即写哨兵值（与真实 storage 行为一致）
 *
 * 文件系统为内存模拟，经 localStorage（key: isparta-mock-fs）持久化，
 * 刷新页面种子与改动都保留；window.__ispartaMockReset() 可清空重来。
 */

/* eslint-env browser */

const FS_LS_KEY = 'isparta-mock-fs'

/* ---------- 内存文件系统 ---------- */

function fsLoad () {
  try {
    return JSON.parse(window.localStorage.getItem(FS_LS_KEY)) || {}
  } catch (e) {
    return {}
  }
}

function fsSave (files) {
  try {
    window.localStorage.setItem(FS_LS_KEY, JSON.stringify(files))
  } catch (e) { /* 配额满时静默降级为会话内存储 */ }
}

function createMockFs () {
  const files = fsLoad()

  return {
    existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
    ensureFileSync: (p) => { if (!files[p]) { files[p] = '' } fsSave(files) },
    ensureDirSync: (p) => { if (!files[p]) { files[p] = '' } fsSave(files) },
    // 未知路径返回空串而非抛错：store/index.js 启动时读取 storage 文件依赖此行为
    readFileSync: (p) => (Object.prototype.hasOwnProperty.call(files, p) ? files[p] : ''),
    writeFileSync: (p, data) => {
      files[p] = typeof data === 'string' ? data : String(data)
      fsSave(files)
    },
    readdirSync: () => [],
    lstatSync: (p) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) {
        throw new Error('mock lstat: no such file ' + p)
      }
      return { isDirectory: () => false, isFile: () => true }
    },
    copy: () => Promise.resolve(),
    copySync: () => {},
    writeFile: (p, data) => {
      files[p] = typeof data === 'string' ? data : String(data)
      fsSave(files)
      return Promise.resolve()
    },
    remove: (p) => { delete files[p]; fsSave(files); return Promise.resolve() },
    // 失败语义必须保真：调用方（sizeGate）以 -1 区分“文件不存在”与“0 字节”
    statSize: (p) => (Object.prototype.hasOwnProperty.call(files, p)
      ? { ok: true, size: 1024 }
      : { ok: false }),
    // 1px 透明 PNG 占位，保证缩略图链路形状一致
    readDataUrl: (p) => (Object.prototype.hasOwnProperty.call(files, p)
      ? { ok: true, dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' }
      : { ok: false })
  }
}

/* ---------- path / os / process ---------- */

function createMockPath () {
  return {
    join: (...args) => args.filter(Boolean).join('/').replace(/\/{2,}/g, '/'),
    dirname: (p) => {
      const s = String(p).replace(/\/+$/, '')
      const i = s.lastIndexOf('/')
      return i < 0 ? '.' : s.slice(0, i) || '/'
    },
    basename: (p, ext) => {
      let s = String(p).replace(/\/+$/, '')
      const i = s.lastIndexOf('/')
      s = i < 0 ? s : s.slice(i + 1)
      if (ext && s.endsWith(ext)) { s = s.slice(0, -ext.length) }
      return s
    },
    sep: '/'
  }
}

/* ---------- storage：与 preload 同构的 JSON 文件存储 ---------- */

function createMockStorage (fs) {
  const ref = { p: '' }
  return {
    setStoragePath: (p) => {
      fs.ensureFileSync(p)
      ref.p = p
    },
    getItem: (key) => {
      if (!ref.p) { return null }
      try {
        const obj = JSON.parse(fs.readFileSync(ref.p) || '{}')
        if (obj && Object.prototype.hasOwnProperty.call(obj, key)) {
          const v = obj[key]
          return typeof v === 'string' ? v : JSON.stringify(v)
        }
        return null
      } catch (e) {
        return null
      }
    },
    setItem: (key, value) => {
      if (!ref.p) { return }
      let obj = {}
      try {
        obj = JSON.parse(fs.readFileSync(ref.p) || '{}') || {}
      } catch (e) {
        obj = {}
      }
      obj[key] = typeof value === 'string' ? value : JSON.stringify(value)
      fs.writeFileSync(ref.p, JSON.stringify(obj))
    }
  }
}

/* ---------- ipc / childProcess ---------- */

function createMockIpc () {
  const listeners = {}

  function emit (channel, payload) {
    const list = listeners[channel] || []
    list.forEach(function (fn) {
      try { fn(payload) } catch (e) { /* listener error isolated */ }
    })
  }

  // 供 __updateSimulate 推送 autoState 到 updateService.bindAutoIpcListener
  window.__updateEmitAutoState = function (snap) {
    emit('updater:autoState', snap)
  }

  return {
    invoke: (channel, payload) => {
      // 对话框类返回“用户取消”，与 Electron 真实取消路径一致，UI 已有处理分支
      if (channel === 'dialog:openFiles' || channel === 'dialog:openDirectory') {
        return Promise.resolve({ canceled: true, filePaths: [] })
      }
      // 更新检查：浏览器调试时用 window.__updateStub 注入任意 Result
      if (channel === 'updater:meta') {
        return Promise.resolve({
          version: '3.3.8',
          platform: 'win32',
          arch: 'x64',
          forcedVersion: ''
        })
      }
      if (channel === 'updater:check') {
        const stub = (typeof window !== 'undefined' && window.__updateStub) || {
          state: 'latest',
          current: '3.3.8',
          latest: '3.3.8',
          notes: null,
          artifactName: 'isparta-next-win-x64.exe',
          downloadUrl: 'https://github.com/yancongya/iSparta-next/releases/latest/download/isparta-next-win-x64.exe',
          fallbackUrl: 'https://github.com/yancongya/iSparta-next/releases',
          needsGatekeeperHint: false,
          checkedAt: Date.now(),
          throttled: false,
          assetMissing: false
        }
        return Promise.resolve(Object.assign({
          current: '3.3.8',
          checkedAt: Date.now(),
          throttled: false,
          assetMissing: false
        }, stub, {
          force: !!(payload && payload.force)
        }))
      }
      if (channel === 'updater:autoState' || channel === 'updater:autoDownload' || channel === 'updater:quitAndInstall') {
        const autoStub = (typeof window !== 'undefined' && window.__updateAutoStub) || {
          supported: false,
          checking: false,
          downloading: false,
          downloaded: false,
          progress: 0,
          error: null,
          version: null,
          reason: 'dev'
        }
        if (channel === 'updater:autoState') { return Promise.resolve(autoStub) }
        if (channel === 'updater:autoDownload') {
          // 浏览器模拟：若已注入 supported 的 auto stub，则启动进度模拟
          if (autoStub.supported && window.__updateSimulate) {
            window.__updateSimulate('download')
          }
          return Promise.resolve({ ok: true, state: window.__updateAutoStub || autoStub })
        }
        return Promise.resolve({ ok: !!(window.__updateAutoStub && window.__updateAutoStub.downloaded) })
      }
      if (channel === 'shell:openExternal') {
        // eslint-disable-next-line no-console
        console.info('[mock-ipc] shell:openExternal', payload)
        return Promise.resolve({ opened: true })
      }
      // eslint-disable-next-line no-console
      console.warn('[mock-ipc] unhandled invoke:', channel)
      return Promise.resolve(null)
    },
    send: (channel) => {
      // eslint-disable-next-line no-console
      console.debug('[mock-ipc] send (no-op):', channel)
    },
    on: (channel, fn) => {
      if (!channel || typeof fn !== 'function') { return }
      if (!listeners[channel]) { listeners[channel] = [] }
      listeners[channel].push(fn)
    }
  }
}

function createMockChildProcess () {
  return {
    execFile: () => Promise.reject(new Error('mock 桥：浏览器调试模式不支持执行转换'))
  }
}

/* ---------- 假数据种子 ----------
 * 仅首次（storage 无 iSparta-item）写入；多类型混排便于列表/设置面板调试。
 * 注意：store 恢复时会校验 fileList 是否存在并重置 process，因此每个路径
 * 都必须注册进 mock fs，且种子恢复后均为“待处理”态。
 */

function seedItems (fs, path, storage) {
  const storagePath = path.join('/isparta-mock-tmp', 'iSparta/localstorage-dev.json')
  storage.setStoragePath(storagePath)
  if (storage.getItem('iSparta-item')) { return }

  const mk = (type, fileList, outputName, isSelected) => {
    fileList.forEach((p) => fs.writeFileSync(p, 'mock'))
    // 与新版预设 1 保持一致：直接输出到源目录，不再建 output 子目录
    const outputPath = path.join(path.dirname(fileList[0]), outputName + '.png')
    // 输出文件也写入 mock fs：done 条目的前后对比弹窗才有「输出侧」图可读
    fs.writeFileSync(outputPath, 'mock')
    return {
      basic: {
        type,
        inputPath: path.dirname(fileList[0]) + '/' + path.basename(fileList[0]).split('.')[0],
        fileList,
        outputPath
      },
      options: {
        frameRate: 25,
        loop: 0,
        outputSuffix: '',
        outputName,
        outputFormat: ['APNG'],
        floyd: { checked: true, value: 0.35 },
        quality: { checked: false, value: 80 },
        sizeLimit: { enabled: false, maxMB: 1, maxBytes: 1048576, unit: 'MB', autoDelete: false, autoQuality: true, step: 5, maxTries: 10 },
        outputTo: { mode: 'output', customPath: '', template: '' }
      },
      process: { text: '', schedule: 0 },
      isSelected
    }
  }

  const items = [
    mk('APNG', ['/mock-assets/banner.apng'], 'banner', true),
    mk('APNG', ['/mock-assets/loading.apng'], 'loading', false),
    mk('PNGs', ['/mock-assets/frames/walk_001.png', '/mock-assets/frames/walk_002.png', '/mock-assets/frames/walk_003.png'], 'walk', false),
    mk('GIF', ['/mock-assets/emotion.gif'], 'emotion', false),
    mk('WEBP', ['/mock-assets/photo.webp'], 'photo', false)
  ]
  storage.setItem('iSparta-item', JSON.stringify(items))
}

/* ---------- 安装 ---------- */

function installMockBridge () {
  const fs = createMockFs()
  const path = createMockPath()
  const storage = createMockStorage(fs)

  window.ispartaAPI = {
    fs,
    path,
    os: {
      tmpdir: () => '/isparta-mock-tmp',
      cpus: () => [{}, {}, {}, {}]
    },
    storage,
    ipc: createMockIpc(),
    process: {
      cwd: () => '/',
      env: { NODE_ENV: 'development' }
    },
    childProcess: createMockChildProcess()
  }

  seedItems(fs, path, storage)

  // 调试工具：控制台执行可清空 mock 数据（含 localStorage）后刷新重来
  window.__ispartaMockReset = () => {
    window.localStorage.removeItem(FS_LS_KEY)
    // eslint-disable-next-line no-console
    console.info('[mock] 已清空，刷新页面将重新播种')
  }

  // 浏览器调试：注入更新状态，用于预览右下角 Dock / 进度 UI
  //   window.__updateStub     — Result（state/latest/notes…）
  //   window.__updateAutoStub — electron-updater 状态快照
  //   window.__updateSimulate('available'|'download'|'done'|'error'|'clear')
  window.__updateSimulate = function (mode) {
    // 预览前清掉节流/已通知，保证 dock 会弹
    try {
      storage.setItem('updateCheck', JSON.stringify({
        enabled: true,
        autoDownload: true,
        autoInstallOnAppQuit: false,
        lastAt: 0,
        skipVersion: '',
        lastNotifiedVersion: '',
        lastResult: null
      }))
    } catch (e) { /* ignore */ }
    const base = {
      state: 'available',
      current: '3.3.8',
      latest: '3.3.9',
      notes: '### 功能\n- 新增应用内更新 Dock\n- 下载进度可视化\n### 修复\n- 修复列表偶发排序错位',
      artifactName: 'isparta-next-win-x64.exe',
      downloadUrl: 'https://github.com/yancongya/iSparta-next/releases/latest/download/isparta-next-win-x64.exe',
      fallbackUrl: 'https://github.com/yancongya/iSparta-next/releases',
      needsGatekeeperHint: false,
      checkedAt: Date.now(),
      throttled: false,
      assetMissing: false
    }
    if (mode === 'clear') {
      window.__updateStub = Object.assign({}, base, { state: 'latest', latest: '3.3.8' })
      window.__updateAutoStub = {
        supported: false,
        checking: false,
        downloading: false,
        downloaded: false,
        progress: 0,
        error: null,
        version: null,
        reason: 'dev'
      }
      return
    }
    if (mode === 'error') {
      window.__updateStub = Object.assign({}, base)
      window.__updateAutoStub = {
        supported: true,
        checking: false,
        downloading: false,
        downloaded: false,
        progress: 12,
        error: 'network',
        version: '3.3.9',
        reason: 'ok'
      }
      return
    }
    if (mode === 'done') {
      window.__updateStub = Object.assign({}, base)
      window.__updateAutoStub = {
        supported: true,
        checking: false,
        downloading: false,
        downloaded: true,
        progress: 100,
        error: null,
        version: '3.3.9',
        reason: 'ok'
      }
      return
    }
    if (mode === 'download') {
      window.__updateStub = Object.assign({}, base)
      window.__updateAutoStub = {
        supported: true,
        checking: false,
        downloading: true,
        downloaded: false,
        progress: 36,
        error: null,
        version: '3.3.9',
        reason: 'ok'
      }
      // 模拟进度推进
      if (window.__updateProgressTimer) { clearInterval(window.__updateProgressTimer) }
      window.__updateProgressTimer = setInterval(function () {
        const s = window.__updateAutoStub
        if (!s || !s.downloading) {
          clearInterval(window.__updateProgressTimer)
          window.__updateProgressTimer = null
          return
        }
        s.progress = Math.min(100, (s.progress || 0) + 7)
        if (s.progress >= 100) {
          s.downloading = false
          s.downloaded = true
          clearInterval(window.__updateProgressTimer)
          window.__updateProgressTimer = null
        }
        if (typeof window.__updateEmitAutoState === 'function') {
          window.__updateEmitAutoState(s)
        }
      }, 400)
      return
    }
    // available
    window.__updateStub = Object.assign({}, base)
    window.__updateAutoStub = {
      supported: false,
      checking: false,
      downloading: false,
      downloaded: false,
      progress: 0,
      error: null,
      version: null,
      reason: 'dev'
    }
  }

  // eslint-disable-next-line no-console
  console.info('[mock-bridge] 浏览器调试桥已启用（Electron 下自动失效）')
  console.info('[mock-bridge] 更新 UI 预览：先 window.__updateSimulate("available")，再在应用内触发检查，或调用 updateService')
}

// 生产构建或 Electron（preload 已注入）时不做任何事
if (process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' && !window.ispartaAPI) {
  installMockBridge()
}
