/**
 * CEP 独立设置窗（OS 级浮窗，对齐 PAG 弹窗形态）
 * 复用桌面 setting.vue + store；桌面侧栏不受影响
 */
import './ensure-bridge'
import Vue from 'vue'
import AsyncComputed from 'vue-async-computed'
import 'normalize.css/normalize.css'
import '../ui-next/styles/tokens.css'
import '../ui-next/styles/ui.scss'
import UIComponents from '../ui-next/components/ui'
import TipDirective from '../ui-next/tip'
import ThemeManager from '../ui-next/theme'
import i18n, { syncLocaleFromStorage } from '../i18n'
import store from '../store'
import Setting from '../components/setting/setting.vue'

Vue.config.productionTip = false
Vue.use(AsyncComputed)
Vue.use(UIComponents)
Vue.use(TipDirective)
ThemeManager.init()
syncLocaleFromStorage()

new Vue({
  i18n,
  store,
  render (h) {
    return h('div', { staticClass: 'setwin' }, [h(Setting)])
  }
}).$mount('#app')
