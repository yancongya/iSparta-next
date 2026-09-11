/**
 * i18n 实例
 *
 * 从 main.js 抽出，使非组件代码（如 drag/file.js 里的目录深度限制）
 * 也能取到当前语言文案，而不必退回原生 alert 或硬编码中文。
 */

import Vue from 'vue'
import VueI18n from 'vue-i18n'
import { storage } from './util/node-env'

Vue.use(VueI18n)

const FALLBACK = 'zh-cn'

function detectLocale () {
  try {
    const raw = storage.getItem('globalSetting')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && parsed.language) { return parsed.language }
    }
  } catch (e) {
    console.error('storage init failed', e)
  }
  return FALLBACK
}

const i18n = new VueI18n({
  // 注意：这里不能用 detectLocale()。本模块会在 main.js 的 router 导入链上被
  // 提前求值（router → Home.vue → drag/file.js → i18n），那时 store/index.js
  // 还没执行 storage.setStoragePath()，读到的永远是空值。
  // 真正的启动语言由 main.js 在所有 import 完成后调用 syncLocaleFromStorage() 设定。
  locale: FALLBACK,
  fallbackLocale: FALLBACK,
  messages: {
    'zh-cn': require('./locales/zh-cn'),
    'zh-tw': require('./locales/zh-tw'),
    'en-us': require('./locales/en-us')
  }
})

/** 存储层就绪后调用一次：把用户保存的语言应用上 */
export function syncLocaleFromStorage () {
  const locale = detectLocale()
  if (locale && i18n.availableLocales.indexOf(locale) > -1) {
    i18n.locale = locale
  }
  return i18n.locale
}

export default i18n

/** 供非组件代码使用的翻译函数 */
export function t (key, values) {
  return i18n.t(key, values)
}

// 开发期：messages 是在模块求值时一次性构建的，新增语言包键后若只热替换组件，
// 组件模板里的 $t('新键') 会因为实例里还没有这个键而直接渲染成键名。
// 这里显式接受语言包变更，把新内容灌回实例，省掉整页刷新。
if (typeof module !== 'undefined' && module.hot) {
  module.hot.accept(
    ['./locales/zh-cn', './locales/zh-tw', './locales/en-us'],
    () => {
      i18n.setLocaleMessage('zh-cn', require('./locales/zh-cn'))
      i18n.setLocaleMessage('zh-tw', require('./locales/zh-tw'))
      i18n.setLocaleMessage('en-us', require('./locales/en-us'))
    }
  )
}
