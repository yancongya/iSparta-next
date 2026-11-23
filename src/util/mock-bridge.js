/**
 * 浏览器调试与落地页独立演示构建的 mock 桥
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
const REQUESTED_MOCK_VERSION = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('mockVersion')
const MOCK_VERSION = REQUESTED_MOCK_VERSION && /^\d+\.\d+\.\d+$/.test(REQUESTED_MOCK_VERSION)
  ? REQUESTED_MOCK_VERSION : require('../../package.json').version
const MOCK_NEXT_VERSION = MOCK_VERSION.replace(/\d+$/, (patch) => String(Number(patch) + 1))

/* ---------- 内存文件系统 ---------- */

function fsLoad () {
  if (process.env.VUE_APP_LANDING_DEMO === '1') return {}
  try {
    return JSON.parse(window.localStorage.getItem(FS_LS_KEY)) || {}
  } catch (e) {
    return {}
  }
}

function fsSave (files) {
  if (process.env.VUE_APP_LANDING_DEMO === '1') return
  try {
    window.localStorage.setItem(FS_LS_KEY, JSON.stringify(files))
  } catch (e) { /* 配额满时静默降级为会话内存储 */ }
}

function demoThumb (file) {
  const scenes = {
    banner: `
      <style>
        .sun{animation:rise 3s ease-in-out infinite alternate}.road{animation:road 1s linear infinite}
        @keyframes rise{to{transform:translateY(-13px)}} @keyframes road{to{stroke-dashoffset:-19}}
      </style>
      <defs><linearGradient id="sky" x2="0" y2="1">
        <stop stop-color="#251346"/><stop offset="1" stop-color="#d65a6c"/>
      </linearGradient></defs>
      <rect width="80" height="80" fill="url(#sky)"/>
      <circle class="sun" cx="40" cy="37" r="19" fill="#ffbb72"/>
      <path d="M0 47 13 34l17 15 16-8 10 8 13-18 11 14v35H0Z" fill="#432044"/>
      <path d="m32 49 17 0 25 31H5Z" fill="#211831"/>
      <path class="road" d="m40 50 0 32" stroke="#ffd78b" stroke-width="2.5" stroke-dasharray="9 10"/>
      <path d="m32 49-27 31m44-31 25 31" stroke="#ff749f" stroke-width="1.5"/>
    `,
    loading: `
      <style>
        .orbit{transform-origin:40px 40px;animation:spin 2.4s linear infinite}
        .reverse{animation-direction:reverse;animation-duration:3.6s}
        .beam{animation:pulse 1.2s ease-in-out infinite alternate}
        @keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{to{opacity:.3}}
      </style>
      <rect width="80" height="80" fill="#10292f"/>
      <path d="M0 20h80M0 40h80M0 60h80M20 0v80M40 0v80M60 0v80" stroke="#2f5758" opacity=".6"/>
      <circle cx="40" cy="40" r="29" fill="none" stroke="#3e7b73"/>
      <circle cx="40" cy="40" r="21" fill="none" stroke="#477c79" stroke-dasharray="2 3"/>
      <g class="orbit"><path d="M40 11a29 29 0 0 1 29 29" fill="none" stroke="#6ae8c1" stroke-width="3"/><circle cx="69" cy="40" r="4" fill="#e4ffab"/></g>
      <g class="orbit reverse"><circle cx="40" cy="61" r="3.5" fill="#6ee0fb"/></g>
      <path class="beam" d="m40 28 10 12-10 12-10-12Z" fill="#b5f0a4"/>
    `,
    walk: `
      <style>
        .floor{animation:track 1.2s linear infinite}.body{animation:step .6s ease-in-out infinite alternate}
        .leg{transform-origin:40px 48px;animation:stride .6s ease-in-out infinite alternate}
        .back{animation-direction:alternate-reverse}
        @keyframes track{to{stroke-dashoffset:17}} @keyframes step{to{transform:translateY(-4px)}}
        @keyframes stride{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
      </style>
      <rect width="80" height="80" fill="#f2bd64"/>
      <circle cx="60" cy="19" r="9" fill="#fce6a1"/>
      <path d="m0 42 18-15 19 16 24-25 19 14v48H0Z" fill="#d18053"/>
      <path d="M0 62q14-9 28-4t29 1 23-2v23H0Z" fill="#754157"/>
      <path class="floor" d="M0 71h80" stroke="#e69d6d" stroke-width="2" stroke-dasharray="9 8"/>
      <path class="leg back" d="m40 48 8 12 8 1" fill="none" stroke="#312740" stroke-width="5" stroke-linecap="round"/>
      <path class="leg" d="m40 48-5 13-7 3" fill="none" stroke="#593450" stroke-width="5" stroke-linecap="round"/>
      <g class="body"><rect x="25" y="30" width="27" height="21" rx="8" fill="#fff0bc"/>
        <path d="M27 39h-5v9h5" fill="none" stroke="#a95052" stroke-width="4"/>
        <rect x="36" y="36" width="12" height="7" rx="3" fill="#49314b"/>
        <circle cx="44" cy="39" r="1.6" fill="#ffc86d"/>
      </g>
    `,
    emotion: `
      <style>
        .face{transform-origin:40px 42px;animation:bounce 1.8s ease-in-out infinite}
        .spark{transform-origin:40px 40px;animation:spark 1.8s ease-out infinite}
        @keyframes bounce{0%,100%{transform:translateY(6px) scale(1.12,.86)}45%{transform:translateY(-9px) scale(.96,1.08)}}
        @keyframes spark{0%{opacity:.1;transform:scale(.65)}55%{opacity:1}100%{opacity:0;transform:scale(1.2)}}
      </style>
      <rect width="80" height="80" fill="#64264a"/>
      <circle cx="40" cy="40" r="28" fill="#83355f"/>
      <ellipse cx="40" cy="64" rx="19" ry="4" fill="#3d1c3d" opacity=".65"/>
      <path class="spark" d="m14 16 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm49 5 2 4 5 1-4 3v5l-4-3-5 1 2-5-2-4Z" fill="#ffd17e"/>
      <g class="face">
        <path d="M18 45c0-11 9-20 22-20s22 9 22 20-8 15-22 15-22-4-22-15Z" fill="#ff8fae"/>
        <path d="M21 43c2-11 10-16 18-16-7 4-10 9-11 15Z" fill="#ffc7ce"/>
        <path d="m30 43 3-3 3 3m8 0 3-3 3 3m-15 5q5 7 10 0" fill="none" stroke="#562846" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M25 47h4m22 0h4" stroke="#e65f8c" stroke-width="2.5" stroke-linecap="round"/>
      </g>
    `,
    photo: `
      <style>
        .water{animation:tide 2.2s ease-in-out infinite alternate}.boat{animation:sail 4s ease-in-out infinite alternate}
        .cloud{animation:cloud 4s ease-in-out infinite alternate}
        @keyframes tide{to{transform:translateX(-19px) translateY(3px)}}
        @keyframes sail{to{transform:translate(19px,-4px) rotate(-6deg)}}
        @keyframes cloud{to{transform:translateX(14px)}}
      </style>
      <rect width="80" height="80" fill="#20436a"/>
      <circle cx="55" cy="23" r="10" fill="#ffe7ab"/>
      <path class="cloud" d="M4 21h24M0 27h18" stroke="#8bbed5" stroke-width="2.5" stroke-linecap="round"/>
      <path d="m0 49 17-19 16 17L47 35l17 14 16-12v43H0Z" fill="#527a94"/>
      <path d="M0 54h80v26H0Z" fill="#245879"/>
      <path class="water" d="M-10 61q8-4 16 0t16 0 16 0 16 0 16 0 16 0 16 0m-110 12q8-4 16 0t16 0 16 0 16 0 16 0 16 0 16 0" fill="none" stroke="#73bfc9" stroke-width="2"/>
      <g class="boat"><path d="m34 36-12 18h12Z" fill="#fff0c2"/><path d="m36 40 8 14h-8Z" fill="#e8987b"/>
        <path d="M19 56h28l-6 5H24Z" fill="#f6a164"/></g>
    `
  }
  const key = Object.keys(scenes).find(name => file.includes('/' + name)) || 'banner'
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">' +
    scenes[key] + '<style>@media(prefers-reduced-motion:reduce){*{animation:none!important}}</style></svg>'
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
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
    // 源文件可登记演示字节数（__size__:<path>），让「预估质量角标」在浏览器预览里
    // 显示有意义的降质值；未登记的文件（含产物）保持 1024，不影响产物大小角标。
    statSize: (p) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) return { ok: false }
      const virtual = files['__size__:' + p]
      return { ok: true, size: virtual ? Number(virtual) : 1024 }
    },
    readDataUrl: (p) => (Object.prototype.hasOwnProperty.call(files, p)
      ? {
          ok: true,
          // 演示封面 SVG 动画：seed 任务路径统一以 /mock-assets/ 开头（真实导入文件不会命中）。
          // 之前仅 landing-demo 构建启用，普通 mockup（8081）封面是 1x1 空白；
          // 现在所有 mock 场景统一走 demoThumb，8081 与落地页 demo 封面一致、共用一份源码。
          dataUrl: String(p).startsWith('/mock-assets/')
            ? demoThumb(String(p))
            : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        }
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
          version: MOCK_VERSION,
          platform: 'win32',
          arch: 'x64',
          forcedVersion: ''
        })
      }
      if (channel === 'updater:check') {
        const stub = (typeof window !== 'undefined' && window.__updateStub) || {
          state: 'latest',
          current: MOCK_VERSION,
          latest: MOCK_VERSION,
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
          current: MOCK_VERSION,
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
      if (channel === 'job:cancelAll') {
        return Promise.resolve({ ok: true, killed: 0 })
      }
      if (channel === 'job:execFile') {
        return Promise.resolve({ ok: false, error: 'mock 桥：浏览器调试模式不支持执行转换', cancelled: false })
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
  // 全局设置种子：真实环境由 store 初始化；浏览器预览补一份，
  // 让「未加入任务的合成」也能读到默认目标大小，驱动合成树的预估角标。
  // 必须放在 iSparta-item 早退检查之前：旧缓存可能已带 item 种子但缺 globalSetting
  // （历史状态：种子结构后补字段时未升 SEED_VERSION），早退会永远跳过补写，
  // 导致全局设置弹窗 loadSetting() 恒为 null、弹窗体空白。
  if (!storage.getItem('globalSetting')) {
    storage.setItem('globalSetting', JSON.stringify({
      language: 'zh-cn',
      options: {
        outputFormat: ['APNG', 'GIF', 'WEBP'],
        // 与 store defaultState 出厂值对齐：floyd / quality / palette 齐全，
        // 避免 globalSetting.vue 模板直读 options.floyd.value 时种子缺字段崩渲染
        floyd: { checked: true, value: 0.35 },
        quality: { checked: true, value: 80 },
        palette: { mode: 'quality', colors: 256 },
        sizeLimit: {
          enabled: true, maxMB: 2, maxBytes: 2097152, unit: 'MB',
          autoDelete: true, autoQuality: true, step: 5, maxTries: 10
        },
        frameRate: 25,
        loop: 0
      }
    }))
  }
  // 种子结构变更（如演示字段）时升 SEED_VERSION，旧浏览器缓存自动重种，
  // 不必手动清 localStorage。只在 dev mock 生效，不碰真实数据。
  const isCepMockup = !!window.__ispartaMockup
  const SEED_VERSION = isCepMockup ? 'cep-5' : '4'
  if (storage.getItem('iSparta-item') && storage.getItem('iSparta-seed-v') === SEED_VERSION) { return }
  storage.setItem('iSparta-seed-v', SEED_VERSION)

  const EXT_OF_FORMAT = { APNG: '.png', GIF: '.gif', WEBP: '.webp' }
  // srcMB：演示用的「源体积」量级，写入 __size__ 虚拟键供 statSize 读取，
  // 让右上角预估角标显示有意义的降质值（否则源恒为 1KB，预估总是「无需降质」）。
  const mk = (type, fileList, outputName, isSelected, formats, srcMB, anim) => {
    fileList.forEach((p) => fs.writeFileSync(p, 'mock'))
    if (srcMB && srcMB > 0) {
      const perFile = Math.round(srcMB * 1024 * 1024 / fileList.length)
      fileList.forEach((p) => fs.writeFileSync('__size__:' + p, String(perFile)))
    }
    // 位深演示：源文件是 'mock' 占位读不出 IHDR，登记 32-bit RGBA(bitDepth=8,colorType=6)
    // 虚拟键，让角标 hover 在浏览器预览里显示「源 32-bit → 产物 8-bit 索引」。
    fileList.forEach((p) => fs.writeFileSync('__bitdepth__:' + p, '8|6'))
    // outputPath 是**目录**（与 processor 的 resolveOutputPath 语义一致）。
    // 之前误写成输出文件名，task-output 再 join 一次名字后永远读不到文件，
    // 产物大小/格式角标在纯浏览器预览里就一直为空。
    const outputDir = path.dirname(fileList[0])
    const list = (formats && formats.length) ? formats : ['APNG']
    list.forEach((format) => {
      const ext = EXT_OF_FORMAT[format]
      if (!ext) return
      // 内容做成 KB 级：产物大小 / 角标 hover 才有可读的数字（mock fs 按字符串长度算大小）
      const body = ('mock-' + format + '-' + outputName + '\n').repeat(160)
      fs.writeFileSync(path.join(outputDir, outputName + ext), body)
    })
    return {
      basic: {
        type,
        inputPath: outputDir + '/' + path.basename(fileList[0]).split('.')[0],
        fileList,
        outputPath: outputDir,
        // 单文件动图：真实导入会从文件头解析帧数/延时，mock 用anim参数模拟同一效果
        ...(anim && anim.frameCount ? { frameCount: anim.frameCount } : {})
      },
      options: {
        frameRate: 25,
        ...(anim && anim.delays ? { delays: anim.delays } : {}),
        frameRemap: { enabled: false, targetFrameRate: 12 },
        loop: 0,
        outputSuffix: '',
        outputName,
        outputFormat: list,
        floyd: { checked: true, value: 0.35 },
        quality: { checked: false, value: 80 },
        palette: { mode: 'quality', colors: 256 },
        sizeLimit: { enabled: true, maxMB: 1, maxBytes: 1048576, unit: 'MB', autoDelete: false, autoQuality: true, step: 5, maxTries: 10 },
        outputTo: { mode: 'output', customPath: '', template: '' }
      },
      process: { text: '', schedule: 0 },
      isSelected
    }
  }

  const items = isCepMockup ? [] : [
    // 首条seed 三格式齐全：用来演示完成态的三枚格式角标；srcMB 给足量级演示降质预估。
    // 量级错落开：多数达标（≈0.9MB / Q 错落），walk 故意给超大源演示「超目标」警告态。
    mk('APNG', ['/mock-assets/banner.apng'], 'banner', true, ['APNG', 'GIF', 'WEBP'], 1.5, { frameCount: 60, delays: Array(60).fill(0.05) }),
    mk('APNG', ['/mock-assets/loading.apng'], 'loading', false, undefined, 1.2, { frameCount: 50, delays: Array(50).fill(0.04) }),
    mk('PNGs', ['/mock-assets/frames/walk_001.png', '/mock-assets/frames/walk_002.png', '/mock-assets/frames/walk_003.png'], 'walk', false, undefined, 40),
    mk('GIF', ['/mock-assets/emotion.gif'], 'emotion', false, undefined, 3, { frameCount: 20, delays: Array(20).fill(0.08) }),
    mk('WEBP', ['/mock-assets/photo.webp'], 'photo', false, undefined, 2)
  ]
  // 演示色深路线：banner seed 切到 colors 256（浏览器 mockup 验收角标「C256」文案与
  // WebP 置灰提示用；品质路线的其余 seed 不动）
  if (items[0] && items[0].options) {
    items[0].options.palette = { mode: 'colors', colors: 256 }
  }
  storage.setItem('iSparta-item', JSON.stringify(items))
}

/* ---------- 安装 ---------- */

function installMockBridge () {
  const fs = createMockFs()
  const path = createMockPath()
  const storage = createMockStorage(fs)

  window.ispartaAPI = {
    fs: fs,
    path: path,
    os: {
      tmpdir: function () { return '/isparta-mock-tmp' },
      cpus: function () { return [{}, {}, {}, {}] }
    },
    storage: storage,
    ipc: createMockIpc(),
    process: {
      cwd: function () { return '/' },
      env: { NODE_ENV: 'development' }
    },
    childProcess: createMockChildProcess()
  }
  // host-env 识别纯浏览器 mock（kind: 'browser-mock'）
  window.__ispartaMockBridge = true

  seedItems(fs, path, storage)
  if (process.env.VUE_APP_LANDING_DEMO === '1') return
  if (window.__ispartaMockup) {
    // eslint-disable-next-line no-console
    console.info('[mock-bridge] CEP mockup 仅使用示例合成；__ispartaMockReset() 可重置')
  }

  // 调试工具：控制台执行可清空 mock 数据（含 localStorage）后刷新重来
  window.__ispartaMockReset = () => {
    window.localStorage.removeItem(FS_LS_KEY)
    // eslint-disable-next-line no-console
    console.info('[mock] 已清空，刷新页面将重新播种')
  }

  /**
   * 仅 dev：把前 N 条示例任务标成完成态（产物已由种子写入 mock fs），
   * 用于在纯浏览器里验收「产物大小 / 格式角标 / 点击复制 toast」。
   *   __ispartaMockComplete()    // 默认前 2 条
   *   __ispartaMockComplete(5)   // 全部
   * 依赖 store 挂出的 window.__ispartaStore（同样仅 dev）。
   */
  window.__ispartaMockComplete = function (count) {
    const store = window.__ispartaStore
    if (!store) {
      // eslint-disable-next-line no-console
      console.warn('[mock] store 尚未挂载；刷新页面后再执行')
      return 0
    }
    const items = (store.state && store.state.items) || []
    const n = Math.max(1, Math.min(items.length, Number(count) || 2))
    let done = 0
    items.slice(0, n).forEach(function (it) {
      if (!it || !it.process) { return }
      it.process.text = '转换成功！'
      it.process.detail = ''
      it.process.schedule = 1
      done++
    })
    // eslint-disable-next-line no-console
    console.info('[mock] 已标记 ' + done + ' 条任务为完成态')
    return done
  }

  /**
   * 仅 dev：模拟系统剪贴板写入。host-env.copyFilesToClipboard 检测到该钩子即返回成功，
   * 供纯浏览器验收「复制 + toast」；真实剪贴板不会被改动。
   */
  window.__ispartaMockClipboard = function (paths) {
    // eslint-disable-next-line no-console
    console.info('[mock] 已模拟复制 ' + paths.length + ' 个文件：', paths)
  }

  // 浏览器调试：注入更新状态，用于预览右下角 Dock / 进度 UI  //   window.__updateStub     — Result（state/latest/notes…）
  //   window.__updateAutoStub — electron-updater 状态快照
  //   window.__updateSimulate('available'|'download'|'done'|'error'|'clear')
  window.__updateSimulate = function (mode) {
    // 预览前清掉节流/已通知，保证 dock 会弹。
    // 键名与 src/util/updatePrefs.js 的分键规则保持一致（浏览器预览视作桌面 ⇒ updateCheck.app），
    // 否则清的是旧键、真正被读的键仍带着节流，dock 死活不弹。
    try {
      storage.setItem('updateCheck.app', JSON.stringify({
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
      current: MOCK_VERSION,
      latest: MOCK_NEXT_VERSION,
      notes: '· 阈值递减/重试等共用 Tip 文案，两端面板 info 提示统一\n\n【修复】\n· fix(setting): 阈值递减/重试等共用 Tip 文案',
      artifactName: 'isparta-next-win-x64.exe',
      downloadUrl: 'https://github.com/yancongya/iSparta-next/releases/latest/download/isparta-next-win-x64.exe',
      fallbackUrl: 'https://github.com/yancongya/iSparta-next/releases',
      needsGatekeeperHint: false,
      checkedAt: Date.now(),
      throttled: false,
      assetMissing: false
    }
    if (mode === 'clear') {
      window.__updateStub = Object.assign({}, base, { state: 'latest', latest: MOCK_VERSION })
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
        version: MOCK_NEXT_VERSION,
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
        version: MOCK_NEXT_VERSION,
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
        version: MOCK_NEXT_VERSION,
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

// 生产构建或 Electron（preload 已注入）时不做任何事。
// 例外：CEP 浏览器 mockup（?mock=1）虽然挂着 cep-bridge / ispartaCS，
// 但没有 AE 宿主，必须强制启用 mock 桥才能显示任务；仅 dev 生效。
const forceMockup = typeof window !== 'undefined' && !!window.__ispartaMockup
if ((process.env.NODE_ENV === 'development' || process.env.VUE_APP_LANDING_DEMO === '1') &&
    typeof window !== 'undefined' &&
    (forceMockup ||
      (!window.__adobe_cep__ && !window.cep && !window.ispartaCS && !window.ispartaCepBridge &&
        !window.ispartaAPI))) {
  installMockBridge()
}
