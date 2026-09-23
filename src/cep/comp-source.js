// AE 合成输入源 sourceAdapter（docs/EXEC-WAVE2.md §2.2）
// 列表=合成树（扁平 + parent 预留）；拖入/粘贴/树勾选 → 与 drag/file.js 同形 item
import _ from 'lodash'
import { path, fs } from '../util/node-env'
import { resolveOutputPath } from '../util/outputPath'
import { buildInitialOutputName } from '../util/tokenizeName'
import hostAdapter, { registerSourceAdapter as registerHostSource } from '../util/host-env'

/* global window */

const COMP_MIME = 'text/isparta-comp'

function cs () {
  return (typeof window !== 'undefined' && window.ispartaCS) || null
}

function enabled () {
  return !!(hostAdapter && hostAdapter.supportsCompImport)
}

function evalJson (script) {
  var host = cs()
  if (host && typeof host.evalJson === 'function') {
    return host.evalJson(script)
  }
  // ispartaCS 未挂载时回退 __adobe_cep__.evalScript（与 Home 一致）
  var adobe = (typeof window !== 'undefined' && window.__adobe_cep__) || null
  var fn = (typeof window !== 'undefined' && window.cep && window.cep.evalScript) || (adobe && adobe.evalScript)
  if (typeof fn !== 'function') {
    return Promise.reject(new Error('AE host unavailable'))
  }
  return new Promise(function (resolve, reject) {
    fn(script, function (raw) {
      if (raw === 'EvalScript error.' || raw === undefined || raw === null) {
        reject(new Error('EvalScript error'))
        return
      }
      try { resolve(typeof raw === 'string' ? JSON.parse(raw) : raw) } catch (e) { reject(e) }
    })
  })
}

function readGlobalSetting () {
  try {
    const raw = window.storage && window.storage.getItem('globalSetting')
    return raw ? JSON.parse(raw) : { options: {} }
  } catch (e) {
    return { options: {} }
  }
}

/** jsx 合成节点 → list() 的 ItemSource（扁平，parent 预留嵌套/文件夹） */
export function normalizeCompNode (c) {
  const folderPath = (c && c.folderPath) || ''
  const depth = typeof (c && c.depth) === 'number'
    ? c.depth
    : (folderPath ? String(folderPath).split('/').filter(Boolean).length : 0)
  return {
    id: 'comp:' + (c && (c.index != null ? c.index : c.id)) + ':' + (c && c.name),
    kind: 'comp',
    type: (c && c.type) || 'composition',
    index: Number(c && c.index) || 0,
    name: String((c && c.name) || ''),
    width: Number(c && c.width) || 0,
    height: Number(c && c.height) || 0,
    fps: Number(c && c.fps) || 0,
    duration: Number(c && c.duration) || 0,
    frames: Number(c && c.frames) || 0,
    folderPath,
    parent: folderPath ? 'folder:' + folderPath : null,
    parentId: (c && c.parentId) || (folderPath ? 'folder:' + folderPath : null),
    depth,
    refs: (c && c.refs) || [],
    contains: (c && c.contains) || [],
    usedIn: (c && c.usedIn) || [],
    projectPath: (c && c.projectPath) || ''
  }
}

/**
 * 合成节点 → 与 file.js writeBasic 同形 item（type: 'Comp'，转换前渲序列）
 * basic/options 结构与 PNGs 一致；fileList 占位空数组，由转换链路渲序列填充。
 */
export function toCompItem (comp, optionsOverride) {
  const node = comp && comp.id ? comp : normalizeCompNode(comp)
  const globalSetting = readGlobalSetting()
  const temp = {}
  temp.basic = {}
  temp.options = _.cloneDeep(globalSetting.options || {})
  if (optionsOverride && typeof optionsOverride === 'object') {
    // 只覆盖传入键，避免把整个 options 引用共享出去
    _.each(optionsOverride, function (v, k) {
      temp.options[k] = v
    })
  }
  temp.basic.type = 'Comp'
  temp.basic.compIndex = node.index
  temp.basic.compName = node.name
  temp.basic.fileList = []
  temp.basic.thumbPath = ''

  // 初始输出名：合成名，经 tokenizeName/joinTokens 同规则 + outputSuffix
  if (!temp.options.outputName) {
    temp.options.outputName = buildInitialOutputName(node.name, temp.options)
  }

  const projectPath = node.projectPath || ''
  let address = 'ae-comp'
  if (projectPath) {
    try {
      address = path.dirname(projectPath)
    } catch (e) {
      address = 'ae-comp'
    }
  }
  // 与 file.js 非 PNGs 分支一致：inputPath = 目录 + '/' + 名（无扩展）
  temp.basic.inputPath = address + '/' + node.name
  // 帧数：渲染进度分母（0.15–0.38）
  temp.basic.frameCount = Number(node.frames) || 0
  // CEP 默认输出 = 项目旁「合成名」子目录（对应桌面输出到文件夹）
  if (!temp.options.outputTo || !temp.options.outputTo.template) {
    temp.options.outputTo = Object.assign({}, temp.options.outputTo, {
      mode: 'custom',
      template: '{srcPath}/{srcName}'
    })
  }
  // 输出路径与 tokenizeName / outputPath 同函数展开
  temp.basic.outputPath = resolveOutputPath(temp, temp.options)
  return temp
}

/**
 * 渲染阶段 schedule 映射：0.15–0.38（绝不能超过 analysing 0.4）
 */
const RENDER_SCHEDULE_START = 0.15
const RENDER_SCHEDULE_END = 0.38

function renderScheduleOf (done, total) {
  const d = Number(done) || 0
  const t = Number(total) || 0
  if (t <= 0) { return RENDER_SCHEDULE_START }
  const ratio = Math.max(0, Math.min(1, d / t))
  return RENDER_SCHEDULE_START + (RENDER_SCHEDULE_END - RENDER_SCHEDULE_START) * ratio
}

function localeOf (opts) {
  return (opts && opts.locale) || {}
}

/** 渲染进度 → store.editProcess（或 onProgress）；失败 schedule:-1 与 action.js 一致 */
function emitRenderProgress (item, opts, payload) {
  const loc = localeOf(opts)
  const phase = (payload && payload.phase) || 'progress'
  let text
  let schedule
  if (phase === 'error') {
    text = loc.convertFail || 'Failed'
    schedule = -1
  } else if (phase === 'done') {
    text = (loc.renderingComp || 'Rendering composition') + '...'
    schedule = RENDER_SCHEDULE_END
  } else {
    const done = payload && payload.done
    const total = payload && payload.total
    const label = loc.renderingComp || 'Rendering composition'
    text = (done != null && total) ? (label + ' ' + done + '/' + total + '...') : (label + '...')
    schedule = (phase === 'start')
      ? RENDER_SCHEDULE_START
      : renderScheduleOf(payload && payload.done, payload && payload.total)
  }
  const frame = { text: text, schedule: schedule, phase: phase }
  if (opts && typeof opts.onProgress === 'function') {
    try { opts.onProgress(frame) } catch (e) { /* progress 失败不挡转换 */ }
  }
  if (opts && opts.store && item && item.index != null) {
    try {
      opts.store.dispatch('editProcess', {
        index: item.index,
        text: text,
        schedule: schedule
      })
    } catch (e2) { /* ignore */ }
  }
  return frame
}

const RENDER_EVENT = 'isparta.render.progress'

/** 事件 data → payload（兼容 CEP event 对象 / 字符串） */
function parseRenderEventData (ev) {
  if (!ev) { return null }
  const raw = (typeof ev === 'string') ? ev : (ev.data != null ? ev.data : '')
  if (!raw) { return null }
  try {
    return typeof raw === 'object' ? raw : JSON.parse(raw)
  } catch (e) {
    return null
  }
}

/**
 * 转换前渲 PNG 序列并填 fileList（fileNameList）。
 * 路径变量 {srcName} 始终取合成名；fileList 只作输入帧，不改源目录。
 * opts: { store, locale, onProgress } — 绑定 jsx 渲染进度事件，结束/失败解绑。
 */
export function prepareCompSequence (item, opts) {
  const basic = (item && item.basic) || {}
  if (basic.type !== 'Comp') {
    return Promise.resolve(item)
  }
  if (basic.fileList && basic.fileList.length) {
    return Promise.resolve(item)
  }
  const host = cs()
  if (!host) {
    return Promise.reject(new Error('AE host unavailable'))
  }
  const idx = Number(basic.compIndex)
  const name = basic.compName || ''
  // 序列帧与合成输出同目录：直接用输出设置解析路径（resolveOutputPath，不另建方法）
  // 默认模板 {srcPath}/{srcName} → 项目旁「合成名」子目录
  const outDir = (item.options && resolveOutputPath(item, item.options)) ||
    (basic.tmpDir || basic.tmpOutputDir) ||
    ('ae-comp-tmp-' + (idx != null ? idx : 'x'))
  try {
    if (fs && typeof fs.ensureDirSync === 'function') {
      fs.ensureDirSync(outDir)
    }
  } catch (e) { /* ensure 失败交由 jsx 报错 */ }
  const location = outDir + (String(outDir).slice(-1) === '/' ? '' : (path.sep || '/'))
  const expectedFrames = Number(basic.frameCount) || 0

  // —— 绑定 jsx 渲染进度事件（渲前/渲后/错误）；结束时解绑避免泄漏 ——
  let onRenderEvent = null
  let pollTimer = null
  let maxDone = 0
  const eventToken = location

  function countPngs (folder) {
    try {
      if (fs && typeof fs.readdirSync === 'function') {
        return fs.readdirSync(folder)
          .filter(function (n) { return /\.png$/i.test(n) })
          .length
      }
    } catch (e) { /* ignore */ }
    return 0
  }

  function applyProgress (done, total, phase) {
    const t = Number(total) || expectedFrames || 0
    const d = Number(done) || 0
    if (d > maxDone) { maxDone = d }
    emitRenderProgress(item, opts, {
      phase: phase || 'progress',
      done: maxDone,
      total: t
    })
  }

  function teardownProgress () {
    if (pollTimer) {
      try { clearInterval(pollTimer) } catch (e) { /* ignore */ }
      pollTimer = null
    }
    if (onRenderEvent) {
      try {
        if (host && typeof host.removeEventListener === 'function') {
          host.removeEventListener(RENDER_EVENT, onRenderEvent)
        }
      } catch (e2) { /* ignore */ }
      onRenderEvent = null
    }
  }

  if (host && typeof host.addEventListener === 'function') {
    onRenderEvent = function (ev) {
      const p = parseRenderEventData(ev)
      if (!p) { return }
      // 多任务并发：compIndex 明确不匹配则忽略；token 仅在无 compIndex 时作目录前缀辅助过滤
      if (p.compIndex != null && idx != null && isFinite(idx) && Number(p.compIndex) !== idx) {
        return
      }
      if (p.token && eventToken && (p.compIndex == null || !isFinite(idx))) {
        const tok = String(p.token)
        const base = String(eventToken)
        const tokenHit = tok === base || tok.indexOf(base) === 0 || base.indexOf(tok) === 0
        if (!tokenHit) { return }
      }
      const phase = p.phase || 'progress'
      if (phase === 'error') {
        emitRenderProgress(item, opts, { phase: 'error', done: p.done, total: p.total })
        return
      }
      applyProgress(p.done, p.total, phase)
    }
    try { host.addEventListener(RENDER_EVENT, onRenderEvent) } catch (e) { onRenderEvent = null }
  }

  // 可轮询进度：渲序列 PNG 落盘时按文件数推进 0.15–0.38
  // （renderQueue.render 阻塞 jsx，中途无法再 evalScript，只能从面板侧计数）
  try {
    if (typeof setInterval === 'function') {
      pollTimer = setInterval(function () {
        applyProgress(countPngs(outDir), expectedFrames, 'progress')
      }, 200)
    }
  } catch (e) { pollTimer = null }

  emitRenderProgress(item, opts, {
    phase: 'start',
    done: 0,
    total: expectedFrames
  })

  const script = isFinite(idx)
    ? 'ispartaExportPngSequenceByIndex(' + idx + ',' + JSON.stringify(location) + ')'
    : 'ispartaMatchComps(' + JSON.stringify([{ name: name }]) + ')'
  return host.evalJson(script).then((res) => {
    if (!res || !res.ok) {
      throw new Error((res && res.error) || 'export comp sequence failed')
    }
    const folder = res.folder || outDir
    // jsx ispartaListPngs 优先；退回 readdirSync
    return Promise.resolve()
      .then(() => {
        if (typeof host.evalJson === 'function') {
          return host.evalJson('ispartaListPngs(' + JSON.stringify(folder) + ')')
        }
        return null
      })
      .catch(() => null)
      .then((listRes) => {
        let files = []
        if (listRes && listRes.ok && listRes.files && listRes.files.length) {
          files = listRes.files.slice()
        } else if (fs && typeof fs.readdirSync === 'function') {
          try {
            files = fs.readdirSync(folder)
              .filter(function (n) { return /\.png$/i.test(n) })
              .map(function (n) {
                return folder + (String(folder).slice(-1) === '/' ? '' : '/') + n
              })
          } catch (e) { files = [] }
        }
        if (!files.length) {
          throw new Error('no PNG frames for comp: ' + name)
        }
        basic.fileList = files
        if (!basic.sourceFile) { basic.sourceFile = files[0] }
        // 序列帧与最终输出同走 resolveOutputPath（输出设置路径）；fileList 只作输入帧
        if (item.options) {
          item.basic.outputPath = resolveOutputPath(item, item.options)
        }
        emitRenderProgress(item, opts, {
          phase: 'done',
          done: files.length,
          total: files.length
        })
        return item
      })
  }).catch((err) => {
    // 失败 schedule:-1，与 action.js 失败一致
    emitRenderProgress(item, opts, { phase: 'error' })
    return Promise.reject(err)
  }).then((ready) => {
    teardownProgress()
    return ready
  }, (err) => {
    teardownProgress()
    return Promise.reject(err)
  })
}

/** 剪贴板/拖拽文本 → 名称或 index 列表 */
export function parseCompPayload (text) {
  if (!text) { return [] }
  const raw = String(text).trim()
  if (!raw) { return [] }
  try {
    const parsed = JSON.parse(raw)
    if (parsed instanceof Array) { return parsed }
    if (parsed && parsed.comps instanceof Array) { return parsed.comps }
    if (parsed && parsed.names instanceof Array) { return parsed.names }
    if (parsed && (parsed.name || parsed.index != null)) { return [parsed] }
  } catch (e) { /* 非 JSON：按行/分隔符拆名称 */ }
  return raw
    .split(/[\r\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function matchAndToItems (specs, options) {
  if (!specs || !specs.length) { return Promise.resolve([]) }
  const payload = JSON.stringify(specs)
  return evalJson('ispartaMatchComps(' + payload + ')').then((res) => {
    if (!res || !res.ok) {
      throw new Error((res && res.error) || 'match comps failed')
    }
    const comps = res.comps || []
    return toItems(comps, options)
  })
}

function dataTransferText (ev) {
  const dt = ev && ev.dataTransfer
  if (!dt) { return '' }
  const types = dt.types || []
  const has = (t) => {
    for (let i = 0; i < types.length; i++) {
      if (String(types[i]).toLowerCase() === t) { return true }
    }
    return false
  }
  if (typeof dt.getData === 'function') {
    if (has(COMP_MIME)) {
      const custom = dt.getData(COMP_MIME)
      if (custom) { return custom }
    }
    if (has('text/plain')) {
      const plain = dt.getData('text/plain')
      if (plain) { return plain }
    }
    if (has('text/uri-list')) {
      const uris = dt.getData('text/uri-list')
      if (uris) { return uris }
    }
  }
  return ''
}

function clipboardText (ev) {
  const cd = ev && ev.clipboardData
  if (!cd) { return '' }
  if (typeof cd.getData === 'function') {
    const custom = cd.getData(COMP_MIME) || cd.getData('text/plain')
    if (custom) { return custom }
  }
  return ''
}

function selectedComps () {
  return evalJson('ispartaGetSelectedComps()').then((res) => {
    if (res && res.ok && res.comps) { return res.comps }
    return []
  })
}

/** ItemSource[] / 合成描述 → 与 file.js 同形 Item[] */
export function toItems (selected, options) {
  const list = selected || []
  const out = []
  for (let i = 0; i < list.length; i++) {
    out.push(toCompItem(list[i], options))
  }
  return out
}

/** 启动/刷新时读工程状态；仅异常时由 UI 提示 */
export function getProjectStatus () {
  return evalJson('ispartaGetProjectStatus()').then(function (res) {
    if (res && res.ok) {
      return res
    }
    return { ok: false, code: 'error', message: (res && res.message) || 'error' }
  }).catch(function (e) {
    return { ok: false, code: 'error', message: String(e && e.message || e) }
  })
}

/**
 * 为 Comp 任务异步补首帧封面（不阻塞勾选/列表）。
 * onChange(storeIndex, thumbPath) 由调用方写回 store。
 */
export function ensureThumbs (items, onChange) {
  if (!enabled() || typeof onChange !== 'function') return
  const list = items || []
  const pending = []
  for (let i = 0; i < list.length; i++) {
    const it = list[i]
    const b = it && it.basic
    if (!b || b.type !== 'Comp') continue
    if (b.thumbPath) continue
    const idx = Number(b.compIndex)
    if (!isFinite(idx)) continue
    pending.push({ storeIndex: i, compIndex: idx, name: b.compName || 'comp' })
  }
  if (!pending.length) return

  const osBridge = require('../util/node-env').os
  const pathBridge = require('../util/node-env').path
  let thumbDir = ''
  try {
    thumbDir = pathBridge.join(osBridge.tmpdir(), 'iSparta', 'comp-thumbs')
  } catch (e) {
    return
  }

  // 串行：render queue 同时只能跑一个
  let p = Promise.resolve()
  pending.forEach(function (job) {
    p = p.then(function () {
      const file = pathBridge.join(thumbDir, 'c' + job.compIndex + '-' + Date.now() + '.png')
      const script = 'ispartaExportCompThumbByIndex(' + job.compIndex + ',' + JSON.stringify(file) + ')'
      return evalJson(script).then(function (res) {
        if (res && res.ok && res.path) {
          onChange(job.storeIndex, res.path)
        }
      }).catch(function () { /* 封面失败不挡任务 */ })
    })
  })
}

export const sourceAdapter = {
  id: 'comp',
  kind: 'comp',

  /** 合成树（扁平 + parent 字段预留） */
  list () {
    if (!enabled()) { return Promise.resolve([]) }
    // 对齐 NexusSnap：getProjectTree 递归树 / getCompositions 扁平数组
    return evalJson('ispartaGetProjectTree()').then(function (tree) {
      try {
        var appLog = require('../ui-next/log').default
        appLog.core.info('bridge', 'projectTree', JSON.stringify(tree).slice(0, 240))
      } catch (e) { /* ignore */ }
      var comps = []
      function walk (nodes, folderPath, depth, parentId) {
        if (!nodes || !nodes.length) { return }
        for (var i = 0; i < nodes.length; i++) {
          var n = nodes[i]
          if (!n) { continue }
          if (n.type === 'folder' || n.type === 'root') {
            var fid = 'folder:' + (n.id || n.name)
            walk(n.children, n.type === 'root' ? '' : ((folderPath ? folderPath + '/' : '') + n.name), depth + 1, fid)
          } else if (n.type === 'composition') {
            n.folderPath = folderPath
            n.depth = depth
            n.parent = parentId || null
            n.parentId = parentId || null
            comps.push(n)
          }
        }
      }
      walk(tree && tree.children, '', 0, null)
      if (comps.length) {
        return comps.map(normalizeCompNode)
      }
      // 回退：扁平 getCompositions
      return evalJson('ispartaGetCompositions()').then(function (list) {
        var arr = Array.isArray(list) ? list : ((list && list.comps) || [])
        return arr.map(normalizeCompNode)
      })
    })
  },

  /** 拖入合成（面板树节点 / AE 文本拖拽） */
  onDrop (ev) {
    if (!enabled()) { return Promise.resolve([]) }
    const text = dataTransferText(ev)
    const specs = parseCompPayload(text)
    if (!specs.length) {
      // 松手时无文本载荷：退回 AE 当前选中合成
      return selectedComps().then((comps) => toItems(comps))
    }
    return matchAndToItems(specs)
  },

  /** Ctrl+V 粘贴合成名 / 合成链接 */
  onPaste (ev) {
    if (!enabled()) { return Promise.resolve([]) }
    const text = clipboardText(ev)
    const specs = parseCompPayload(text)
    if (!specs.length) {
      return selectedComps().then((comps) => toItems(comps))
    }
    return matchAndToItems(specs)
  },

  /** 树勾选/匹配结果 → 同形 items */
  toItems (selected, options) {
    return toItems(selected, options)
  },

  /** 定位合成（打开查看器 + 工程面板选中） */
  openSource (item) {
    const basic = (item && item.basic) ? item.basic : item
    const idx = basic && (basic.compIndex != null ? basic.compIndex : basic.index)
    const name = basic && (basic.compName || basic.name)
    if (idx != null && isFinite(Number(idx))) {
      return evalJson('ispartaRevealCompByIndex(' + Number(idx) + ')')
    }
    return evalJson('ispartaRevealCompByName(' + JSON.stringify(String(name || '')) + ')')
  },

  /** 按 name / index 加入（jsx 解析后转 items） */
  addByIdentifiers (specs, options) {
    return matchAndToItems(specs, options)
  },

  /** 转换前渲序列并填 fileList；opts:{ store, locale, onProgress } 绑定渲染进度 */
  prepareSequence (item, opts) {
    return prepareCompSequence(item, opts)
  },

  createItem: toCompItem,
  ensureThumbs,
  getProjectStatus,
  COMP_MIME
}

export function getSourceAdapter () {
  return enabled() ? sourceAdapter : null
}

// 注入 host-env 注册表（Home 只认 host-env.getSourceAdapter）
// 顶部已 import registerHostSource，此处完成注册
registerHostSource({
  list: function () { return sourceAdapter.list.apply(sourceAdapter, arguments) },
  onDrop: function () { return sourceAdapter.onDrop.apply(sourceAdapter, arguments) },
  onPaste: function () { return sourceAdapter.onPaste.apply(sourceAdapter, arguments) },
  toItems: function () { return sourceAdapter.toItems.apply(sourceAdapter, arguments) },
  ensureThumbs: function () { return sourceAdapter.ensureThumbs.apply(sourceAdapter, arguments) },
  getProjectStatus: function () { return sourceAdapter.getProjectStatus.apply(sourceAdapter, arguments) },
  openSource: function () { return sourceAdapter.openSource.apply(sourceAdapter, arguments) },
  addByIdentifiers: function () { return sourceAdapter.addByIdentifiers.apply(sourceAdapter, arguments) },
  prepareSequence: function () { return sourceAdapter.prepareSequence.apply(sourceAdapter, arguments) },
  COMP_MIME: sourceAdapter.COMP_MIME
})

export default sourceAdapter
