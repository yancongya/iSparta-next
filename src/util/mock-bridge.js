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
  return {
    invoke: (channel) => {
      // 对话框类返回“用户取消”，与 Electron 真实取消路径一致，UI 已有处理分支
      if (channel === 'dialog:openFiles' || channel === 'dialog:openDirectory') {
        return Promise.resolve({ canceled: true, filePaths: [] })
      }
      // eslint-disable-next-line no-console
      console.warn('[mock-ipc] unhandled invoke:', channel)
      return Promise.resolve(null)
    },
    send: (channel) => {
      // eslint-disable-next-line no-console
      console.debug('[mock-ipc] send (no-op):', channel)
    },
    on: () => {}
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
    return {
      basic: {
        type,
        inputPath: path.dirname(fileList[0]) + '/' + path.basename(fileList[0]).split('.')[0],
        fileList,
        outputPath: path.join(path.dirname(fileList[0]), 'output', outputName + '.png')
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

  // eslint-disable-next-line no-console
  console.info('[mock-bridge] 浏览器调试桥已启用（Electron 下自动失效）')
}

// 生产构建或 Electron（preload 已注入）时不做任何事
if (process.env.NODE_ENV === 'development' &&
    typeof window !== 'undefined' && !window.ispartaAPI) {
  installMockBridge()
}
