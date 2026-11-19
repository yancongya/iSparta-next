// 必须保持第一个 import：浏览器调试时要在 store 顶层求值前注入 mock 桥
// （Electron 生产运行时 preload 更早注入，此模块自动空转）
import './util/mock-bridge'
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import 'normalize.css/normalize.css'
import './ui-next/styles/tokens.css'
import './ui-next/styles/ui.scss'
import AsyncComputed from 'vue-async-computed'
import _ from 'lodash'
import i18n, { syncLocaleFromStorage } from './i18n'
import UIComponents from './ui-next/components/ui'
import TipDirective from './ui-next/tip'
import ThemeManager from './ui-next/theme'
import { fs } from './util/node-env'
import { outputFilesOf } from './util/task-output'

Vue.config.productionTip = false

/* Initialize the plugin */
Vue.use(AsyncComputed)
Vue.use(UIComponents)
// 自定义提示气泡，替代样式不可控的原生 title
Vue.directive('tip', TipDirective)

Vue.filter('basePath', function (value) {
  if (!value || typeof value !== 'string') { return '' }
  var basePath = '../' + _.compact(_.takeRight(value.split('/'), 3)).join('/')
  return basePath
})

Vue.filter('fileLink', function (value) {
  return value[0]
})

// 必须在挂载前执行：提前把主题类写到 html/body，避免首帧主题闪烁
ThemeManager.init()
// 存储路径由 store/index.js 在模块作用域设置，只有此刻才读得到用户保存的语言
syncLocaleFromStorage()

const app = new Vue({
  router,
  i18n,
  store,
  render: h => h(App),
  data: {
    // 注册一个空的 Vue 实例，作为 ‘中转站’
    eventBus: new Vue()
  }
}).$mount('#app')

if (process.env.VUE_APP_LANDING_DEMO === '1') {
  const syncDemoLanguage = language => {
    if (language === 'en-US' || language === 'zh-CN') {
      i18n.locale = language === 'en-US' ? 'en-us' : 'zh-cn'
    }
  }
  syncDemoLanguage(new URLSearchParams(window.location.search).get('lang'))
  window.addEventListener('message', event => {
    const data = event.data
    if (event.source !== window.parent || !data || data.type !== 'isparta-demo-appearance') return
    syncDemoLanguage(data.language)
    ThemeManager.set(data.theme)
  })
  router.onReady(() => app.$nextTick(() => {
    const rows = Array.from(document.querySelectorAll('.mod-list__inner > .item')).slice(0, 3)
    const start = document.querySelector('.bar-start')
    if (rows.length && start) setupDemoScroll(rows, start)
    window.parent.postMessage('isparta-demo-ready', '*')
  }))
}

function setupDemoScroll (rows, start) {
  const tasks = store.getters.getterItems.slice(0, rows.length)
  const initialSelection = store.getters.getterItems.flatMap((item, index) => item.isSelected ? [index] : [])
  const initialProcesses = tasks.map(item => ({ ...item.process }))
  const createdFiles = new Set()
  const marquee = document.createElement('div')
  marquee.className = 'mod-list__marquee'
  marquee.setAttribute('aria-hidden', 'true')
  marquee.style.position = 'fixed'
  marquee.hidden = true
  document.body.appendChild(marquee)
  let selectedCount = -1
  let phase = 0

  function onScroll (event) {
    const data = event.data
    if (event.source !== window.parent || !data || data.type !== 'isparta-demo-scroll' ||
        !Number.isFinite(data.progress) || data.progress < 0 || data.progress > 1) return
    const progress = data.progress
    const first = rows[0].getBoundingClientRect()
    const last = rows[rows.length - 1].getBoundingClientRect()
    const drag = Math.min(1, Math.max(0, (progress - 0.08) / 0.4))
    const bottom = first.top - 4 + (last.bottom - first.top + 8) * drag
    const count = rows.filter(row => row.getBoundingClientRect().top < bottom).length
    marquee.hidden = drag === 0 || drag === 1
    marquee.style.left = first.left - 4 + 'px'
    marquee.style.top = first.top - 4 + 'px'
    marquee.style.width = (first.width + 8) * drag + 'px'
    marquee.style.height = bottom - first.top + 4 + 'px'
    start.style.outline = progress >= 0.52 && progress < 0.68 ? '2px solid var(--is-accent)' : ''
    start.style.transform = progress >= 0.63 && progress < 0.68 ? 'scale(0.84)' : ''

    const nextPhase = progress >= 0.86 ? 2 : progress >= 0.65 ? 1 : 0
    if (phase === 2 && nextPhase < 2) {
      createdFiles.forEach(file => fs.remove(file))
      createdFiles.clear()
    }
    if (phase !== nextPhase) {
      tasks.forEach((item, index) => {
        const state = initialProcesses[index]
        if (nextPhase === 2) {
          outputFilesOf(item).forEach(file => {
            if (fs.existsSync(file)) return
            fs.writeFileSync(file, 'demo output\n'.repeat(256))
            createdFiles.add(file)
          })
        }
        const keys = nextPhase === 0 ? state : {
          text: i18n.t(nextPhase === 1 ? 'startConvert' : 'convertSuccess'),
          detail: '',
          schedule: nextPhase === 1 ? 0.55 : 1
        }
        // 先按示例任务索引更新，避免回滚时选中集缩小导致状态留在旧任务上。
        Object.assign(item.process, keys)
      })
      phase = nextPhase
    }
    const selection = drag === 0 ? -1 : count
    if (selection !== selectedCount) {
      selectedCount = selection
      store.dispatch('setMultiSelected', selection < 0 ? initialSelection : tasks.slice(0, count).map((_, index) => index))
    }
  }

  function takeOver (event) {
    if (!event.isTrusted) return
    if (phase === 1) tasks.forEach((item, index) => Object.assign(item.process, initialProcesses[index]))
    marquee.remove()
    start.style.outline = ''
    start.style.transform = ''
    window.removeEventListener('message', onScroll)
    window.removeEventListener('pointerdown', takeOver, true)
    window.removeEventListener('keydown', takeOver, true)
  }

  window.addEventListener('message', onScroll)
  window.addEventListener('pointerdown', takeOver, true)
  window.addEventListener('keydown', takeOver, true)
}
