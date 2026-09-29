/**
 * CEP 面板 Vue 2 入口：挂载**完整 Home 工作台**（与桌面同一 UI）。
 * 构建：vue-cli --mode cep → targets/cep/ui/
 *
 * 禁止精简 CepApp 作终态：CepApp 仅保留为可选 demo，不在此挂载。
 * AE 特殊化只经 host-env / sourceAdapter 注入，不另维护平行面板。
 */
import './ensure-bridge'
import '../util/mock-bridge'
import Vue from 'vue'
import AsyncComputed from 'vue-async-computed'
import _ from 'lodash'
import 'normalize.css/normalize.css'
import '../ui-next/styles/tokens.css'
import '../ui-next/styles/ui.scss'
import UIComponents from '../ui-next/components/ui'
import TipDirective from '../ui-next/tip'
import ThemeManager from '../ui-next/theme'
import i18n, { syncLocaleFromStorage } from '../i18n'
import store from '../store'
import Home from '../ui-next/views/Home.vue'
import './comp-source'

Vue.config.productionTip = false

Vue.use(AsyncComputed)
Vue.use(UIComponents)
Vue.directive('tip', TipDirective)

// 与桌面 main.js 相同的展示过滤器（projectList / setting 依赖）
Vue.filter('basePath', function (value) {
  if (!value || typeof value !== 'string') { return '' }
  return '../' + _.compact(_.takeRight(value.split('/'), 3)).join('/')
})

Vue.filter('fileLink', function (value) {
  return value[0]
})

// 必须在挂载前：主题类写到 html/body，避免首帧闪烁
ThemeManager.init()
// CEP 小屏铺满：与主题类同挂 html/body，避免首帧布局闪烁（卸载不必须）
if (document.documentElement) document.documentElement.classList.add('is-cep')
if (document.body) document.body.classList.add('is-cep')
// store/index.js 模块作用域已绑定 storage 路径，此刻才读得到用户语言
syncLocaleFromStorage()

new Vue({
  i18n,
  store,
  render: (h) => h(Home),
  data: {
    // 与桌面一致：$root.eventBus 中转 openGlobalSetting 等
    eventBus: new Vue()
  }
}).$mount('#app')

// CEP + webpack HMR：仅在「发生更新并被 accept」后整页刷新一次。
// 禁止用 status==='ready' 触发 reload——那会在每次进页时循环刷新。
if (module.hot) {
  var _hotReloaded = false
  module.hot.accept(function () {
    if (_hotReloaded) { return }
    _hotReloaded = true
    window.location.reload()
  })
}
