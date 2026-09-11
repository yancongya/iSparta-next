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

new Vue({
  router,
  i18n,
  store,
  render: h => h(App),
  data: {
    // 注册一个空的 Vue 实例，作为 ‘中转站’
    eventBus: new Vue()
  }
}).$mount('#app')
