import Vue from 'vue'
import Router from 'vue-router'
import UiNextHome from './ui-next/views/Home.vue'
import LandingPage from './views/LandingPage.vue'

Vue.use(Router)

// 旧版可回退：?legacy=1 或 localStorage uiMode=legacy
const forceLegacy = typeof window !== 'undefined' &&
  (window.location.search.indexOf('legacy=1') > -1 ||
    (window.storage && window.storage.getItem('uiMode') === 'legacy'))

export default new Router({
  routes: [
    {
      path: '/',
      name: forceLegacy ? 'landing-page' : 'ui-next',
      component: forceLegacy ? LandingPage : UiNextHome,
      meta: {
        title: 'iSparta-next'
      }
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
