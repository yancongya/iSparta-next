import Vue from 'vue'
import Router from 'vue-router'
// 根路由挂网关而非 Home：网关内部分流「工作台 / 首启引导」（见 docs/PLAN-GUIDE-PAGES.md §5.1）
import RootGate from './ui-next/views/RootGate.vue'
// 启动进度窗是**独立无边框小窗**的独立入口，不挂在 RootGate 里：
// 主进程用 boot 窗加载 app://./index.html#/boot，与工作台 / 引导窗互不干扰。
import BootSplash from './ui-next/views/BootSplash.vue'
import { APP_NAME } from './brand'

Vue.use(Router)

// 旧版 LandingPage 依赖 element-ui，已随自绘迁移一并下线。
// 顺带说明：原先的 ?legacy=1 回退其实一直是失效的——router.js 在 main.js 中
// 先于 store/index.js 求值，那时 window.storage 还没注入，forceLegacy 恒为 false。
// 需要回溯时从 git 历史恢复即可，不再保留这条会腐烂的旁路。
export default new Router({
  routes: [
    {
      path: '/boot',
      name: 'boot',
      component: BootSplash,
      meta: {
        title: APP_NAME
      }
    },
    {
      path: '/',
      name: 'ui-next',
      component: RootGate,
      meta: {
        title: APP_NAME
      }
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
})
