import Vue from 'vue'
import Vuex from 'vuex'

import modules from './modules'

import * as types from './mutation-types'
import { fs, storage, os, path, getProcessBridge, ipc } from '../util/node-env'
import { resolveOutputPath } from '../util/outputPath'
import appLog from '../ui-next/log'
import i18n from '../i18n'
const _ = require("lodash");
// 【bug fix】修复初次使用时读取缓存错误的问题
let storagePath = "";
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

storage.setStoragePath(storagePath);
window.storage = storage;
Vue.use(Vuex)
// 原始数据
const defaultState = {
  language: 'zh-cn',
  options: {
    'frameRate': 25,
    'loop': 0,
    'outputSuffix': '',
    'outputName': '',
    'outputFormat': ['APNG'],
    'floyd': {
      checked: true,
      value: 0.35
    },
    'quality': {
      checked: false,
      value: 80
    },
    'sizeLimit': {
      enabled: false,
      maxMB: 1,
      maxBytes: 1048576,
      unit: 'MB',
      autoDelete: false,
      autoQuality: true,
      step: 5,
      maxTries: 10
    },
    'outputTo': {
      mode: 'output',
      customPath: '',
      template: ''
    }
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
    schedule: 0
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
      if (parsed.options.frameRate !== defaultState.options.frameRate) {
        parsed.options.frameRate = defaultState.options.frameRate
        changed = true
      }
      // 仅当仍为旧出厂后缀 iSpt 时迁移为空，保留用户自定义后缀
      if (parsed.options.outputSuffix === 'iSpt') {
        parsed.options.outputSuffix = ''
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
      item.isSelected = !!item.isSelected
      // 老数据里每条 item 的 options 是独立副本，同样按出厂默认补齐缺失键，
      // 否则后续 _.extend 写入的是非响应式属性，界面不会跟着更新。
      item.options = item.options || {}
      if (!item.options.outputTo) {
        item.options.outputTo = _.cloneDeep(defaultState.options.outputTo)
      }
      if (!item.options.sizeLimit) {
        item.options.sizeLimit = _.cloneDeep(defaultState.options.sizeLimit)
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
    var selectedItem = _.filter(state.items, { isSelected: true })
    if (!selectedItem.length) {
      return false
    }
    var selectedOption = selectedItem[0].options
    _.extend(selectedOption, keyValue)
    persistItems()
    // var new = _.merge(selectedOption,keyValue)
    // console.log(keyValue)
  },
  [types.ITEMS_EDIT_MULTI_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    // 共享设置只写到「当前选中」项，避免未选中的任务被误改
    _.each(state.items, function (item) {
      if (!item.isSelected) { return }
      _.extend(item.options, keyValue)
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
    _.extend(target.process, keyValue)
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
      item.options.outputTo = Object.assign({}, item.options.outputTo, nextTo)
      if (!item.basic) { item.basic = {} }
      item.basic.outputPath = resolveOutputPath(item, item.options)
    })
    context.commit('ITEMS_EDIT_MULTI_OPTIONS', { outputTo: nextTo })
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
  editProcess(context, keyValue) {
    context.commit('ITEMS_EDIT_PROCESS', keyValue)
  },
  setSelected(context, index) {
    context.commit('SET_SELECTED', index)
  },
  singleSelect(context, index) {
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

export default store
