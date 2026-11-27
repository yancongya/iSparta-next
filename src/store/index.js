import Vue from 'vue'
import Vuex from 'vuex'

import modules from './modules'

import * as types from './mutation-types'
import { fs, storage, os, path, getProcessBridge, ipc, isMockEnv } from '../util/node-env'
import { MODE_SYSTEM } from '../util/system-locale'
import { resolveOutputPath, SEQ_DIR_DEFAULT_TEMPLATE } from '../util/outputPath'
import { buildInitialOutputName } from '../util/tokenizeName'
import { existingOutputFilesOf } from '../util/task-output'
import { applyGlobalCompressionPatch } from '../util/globalPrefs'
import { classifyOutputConflicts, planSourceRename, allOutputTargets, planCrossItemRename } from '../util/outputConflict'
import appLog from '../ui-next/log'
import notice from '../ui-next/notice'
import i18n from '../i18n'
const _ = require("lodash");
// 【bug fix】修复初次使用时读取缓存错误的问题
let storagePath = "";
try {
  if (getProcessBridge().env.NODE_ENV == "development") {
    storagePath = path.join(os.tmpdir(), 'iSparta/localstorage-dev.json');
  } else {
    storagePath = path.join(os.tmpdir(), 'iSparta/localstorage.json');
  }
  if (!fs.existsSync(storagePath)) {
    fs.ensureFileSync(storagePath)
  }
  // 【bug fix】仅当内容非合法 JSON 时才重置为 "{}"，避免每次启动清空已持久化数据
  let __rawStorage = fs.readFileSync(storagePath, "utf-8").trim()
  let __validStorage = false
  if (__rawStorage) {
    try {
      JSON.parse(__rawStorage)
      __validStorage = true
    } catch (e) {
      __validStorage = false
    }
  }
  if (!__validStorage) {
    fs.writeFileSync(storagePath, "{}", "utf-8")
  }
} catch (eStoreFs) {
  // 桥不完整时不能让整个 bundle 求值失败（Vue 将永远挂不上）
  try { console.error('[store] storage init failed', eStoreFs) } catch (e) { /* ignore */ }
}

try { storage.setStoragePath(storagePath); } catch (eSetPath) { /* ignore */ }
window.storage = storage;
Vue.use(Vuex)
// 原始数据
const defaultState = {
  // 语言出厂默认＝跟随系统（'system' 哨兵），实际 locale 由 util/system-locale 解析。
  // 若这里写死 'zh-cn'，「还没选过」与「用户显式选了简中」将无法区分，
  // 系统语言永远探测不出来（§5.9.2）。
  language: MODE_SYSTEM,
  options: {
    'frameRate': 25,
    'frameRemap': {
      enabled: false,
      targetFrameRate: 12
    },
    'loop': 0,
    'outputSuffix': '',
    'outputName': '',
    // 与源文件同扩展名的冲突格式（大写 APNG/GIF/WEBP），空=无冲突。
    // 只给这一种格式加 _{format} 后缀，其余格式保持基础名——后加字段，旧任务经 loadSetting 兜底为空。
    'conflictFormat': '',
    // 防覆盖后缀开关：false=关闭（有冲突也不加后缀），缺省 true（维持旧行为）。
    'suffixEnabled': true,
    'outputFormat': ['APNG', 'GIF', 'WEBP'],
    'floyd': {
      checked: true,
      value: 0.35
    },
    'quality': {
      checked: true,
      value: 80
    },
    // APNG 保真输出：true=关压缩、保留源 32-bit RGBA，仅走 apngopt 无损；
    // 缺省 false=维持现状（走压缩）。后加字段，下游一律经 isPreserveBitDepth 兜底。
    'preserveBitDepth': false,
    // 压缩路线：quality（质量系数，默认）/ colors（色深档位）。两条路线互斥，
    // 缺省字段一律按 quality 解读（paletteConfig.normalizePalette 兜底），旧配置零破坏
    'palette': {
      mode: 'quality',
      colors: 256
    },
    'sizeLimit': {
      enabled: true,
      maxMB: 0.78125,
      maxBytes: 819200,
      unit: 'KB',
      autoDelete: true,
      autoQuality: true,
      step: 5,
      maxTries: 10
    },
    'outputTo': {
      mode: 'output',
      customPath: '',
      template: '{srcPath}'
    },
    // CEP 序列帧目录：出厂默认＝工程旁合成名目录；与产物 outputTo 互不引用
    'seqDirTemplate': SEQ_DIR_DEFAULT_TEMPLATE,
    // 本地调试日志 HTTP 服务：重启后自动开启（默认关，用户显式打开才持久化）。
    // 实际服务与状态由 ui-next/log.js 的全局 controller 持有；此处仅为设置持久位。
    'debugLog': { enabled: false }
  },
  basic: {
    fileList: [],
    type: 'APNG',
    thumbPath: '',
    inputPath: '',
    outputPath: ''
  },
  process: {
    text: '',
    schedule: 0,
    // 失败/中止的具体原因（stderr 摘要等）；text 只放「生成失败」这类通用文案，
    // 合成树状态列与 hover 用 detail 回答「为什么」
    detail: ''
  },
  isSelected: true
}



// state
var state = {
  items: [],
  locked: false
}

const persistItems = _.debounce(function () {
  var payload = JSON.stringify(state.items)
  storage.setItem('iSparta-item', payload)
}, 200)

/**
 * 定位 payload 指向的任务对象：
 * 优先按对象身份（state.items.indexOf）——预检拿到的就是 store 里的原对象，
 * 身份定位不受「选中项内序号」口径影响；没有对象时回退到选中项内序号（processor 回写用的口径）。
 */
function resolveTargetItem (state, payload) {
  if (!payload) return null
  if (payload.item) {
    const i = state.items.indexOf(payload.item)
    if (i >= 0) return state.items[i]
  }
  const selectedItem = _.filter(state.items, { isSelected: true })
  return (selectedItem && selectedItem[payload.index]) || null
}


// 旧版第一个输出预设是 {srcPath}/output（总在同级建 output 目录），现已改为直接
// 输出到源目录 {srcPath}。已存任务与全局默认里写死的旧模板必须在此改写，
// 否则用户即使没动过设置，也会继续被输出到 /output。
// 只精确匹配旧默认模板（含反斜杠变体），用户自定义的路径不受影响。
function migrateLegacyOutputTpl (tpl) {
  if (typeof tpl !== 'string') { return tpl }
  var norm = tpl.trim().replace(/[\\/]+/g, '/')
  return norm === '{srcPath}/output' ? '{srcPath}' : tpl
}

//init globalSetting
var globalSetting = window.storage.getItem('globalSetting');

if (!globalSetting) {

  let tempSetting = defaultState;
  window.storage.setItem('globalSetting', JSON.stringify(tempSetting))
} else {
  // 迁移：全局默认帧率无独立编辑入口，同步为最新出厂默认值
  try {
    let parsed = JSON.parse(globalSetting)
    let changed = false
    if (parsed && parsed.options) {
      if (!parsed.options.frameRemap) {
        parsed.options.frameRemap = _.cloneDeep(defaultState.options.frameRemap)
        changed = true
      } else {
        if (parsed.options.frameRemap.enabled === undefined) {
          parsed.options.frameRemap.enabled = false
          changed = true
        }
        if (!isFinite(Number(parsed.options.frameRemap.targetFrameRate)) || Number(parsed.options.frameRemap.targetFrameRate) <= 0) {
          parsed.options.frameRemap.targetFrameRate = defaultState.options.frameRemap.targetFrameRate
          changed = true
        }
      }
      if (parsed.options.frameRate !== defaultState.options.frameRate) {
        parsed.options.frameRate = defaultState.options.frameRate
        changed = true
      }
      // 仅当仍为旧出厂后缀 iSpt 时迁移为空，保留用户自定义后缀
      if (parsed.options.outputSuffix === 'iSpt') {
        parsed.options.outputSuffix = ''
        changed = true
      }
      // 后加字段：冲突格式缺省为空（旧任务沿用 outputName 原值，不改行为）
      if (typeof parsed.options.conflictFormat !== 'string') {
        parsed.options.conflictFormat = ''
        changed = true
      }
      if (typeof parsed.options.suffixEnabled !== 'boolean') {
        parsed.options.suffixEnabled = true
        changed = true
      }
      if (!parsed.options.sizeLimit) {
        parsed.options.sizeLimit = _.cloneDeep(defaultState.options.sizeLimit)
        changed = true
      } else {
        // 补 unit / maxBytes
        if (!parsed.options.sizeLimit.unit) {
          parsed.options.sizeLimit.unit = 'MB'
          changed = true
        }
        if (!isFinite(Number(parsed.options.sizeLimit.maxBytes)) || Number(parsed.options.sizeLimit.maxBytes) <= 0) {
          const mb = Number(parsed.options.sizeLimit.maxMB)
          parsed.options.sizeLimit.maxBytes = (isFinite(mb) && mb > 0) ? mb * 1024 * 1024 : 1048576
          changed = true
        }
      }
      // 【bug fix】outputTo 为后加项：老数据缺这个键时，_.extend 给 Vue 2 加的是
      // 非响应式新属性，输出路径分段控件点击后会从 store 读回 undefined 被打回原值。
      if (!parsed.options.outputTo) {
        parsed.options.outputTo = _.cloneDeep(defaultState.options.outputTo)
        changed = true
      } else if (!parsed.options.outputTo.mode) {
        parsed.options.outputTo.mode = defaultState.options.outputTo.mode
        changed = true
      }
      var gTpl = migrateLegacyOutputTpl(parsed.options.outputTo.template)
      if (gTpl !== parsed.options.outputTo.template) {
        parsed.options.outputTo.template = gTpl
        changed = true
      }
      // seqDirTemplate 为后加项：补齐为新出厂默认，保证新建任务默认落在工程旁合成名目录
      if (typeof parsed.options.seqDirTemplate !== 'string') {
        parsed.options.seqDirTemplate = SEQ_DIR_DEFAULT_TEMPLATE
        changed = true
      }
      // floyd / quality 为后加项且下游直读（globalSetting.vue options.floyd.value、
      // apngCompress options.floyd.checked、comp-source options.quality），缺字段补齐
      if (!parsed.options.floyd) {
        parsed.options.floyd = _.cloneDeep(defaultState.options.floyd)
        changed = true
      }
      if (!parsed.options.quality) {
        parsed.options.quality = _.cloneDeep(defaultState.options.quality)
        changed = true
      }
      // preserveBitDepth 为后加项且下游直读（isPreserveBitDepth 兜底），缺省 false 零行为差异
      if (typeof parsed.options.preserveBitDepth !== 'boolean') {
        parsed.options.preserveBitDepth = false
        changed = true
      }
      // palette 缺省语义即 quality 路线（normalizePalette 兜底），物化为出厂值零行为差异
      if (!parsed.options.palette) {
        parsed.options.palette = _.cloneDeep(defaultState.options.palette)
        changed = true
      }
    }
    // 一次性语言迁移：旧版把 'zh-cn' 写死为出厂值，与「用户显式选了简中」不可区分。
    // 按 docs/PLAN-GUIDE-PAGES.md §5.9 的决定「全部用户启用环境自适应」，把出厂遗留的
    // 'zh-cn' 归零为 'system'，让老用户也跟随系统语言（承认一次性语言变化）。
    // 迁移后 language 不再是 'zh-cn'，或已置标记，都不会重复触发。
    if (parsed && parsed.language === 'zh-cn' && !parsed.langModeMigrated) {
      parsed.language = MODE_SYSTEM
      parsed.langModeMigrated = true
      changed = true
    }
    if (changed) {
      window.storage.setItem('globalSetting', JSON.stringify(parsed))
    }
  } catch (e) { /* globalSetting 非法时忽略，后续逻辑会重建 */ }
}
// get localstorage data
var localData = window.storage.getItem('iSparta-item')
if (localData) {
  // 取loaclstorage时重置进度
  var localItems = JSON.parse(localData)
  let items = [];
  _.each(localItems, function (item) {
    // CEP 合成任务实时同步，不恢复本地旧列表
    if (item && item.basic && item.basic.type === 'Comp') { return }
    let isError = false;
    for (let i = 0; i < item.basic.fileList.length; i++) {

      if (!fs.existsSync(item.basic.fileList[i])) {
        isError = true;
        break;
      }
    }
    if (!isError) {
      item.process = item.process || {}
      item.process.text = ''
      item.process.schedule = 0;
      // 上次运行的原因与过程文案一样不跨会话保留；同时也是老数据的响应式兜底
      item.process.detail = ''
      item.isSelected = !!item.isSelected
      // 老数据里每条 item 的 options 是独立副本，同样按出厂默认补齐缺失键，
      // 否则后续 _.extend 写入的是非响应式属性，界面不会跟着更新。
      item.options = item.options || {}
      if (!item.options.frameRemap) {
        item.options.frameRemap = _.cloneDeep(defaultState.options.frameRemap)
      } else {
        if (item.options.frameRemap.enabled === undefined) item.options.frameRemap.enabled = false
        if (!isFinite(Number(item.options.frameRemap.targetFrameRate)) || Number(item.options.frameRemap.targetFrameRate) <= 0) {
          item.options.frameRemap.targetFrameRate = defaultState.options.frameRemap.targetFrameRate
        }
      }
      if (!item.options.outputTo) {
        item.options.outputTo = _.cloneDeep(defaultState.options.outputTo)
      }
      // 老任务没有序列帧模板时补齐默认；桌面任务同样带上，字段语义与 CEP 解耦
      if (typeof item.options.seqDirTemplate !== 'string') {
        item.options.seqDirTemplate = SEQ_DIR_DEFAULT_TEMPLATE
      }
      // 冲突格式后加字段：旧任务为空 → outputNameFor 回退到 outputName 原值，行为不变
      if (typeof item.options.conflictFormat !== 'string') {
        item.options.conflictFormat = ''
      }
      // 后缀开关后加字段：旧任务缺省启用，outputNameFor/suffixEnabledOf 也按 !==false 兜底
      if (typeof item.options.suffixEnabled !== 'boolean') {
        item.options.suffixEnabled = true
      }
      if (!item.options.sizeLimit) {
        item.options.sizeLimit = _.cloneDeep(defaultState.options.sizeLimit)
      }
      // preserveBitDepth 为后加项且下游直读，缺省 false（维持现状走压缩）
      if (typeof item.options.preserveBitDepth !== 'boolean') {
        item.options.preserveBitDepth = false
      }
      // 输出路径旧模板迁移（{srcPath}/output → {srcPath}）
      if (item.options.outputTo) {
        var iTpl = migrateLegacyOutputTpl(item.options.outputTo.template)
        if (iTpl !== item.options.outputTo.template) {
          item.options.outputTo.template = iTpl
          // 模板变了要重算已存的 outputPath，否则界面与真实落盘路径不一致
          item.basic.outputPath = resolveOutputPath(item, item.options)
        }
      }
      // 旧版（a6bbb47）给 PNGs 自动命名「<文件夹去空格>_apng」，c426076 起已移除；
      // 但已存任务恢复时不改写 outputName，旧后缀会永久留着。
      // 按指纹剥离：仅当 PNGs 且基名与所在文件夹同形（忽略空格/下划线差异）时才去掉
      // 「_apng」，手起的名字（与文件夹名对不上）不受影响。
      if (item.basic && item.basic.type === 'PNGs' &&
          typeof item.options.outputName === 'string' &&
          /_apng$/.test(item.options.outputName) &&
          item.basic.fileList && item.basic.fileList.length) {
        var legacyBase = item.options.outputName.slice(0, -'_apng'.length)
        var folder = path.basename(path.dirname(item.basic.fileList[0]))
        var norm = function (s) { return String(s).replace(/[ _]/g, '') }
        if (norm(legacyBase) === norm(folder)) {
          item.options.outputName = folder.replace(/[ ]/g, '')
        }
      }
      items.push(item);
    }
  })
  // 恢复后至少选中一条，避免右侧一直提示「请选中至少一个」
  if (items.length && !_.some(items, { isSelected: true })) {
    items[0].isSelected = true
  }
  state.items = items
}
// 只有这里才能才state的值
const mutations = {
  // CEP 合成勾选同步（向后兼容增量，桌面可不调用）
  REMOVE_AT (state, index) {
    if (index >= 0 && index < state.items.length) {
      state.items.splice(index, 1)
    }
  },
  [types.ITEMS_ADD](state, data) {
    if (state.locked) {
      return false
    }
    let tempState = JSON.parse(storage.getItem('globalSetting'));
    // console.log(defaultState);
    var itemData = _.cloneDeep(_.extend(tempState, data))
    _.each(state.items, function (item) {
      item.isSelected = false
    })
    state.items.push(itemData)
    persistItems()
  },
  [types.ITEMS_REMOVE](state) {
    if (state.locked) {
      return false
    }
    var remainList = _.remove(state.items, {
      isSelected: false
    })
    state.items = remainList
    if (state.items.length > 1) {
      state.items[0].isSelected = true
    }
    persistItems()
  },
  // 任务运行中也可删除：先终止再移除；不检查 locked
  [types.ITEMS_REMOVE_FORCE](state) {
    var remainList = _.remove(state.items, {
      isSelected: false
    })
    state.items = remainList
    if (state.items.length && !_.some(state.items, { isSelected: true })) {
      state.items[0].isSelected = true
    }
    persistItems()
  },
  [types.ITEMS_MARK_ABORTED](state) {
    var abortedText = i18n.t('noticeConvertAborted')
    _.each(state.items, function (item) {
      if (!item.isSelected) { return }
      var s = item.process && item.process.schedule
      if (typeof s === 'number' && s > 0 && s < 1 && item.process) {
        item.process.schedule = -1
        item.process.text = abortedText
        // 中止不是转换器报错：清掉上一轮的失败原因，hover 里只显示「已中止」
        item.process.detail = ''
      }
    })
    // 进度不写 storage
  },
  [types.ALL_REMOVE](state) {
    if (state.locked) {
      return false
    }

    state.items = []
    persistItems()
  },
  [types.ITEMS_EDIT_BASIC](state, keyValue) {
    if (state.locked) {
      return false
    }
    // 多选时同样写入全部选中项（输出目录等）
    _.each(state.items, function (item) {
      if (!item.isSelected) { return }
      _.extend(item.basic, keyValue)
    })
    persistItems()
  },
  [types.ITEMS_EDIT_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    // 单项写入：只命中当前选中的那一项（单选=1）；多选请用 ITEMS_EDIT_MULTI_OPTIONS
    var selectedItem = _.filter(state.items, { isSelected: true })
    if (selectedItem.length !== 1) {
      return false
    }
    if (!selectedItem[0].options) { selectedItem[0].options = {} }
    const patch = _.cloneDeep(keyValue)
    Object.keys(patch).forEach(function (key) { Vue.set(selectedItem[0].options, key, patch[key]) })
    persistItems()
  },
  [types.ITEMS_EDIT_MULTI_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    // 共享设置只写到「当前选中」项，避免未选中的任务被误改；
    // 每项独立深拷贝，防止 quality/sizeLimit 等嵌套对象被多项共用
    _.each(state.items, function (item) {
      if (!item.isSelected) { return }
      if (!item.options) { item.options = {} }
      const patch = _.cloneDeep(keyValue)
      Object.keys(patch).forEach(function (key) { Vue.set(item.options, key, patch[key]) })
    })
    persistItems()
  },
  [types.ITEMS_EDIT_PROCESS](state, keyValue) {
    var selectedItem = _.filter(state.items, { isSelected: true })
    var target = selectedItem && selectedItem[keyValue.index]
    // 运行中删除/改选后 index 可能越界：静默跳过，避免整条转换链崩溃
    if (!target || !target.process) {
      return
    }
    var prevSchedule = target.process.schedule
    _.extend(target.process, keyValue)
    // 状态跃迁但没给新原因：清掉上一轮的 detail，避免失败/重跑后还挂着旧报错
    if (keyValue.detail === undefined && keyValue.schedule !== undefined &&
      keyValue.schedule !== prevSchedule) {
      target.process.detail = ''
    }
  },
  // 落盘保底改名回写：转换中 state.locked=true，常规 EDIT_BASIC 会被拒，
  // 这里必须绕过锁。index 口径同 EDIT_PROCESS（选中项内序号），per-format 写入，
  // 不污染共享 outputName（否则三个格式又一起变名）。Vue.set 保证任务条响应式刷新。
  [types.ITEMS_APPLY_NAME_OVERRIDE](state, payload) {
    const target = resolveTargetItem(state, payload)
    if (!target) return
    if (!target.basic) target.basic = {}
    if (!target.basic.outputNameOverride) Vue.set(target.basic, 'outputNameOverride', {})
    Vue.set(target.basic.outputNameOverride, payload.format, payload.name)
    persistItems()
  },
  // 跨任务同名「另存」的一次性改名：与持久 override 同形（per-format），但独立字段。
  // 只在本次转换生效——下次 preflight 入口清掉，任务名回到基础名，冲突重新识别。
  [types.ITEMS_APPLY_TRANSIENT_NAME](state, payload) {
    const target = resolveTargetItem(state, payload)
    if (!target) return
    if (!target.basic) target.basic = {}
    if (!target.basic.transientNameOverride) Vue.set(target.basic, 'transientNameOverride', {})
    Vue.set(target.basic.transientNameOverride, payload.format, payload.name)
    persistItems()
  },
  [types.ITEMS_CLEAR_TRANSIENT_NAMES](state) {
    state.items.forEach(function (item) {
      if (item && item.basic && item.basic.transientNameOverride) {
        Vue.set(item.basic, 'transientNameOverride', {})
      }
    })
    persistItems()
  },
  // 「重置输出名」：清掉指定任务的持久改名(outputNameOverride)与一次性改名(transientNameOverride)，
  // 让落盘名回到 options.outputName 基础名。index 为 items 全列表下标（与 editOutputNameAt 同口径）。
  [types.ITEMS_CLEAR_NAME_OVERRIDES_AT](state, payload) {
    const item = state.items[payload && payload.index]
    if (!item || !item.basic) return
    if (item.basic.outputNameOverride) Vue.set(item.basic, 'outputNameOverride', {})
    if (item.basic.transientNameOverride) Vue.set(item.basic, 'transientNameOverride', {})
    persistItems()
  },
  // 预检里用户明确选择「直接覆盖源文件」→ 标记该任务允许覆盖。
  // processor 的落盘保底（fallbackRenameForSource）见到该标记就放行。
  // 每次开始转换前 preflight 会先把上一轮的标记清掉，避免旧授权漏到下一次。
  [types.ITEMS_SET_SOURCE_OVERWRITE](state, payload) {
    const target = resolveTargetItem(state, payload)
    if (!target) return
    if (!target.basic) Vue.set(target, 'basic', {})
    Vue.set(target.basic, 'overwriteSource', payload.value !== false)
    persistItems()
  },
  [types.SINGLE_SELECT](state, index) {
    if (state.locked) {
      return false
    }
    _.each(state.items, function (item) {
      item.isSelected = false
    })
    state.items[index].isSelected = true
    persistItems()
  },
  [types.SET_SELECTED](state, index) {
    // 锁定态也要能选中：右键菜单依赖当前项定位（删除/终止）
    if (!state.items[index]) { return }
    state.items[index].isSelected = true
  },
  [types.MULTI_SELECT](state, index) {
    if (state.locked) {
      return false
    }
    state.items[index].isSelected = !state.items[index].isSelected
    persistItems()
  },
  [types.ALL_SELECTED](state) {
    if (state.locked) {
      return false
    }
    _.each(state.items, function (item) {
      item.isSelected = true
    })
    persistItems()
  },
  [types.ITEMS_SET_SELECTED](state, indexes) {
    if (state.locked) {
      return false
    }
    var set = {}
    _.each(indexes || [], function (i) {
      set[i] = true
    })
    _.each(state.items, function (item, i) {
      item.isSelected = !!set[i]
    })
    persistItems()
  },
  [types.NONE_SELECTED](state) {
    if (state.locked) {
      return false
    }
    _.each(state.items, function (item) {
      item.isSelected = false
    })
    persistItems()
  },
  [types.SET_LOCK](state, boolean) {
    state.locked = boolean
  }

}
// actions are functions that cause side effects and can involve
// asynchronous operations.
// 主要处理异步事件
const actions = {

  //
  removeAt (context, index) {
    context.commit('REMOVE_AT', index)
  },
  /**
   * 开始转换前的覆盖预检（桌面/CEP 同一入口）：
   * 目标 === 源文件 → 阻断询问（可选「直接覆盖」或「加后缀另存」）；
   * 目标已存在但非源 → 8s warning，不阻断。
   * 返回 false 时调用方必须放弃本次启动。
   */
  async preflightOutputs (context, items) {
    // 纯浏览器 mock：种子预写产物供完成态角标演示，必然命中「目标文件已存在」，
    // 而 mock 转换写的是内存模拟产物、不碰真实文件，这类覆盖告警是假阳性，直接放行。
    if (isMockEnv()) { return true }
    // items 兼容两种形态（签名不能变，L1 静态断言锁着）：
    //  - 任务数组（sortBar 与 L1 沙箱）：无目录覆盖，用各 item 的 outputPath；
    //  - { items, sameOutputPath }：「输出到目录」按钮选的新目录，预检必须与 processor
    //    的落盘目录一致，否则会拿旧目录的产物误报「已存在」、又漏掉新目录的真同名。
    const payload = (items && !Array.isArray(items) && items.items) ? items : null
    const list = payload
      ? (payload.items && payload.items.length ? payload.items : context.rootState.items)
      : ((items && items.length) ? items : context.rootState.items)
    const sameOutputPath = payload && payload.sameOutputPath ? String(payload.sameOutputPath) : ''
    // 覆盖授权只对本次有效：先清掉上一轮留下的标记，避免用户这次选了「另存为」，
    // 落盘时却仍被上一轮的「允许覆盖」放行。
    list.forEach(function (item) {
      if (item && item.basic && item.basic.overwriteSource) {
        context.dispatch('setSourceOverwrite', { item: item, value: false })
      }
    })
    // 跨任务「另存」的一次性改名同样只对本次有效：先清掉上一轮的临时名，
    // 让下面的重分类从基础名出发 → 两个同名任务再次冲突 → 再次弹窗询问。
    // 必须在 classifyNow 之前清，否则分类看到的是旧临时名、误判为无冲突。
    context.dispatch('clearTransientNames')
    const existsFile = function (file) {
      try { return fs.existsSync(file) } catch (e) { return false }
    }
    // 撞源「另存」会改掉实际产物名，跨任务冲突必须在改名后重新分类，
    // 否则拿到的还是陈旧路径（旧名已让位，新名可能才真正撞车）。
    const classifyNow = function () { return classifyOutputConflicts(list, existsFile, sameOutputPath) }
    const conflicts = classifyNow()
    // 改名另存后可能出现新的「目标已存在」（如上一轮已产出过 cool_1.png），
    // 这类目标不在原始冲突分类里，要单独收集后一并提示。
    const extraExisting = []
    const limit = 8
    const fmt = function (rows) {
      const paths = rows.slice(0, limit).map(function (r) { return r.path }).join('\n')
      return paths + (rows.length > limit ? '\n…' : '')
    }
    if (conflicts.source.length) {
      // 撞源的目标 → 保底改名目标（cool.png → cool_1.png）。
      // 与落盘时 processor 用的是同一个 fallbackRenameForSource，
      // 保证弹窗上承诺的文件名 == 真正落盘的文件名。
      const plan = planSourceRename(conflicts.source)
      const renamed = plan.filter(function (p) { return p.changed })
      const renameCount = renamed.length || conflicts.source.length
      const choice = await notice.confirm({
        title: i18n.t('noticeOverwriteSourceTitle'),
        text: i18n.t('noticeOverwriteSourceBody', {
          count: conflicts.source.length,
          paths: fmt(conflicts.source)
        }),
        cancelText: i18n.t('cancel'),
        // 破坏性备选：直接覆盖源文件（原文件就没了）
        altText: i18n.t('overwriteDirect'),
        altValue: 'overwrite',
        // 主操作：加后缀另存（安全方向，保留原文件）
        confirmText: renamed.length === 1
          ? i18n.t('overwriteRenameOne', { name: renamed[0].file })
          : i18n.t('overwriteRenameMany', { count: renameCount })
      })
      if (choice === 'overwrite') {
        // 用户明确授权覆盖：标记后 processor 的落盘保底对该任务放行
        conflicts.source.forEach(function (row) {
          context.dispatch('setSourceOverwrite', { item: row.item, value: true })
        })
      } else if (choice === true) {
        // 用户选择加后缀另存：按格式写入实际产物名，目标随之不再是源文件
        renamed.forEach(function (p) {
          context.dispatch('applyNameOverride', { item: p.item, format: p.format, name: p.name })
          if (existsFile(p.renamed)) extraExisting.push({ item: p.item, path: p.renamed })
        })
      } else {
        return false
      }
    }
    // ---- 跨任务同名：两个任务写同一个目标，后者会静默覆盖前者（本次 6→5 的根因）----
    // 必须在上面的撞源改名之后重新分类，确保拿到的是最终产物名。
    const after = classifyNow()
    if (after.crossItem.length) {
      const rows = after.crossItem
      const occupied = allOutputTargets(list, sameOutputPath).map(function (r) { return r.path })
      const plan = planCrossItemRename(rows, occupied, existsFile)
      const renamed = plan.filter(function (p) { return p.changed })
      const choice = await notice.confirm({
        title: i18n.t('noticeCrossItemTitle'),
        text: i18n.t('noticeCrossItemBody', {
          count: rows.length,
          paths: fmt(rows)
        }),
        cancelText: i18n.t('cancel'),
        // 破坏性备选：允许后一个任务覆盖前一个任务的同名产物
        altText: i18n.t('overwriteCrossItem'),
        altValue: 'overwrite',
        confirmText: renamed.length === 1
          ? i18n.t('overwriteRenameOne', { name: renamed[0].file })
          : i18n.t('overwriteRenameMany', { count: renamed.length || rows.length })
      })
      if (choice === 'overwrite') {
        // 落盘层只防「撞源」，本就不阻止覆盖非源的同名产物 → 无需额外标记
      } else if (choice === true) {
        // 给后一个任务写**一次性**实际产物名：本次 processor 深拷贝带走后落盘，
        // 任务条同步显示；下次预检入口清除 → 任务名回基础名 → 再次询问。
        // 不能写持久 applyNameOverride，否则改名残留、下次不再冲突也不再弹窗。
        renamed.forEach(function (p) {
          context.dispatch('applyTransientName', { item: p.item, format: p.format, name: p.name })
          if (existsFile(p.renamed)) extraExisting.push({ item: p.item, path: p.renamed })
        })
      } else {
        return false
      }
    }
    const existingRows = after.existing.concat(extraExisting)
    if (existingRows.length) {
      notice.warning(
        i18n.t('noticeOverwriteExistingTitle'),
        i18n.t('noticeOverwriteExistingBody', {
          count: existingRows.length,
          paths: fmt(existingRows)
        })
      )
    }
    return true
  },
  add(context, data) {
    context.commit('ITEMS_ADD', data)
  },
  remove(context) {
    context.commit('ITEMS_REMOVE')
  },
  /** 运行中删除：杀掉子进程 → 标记中断 → 强制移除选中项 */
  removeSelectedForce(context) {
    return Promise.resolve()
      .then(function () {
        return ipc.invoke('job:cancelAll')
      })
      .catch(function () { return null })
      .then(function () {
        context.commit('ITEMS_MARK_ABORTED')
        return new Promise(function (r) { setTimeout(r, 40) })
      })
      .then(function () {
        context.commit('ITEMS_REMOVE_FORCE')
        context.commit('SET_LOCK', false)
      })
  },
  /** 只终止当前选中任务，不删除 */
  stopSelectedTasks(context) {
    context.commit('ITEMS_MARK_ABORTED')
    return Promise.resolve()
      .then(function () {
        return ipc.invoke('job:cancelAll')
      })
      .catch(function () { return null })
      .then(function () {
        var anyRunning = _.some(context.rootState.items, function (it) {
          var s = it.process && it.process.schedule
          return typeof s === 'number' && s > 0 && s < 1
        })
        if (!anyRunning) {
          context.commit('SET_LOCK', false)
        }
      })
  },
  removeAll(context) {
    context.commit('ALL_REMOVE')
  },
  editBasic(context, keyValue) {
    context.commit('ITEMS_EDIT_BASIC', keyValue)
  },
  editOptions(context, keyValue) {
    context.commit('ITEMS_EDIT_OPTIONS', keyValue)
  },
  editMultiOptions(context, keyValue) {
    context.commit('ITEMS_EDIT_MULTI_OPTIONS', keyValue)
  },
  /** 多选：按模板写 outputTo，并为每项解析 outputPath */
  applyOutputTemplate(context, payload) {
    var patch = payload || {}
    var items = _.filter(context.rootState.items, { isSelected: true })
    if (!items.length) { return }
    var nextTo = patch.outputTo || {}
    _.each(items, function (item) {
      if (!item.options) { item.options = {} }
      // 每项独立拷贝，避免共享同一 outputTo 引用
      item.options.outputTo = Object.assign({}, item.options.outputTo, _.cloneDeep(nextTo))
      if (!item.basic) { item.basic = {} }
      item.basic.outputPath = resolveOutputPath(item, item.options)
    })
    persistItems()
  },
  /** 多选：只改某一项的 outputName（按 items 全列表 index） */
  editOutputNameAt(context, payload) {
    if (!payload || context.rootState.locked) { return }
    var item = context.rootState.items[payload.index]
    if (!item) { return }
    if (!item.options) { item.options = {} }
    item.options.outputName = payload.name
    persistItems()
  },
  /** 重置输出名：清掉单项的持久/一次性改名，回到基础名（按 items 全列表 index） */
  clearNameOverridesAt(context, payload) {
    if (!payload || context.rootState.locked) { return }
    context.commit(types.ITEMS_CLEAR_NAME_OVERRIDES_AT, payload)
  },
  /** 单项写入 options（按 items 全列表 index）：单任务设置只命中该项 */
  editOptionsAt(context, payload) {
    if (!payload || context.rootState.locked) { return }
    var item = context.rootState.items[payload.index]
    if (!item) { return }
    if (!item.options) { item.options = {} }
    // Vue 2 对「新增属性」不触发依赖通知：outputSuffix 等后加字段若原任务没有，
    // 用 _.extend 写入会让依赖它的 computed（如设置面板胶囊）保持旧值。逐键 Vue.set。
    const patch = _.cloneDeep(payload.patch || {})
    Object.keys(patch).forEach(function (key) { Vue.set(item.options, key, patch[key]) })
    persistItems()
  },
  /**
   * 把「开启压缩」总开关同步进全局默认，使新导入任务继承同一保真选择。
   * 只写压缩相关字段，其他 options 原样保留（见 globalPrefs.applyGlobalCompressionPatch）。
   * 任务面板单项编辑本身不透传 globalSetting，新任务从 globalSetting 派生，
   * 缺了这一步会出现「关掉压缩后新导入的 32-bit 序列仍出 8-bit」（issue #3 反馈 02）。
   */
  syncGlobalCompression(context, patch) {
    var raw = null
    try { raw = JSON.parse(storage.getItem('globalSetting')) } catch (e) { raw = null }
    var next = applyGlobalCompressionPatch(raw, patch)
    storage.setItem('globalSetting', JSON.stringify(next))
  },
  /** 按 items 下标改 basic（如 thumbPath），不影响其他项 */
  editBasicAt(context, payload) {
    if (!payload || context.rootState.locked) { return }
    var item = context.rootState.items[payload.index]
    if (!item) { return }
    if (!item.basic) { item.basic = {} }
    _.extend(item.basic, payload.patch || {})
    persistItems()
  },
  /** CEP：用 AE 当前合成列表整表替换 Comp 任务（实时，不保留已删除合成） */
  syncCompTasks(context, payload) {
    if (context.rootState.locked) { return }
    var gen = (payload && payload.items) || []
    var selectedSet = {}
    _.each((payload && payload.selectedKeys) || [], function (k) {
      selectedSet[String(k)] = true
    })
    var tempState = JSON.parse(storage.getItem('globalSetting'))
    // 合成列表会随 AE 项目树刷新而整表重建。收集当前内存和上次持久化的
    // Comp 任务设置，按工程路径 + 合成序号 + 名称恢复单项选项。
    var previousComps = []
    function collectComps (items, requireProjectPath) {
      _.each(items || [], function (it) {
        if (it && it.basic && it.basic.type === 'Comp' &&
            (!requireProjectPath || it.basic.projectPath)) previousComps.push(it)
      })
    }
    try {
      var savedItems = JSON.parse(storage.getItem('iSparta-item') || '[]')
      collectComps(savedItems, true)
    } catch (e) { /* 忽略损坏的旧任务缓存 */ }
    // 内存状态优先于 debounce 尚未落盘的旧快照。
    collectComps(state.items)
    function compKey (basic) {
      basic = basic || {}
      return String(basic.projectPath || '') + '|' + String(basic.folderPath || '') + ':' + String(basic.compName || '')
    }
    function compIndexKey (basic) {
      basic = basic || {}
      return String(basic.projectPath || '') + '|' + Number(basic.compIndex)
    }
    var previousByKey = {}
    var previousByIndex = {}
    _.each(previousComps, function (it) {
      previousByKey[compKey(it.basic)] = it
      previousByIndex[compIndexKey(it.basic)] = it
    })
    var remain = _.filter(state.items, function (it) {
      return !(it && it.basic && it.basic.type === 'Comp')
    })
    _.each(gen, function (g) {
      var itemData = _.cloneDeep(_.extend({}, tempState, { basic: g.basic, options: g.options }))
      var previous = previousByKey[compKey(g.basic)] || previousByIndex[compIndexKey(g.basic)]
      if (previous && previous.options) {
        // 新的 basic/process 来自 AE 当前状态；用户配置的单项输出选项继续保留。
        itemData.options = _.extend({}, itemData.options || {}, _.cloneDeep(previous.options))
        // 合成改名时仅更新仍等于旧默认值的输出名，保留用户自定义名称。
        if (previous.basic.compName !== g.basic.compName &&
            previous.options.outputName === buildInitialOutputName(previous.basic.compName, previous.options)) {
          itemData.options.outputName = buildInitialOutputName(g.basic.compName, itemData.options)
        }
        itemData.basic.outputPath = resolveOutputPath(itemData, itemData.options)
      }
      if (previous && previous.process) {
        var sameRenderSpec = Number(previous.basic.frameCount) === Number(g.basic.frameCount) &&
          Number(previous.basic.compFps) === Number(g.basic.compFps) &&
          Number(previous.basic.compWidth) === Number(g.basic.compWidth) &&
          Number(previous.basic.compHeight) === Number(g.basic.compHeight)
        if (sameRenderSpec) itemData.process = _.cloneDeep(previous.process)
      }
      var key = Number(g.basic.compIndex) + ':' + String(g.basic.compName || '')
      itemData.isSelected = !!selectedSet[key]
      if (!itemData.process) { itemData.process = { text: '', schedule: 0 } }
      remain.push(itemData)
    })
    state.items = remain
    persistItems()
  },
  /**
   * 切换视图时清掉「上一轮失败/中止」的残留（只在视图切换调用，不参与定时刷新）：
   * - 产物已存在：说明上次其实已经写出文件（或用户重跑成功），改判完成，状态列直接显示产物大小
   * - 仍无产物：清空上一轮的原因与文案，回到待处理，等下一次真正运行再记录
   * 运行中的任务（0 < schedule < 1）一律不动。
   */
  refreshFailedCompTasks(context) {
    if (context.rootState.locked) { return }
    _.each(state.items, function (it) {
      if (!it || !it.basic || it.basic.type !== 'Comp') { return }
      var p = it.process
      if (!p || p.schedule !== -1) { return }
      var files = existingOutputFilesOf(it)
      p.schedule = files.length ? 1 : 0
      p.text = ''
      p.detail = ''
    })
    persistItems()
  },
  /** 合成树勾选：只改 Comp 任务的 isSelected（index:name 复合键） */
  syncCompSelected(context, selectedCompKeys) {    if (context.rootState.locked) { return }
    var set = {}
    _.each(selectedCompKeys || [], function (k) {
      if (k && typeof k === 'object') {
        set[Number(k.index) + ':' + String(k.name || '')] = true
        return
      }
      var s = String(k)
      if (s) { set[s] = true }
    })
    _.each(context.rootState.items, function (item) {
      if (!item.basic || item.basic.type !== 'Comp') { return }
      var key = Number(item.basic.compIndex) + ':' + String(item.basic.compName || '')
      item.isSelected = !!set[key]
    })
    persistItems()
  },
  editProcess(context, keyValue) {
    context.commit('ITEMS_EDIT_PROCESS', keyValue)
  },
  // 落盘保底改名（cool → cool_1）写回任务条，供输出名实时显示实际产物名
  applyNameOverride(context, payload) {
    context.commit('ITEMS_APPLY_NAME_OVERRIDE', payload)
  },
  // 跨任务同名「另存」的一次性改名（本次转换有效，下次预检入口清除）
  applyTransientName(context, payload) {
    context.commit('ITEMS_APPLY_TRANSIENT_NAME', payload)
  },
  clearTransientNames(context) {
    context.commit('ITEMS_CLEAR_TRANSIENT_NAMES')
  },
  setSourceOverwrite(context, payload) {
    context.commit('ITEMS_SET_SOURCE_OVERWRITE', payload)
  },
  setSelected(context, index) {
    context.commit('SET_SELECTED', index)
  },
  singleSelect(context, index) {
    context.commit('SINGLE_SELECT', index)
  },
  /** 设置按钮：只选中该项（与 singleSelect 同义，语义更明确） */
  selectOnlyAt(context, index) {
    context.commit('SINGLE_SELECT', index)
  },
  multiSelect(context, index) {
    context.commit('MULTI_SELECT', index)
  },
  allSelect(context) {
    context.commit('ALL_SELECTED')
  },
  /** 框选：按索引集合覆盖选中态 */
  setMultiSelected(context, indexes) {
    context.commit('ITEMS_SET_SELECTED', indexes)
  },
  noneSelect(context) {
    context.commit('NONE_SELECTED')
  },
  setLock(context, boolean) {
    context.commit('SET_LOCK', boolean)
  }
}

// 处理一些分发的事件
const getters = {
  // 获取items
  getterItems() {
    return state.items
  },
  // 获取锁的状态
  getterLocked() {
    return state.locked
  },
  // 获取选中的items
  getterSelected() {
    return _.filter(state.items, { isSelected: true })
  },
  // 获取选中items的index
  getterSelectedIndex() {
    return _.findIndex(state.items, { isSelected: true })
  }
}

// A Vuex instance is created by combining the state, mutations, actions,
// and getters.
const store = new Vuex.Store({
  state,
  getters,
  actions,
  mutations,
  modules
})

/* ---------- 全局运行日志：在 store 层集中捕获任务状态跃迁 ----------
 * 不在各处理器里埋点：转换链路有 5 条入口（PNGs / GIF / APNG / WEBP 各自再导出多格式，
 * 外加阈值重压循环），逐个埋点必漏；而 schedule 的跃迁只会发生在这里。
 * 深监听会随进度更新频繁触发，因此先比对上一次的 schedule，只在真正跃迁时写日志。
 */
const lastSchedule = new Map()

function logItemKey (it) {
  var b = it && it.basic
  if (b && b.inputPath) { return b.inputPath + '|' + (b.type || '') }
  // 没有稳定标识的条目不参与跃迁判定，避免把不同任务误判成同一个
  return ''
}

store.watch(
  function () { return store.state.items },
  function (items) {
    var alive = new Set()
    items.forEach(function (it) {
      var k = logItemKey(it)
      if (!k) { return }
      alive.add(k)
      var s = (it.process && typeof it.process.schedule === 'number') ? it.process.schedule : 0
      var prev = lastSchedule.get(k)
      if (prev === s) { return }
      // 25% 档节流：进度轮询会频繁改 schedule，避免「转换中」刷屏
      var bucket = (s > 0 && s < 1) ? Math.floor(s * 4) : s
      var prevBucket = (prev > 0 && prev < 1) ? Math.floor(prev * 4) : prev
      if (prev !== undefined && bucket === prevBucket && s !== 1 && s !== -1) {
        lastSchedule.set(k, s)
        return
      }
      lastSchedule.set(k, s)
      var name = (it.options && it.options.outputName) ||
        (it.basic && it.basic.fileList && it.basic.fileList[0]) || ''
      if (s > 0 && s < 1) {
        appLog.info(i18n.t('logConverting'), name)
      } else if (s === 1) {
        appLog.success(i18n.t('logDone'), (it.basic && it.basic.outputPath) || name)
      } else if (s === -1) {
        appLog.error(i18n.t('logFailed'), (it.process && it.process.text) || name)
      }
    })
    // 已删除的任务清掉记录，否则长会话里 Map 只增不减
    lastSchedule.forEach(function (v, k) {
      if (!alive.has(k)) { lastSchedule.delete(k) }
    })
  },
  { deep: true }
)

/* ---------- dev-only：给纯浏览器 mock 预览挂一个 store 入口 ----------
 * mock-bridge 的 __ispartaMockComplete() 需要改任务状态来演示完成态卡片
 * （产物大小 / 格式角标 / 复制 toast）。NODE_ENV 判断在构建期折叠，
 * 生产载荷不暴露该全局。
 */
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  window.__ispartaStore = store
}

export default store
