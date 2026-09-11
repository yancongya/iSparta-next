import Vue from 'vue'
import Vuex from 'vuex'

import modules from './modules'

import * as types from './mutation-types'
import { fs, storage, os, path, getProcessBridge } from '../util/node-env'
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
    var selectedItem = _.filter(state.items, { isSelected: true })
    var selectedBasic = selectedItem[0].basic
    _.extend(selectedBasic, keyValue)
    persistItems()
  },
  [types.ITEMS_EDIT_OPTIONS](state, keyValue) {
    if (state.locked) {
      return false
    }
    var selectedItem = _.filter(state.items, { isSelected: true })
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
    _.each(state.items, function (item) {
      _.extend(item.options, keyValue)
    })
    persistItems()
  },
  [types.ITEMS_EDIT_PROCESS](state, keyValue) {
    var selectedItem = _.filter(state.items, { isSelected: true })
    // console.warn(keyValue)
    var selectedProcess = selectedItem[keyValue.index].process
    _.extend(selectedProcess, keyValue)

    // 进度不记录在localstore里
    // storage.setItem("iSparta-item",JSON.stringify(state.items));
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
    if (state.locked) {
      return false
    }
    state.items[index].isSelected = true
    persistItems()
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
export default new Vuex.Store({
  state,
  getters,
  actions,
  mutations,
  modules
})
