/**
 * CEP 侧最小 Vuex store：形状对齐 src/store，供 src/util/processor/* 直接调用。
 * 不复制编码逻辑；items 的 basic/options 结构与桌面 defaultState 一致。
 */
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

const defaultItem = () => ({
  basic: {
    fileList: [],
    type: 'PNGs',
    thumbPath: '',
    inputPath: '',
    outputPath: '',
    sourceFile: ''
  },
  options: {
    frameRate: 25,
    loop: 0,
    outputSuffix: '',
    outputName: '',
    outputFormat: ['APNG'],
    floyd: { checked: true, value: 0.35 },
    quality: { checked: true, value: 80 },
    sizeLimit: {
      enabled: false,
      maxMB: 1,
      maxBytes: 1048576,
      unit: 'MB',
      autoDelete: false,
      autoQuality: true,
      step: 5,
      maxTries: 10
    },
    outputTo: { mode: 'custom', customPath: '', template: '' }
  },
  process: { text: '', schedule: 0 },
  isSelected: true
})

export function createItem (overrides) {
  const item = defaultItem()
  if (!overrides) { return item }
  Object.assign(item.basic, overrides.basic || {})
  Object.assign(item.options, overrides.options || {})
  Object.assign(item.process, overrides.process || {})
  if (overrides.isSelected !== undefined) { item.isSelected = overrides.isSelected }
  return item
}

const store = new Vuex.Store({
  state: {
    items: [],
    locked: false
  },
  getters: {
    getterItems: (s) => s.items,
    getterSelected: (s) => s.items.filter((i) => i.isSelected),
    getterLocked: (s) => s.locked
  },
  mutations: {
    SET_ITEMS (state, items) {
      state.items = items
    },
    EDIT_PROCESS (state, { index, text, schedule }) {
      const it = state.items[index]
      if (!it) { return }
      if (text !== undefined) { it.process.text = text }
      if (schedule !== undefined) { it.process.schedule = schedule }
    },
    SET_LOCK (state, v) {
      state.locked = !!v
    }
  },
  actions: {
    editProcess ({ commit }, payload) {
      commit('EDIT_PROCESS', payload)
    },
    setLock ({ commit }, v) {
      commit('SET_LOCK', v)
    },
    setItems ({ commit }, items) {
      commit('SET_ITEMS', items)
    }
  }
})

export default store
