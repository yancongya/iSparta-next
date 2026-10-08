<template>
  <div class="root-gate">
    <!-- 工作台常驻挂载：引导浮层只是覆盖其上，关闭后 Home 的状态不丢 -->
    <home />

    <transition name="rg-fade">
      <onboarding v-if="open" />
    </transition>
  </div>
</template>

<script>
/**
 * 根网关：决定「显示工作台」还是「显示首启引导」。
 *
 * 为什么不挂路由：CEP 侧没有 vue-router（src/cep/main.js 直接 render Home），
 * 用网关可以让两端共用同一套引导组件，接线各改一行。
 *
 *   桌面：src/router.js 的 `/` 路由 component → RootGate
 *   CEP ：src/cep/main.js 的 render → RootGate
 *
 * 后续 W3 的启动进度页（BootSplash）也在这里分流，不新增入口。
 */
import Home from './Home.vue'
import Onboarding from '../onboarding/Onboarding.vue'
import { state, shouldAutoOpen } from '../onboarding/state'

export default {
  name: 'RootGate',
  components: { Home, Onboarding },
  computed: {
    // state 是 Vue.observable 单例，引导内部的 close/finish 会直接驱动这里
    open () { return state.open }
  },
  created () {
    // 挂载前判定：main.js 已完成 ThemeManager.init() / syncLocaleFromStorage()，
    // 此刻 storage 路径已绑定，读得到真实标记。
    if (shouldAutoOpen()) { state.open = true }
  }
}
</script>

<style>
.root-gate {
  height: 100%;
}

/* 引导浮层整体淡入 / 淡出 */
.rg-fade-enter-active,
.rg-fade-leave-active {
  transition: opacity var(--is-dur-base) var(--is-ease-std);
}

.rg-fade-enter,
.rg-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rg-fade-enter-active,
  .rg-fade-leave-active {
    transition: none;
  }
}
</style>
