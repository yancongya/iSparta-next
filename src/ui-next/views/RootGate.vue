<template>
  <div class="root-gate">
    <!-- 工作台常驻挂载：引导浮层只是覆盖其上，关闭后 Home 的状态不丢 -->
    <home />

    <transition name="rg-fade">
      <onboarding v-if="overlay" />
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
 * ⚠ overlay 只对「没有自己的窗口可开」的一端为真：
 *   · 桌面引导是独立无边框小窗（见 onboarding/state.js），此窗口只是工作台，
 *     state.open 恒 false —— 早期版本在这里再叠一层会导致引导弹两次。
 *   · CEP 在 AE 面板内，没有窗口可开，仍靠这层浮层。
 *
 *启动进度页（BootSplash）是**独立无边框小窗 + 独立路由 `#/boot`**，
 *   由主进程在 app ready 时开、渲染层发boot:done 后关闭，不在这里分流。
 *   （它处于「storage 尚未就绪」的阶段，而本组件的 shouldAutoOpen 恰恰依赖
 *   storage就绪，故不能把启动页挂在 RootGate 下。）
 */
import Home from './Home.vue'
import Onboarding from '../onboarding/Onboarding.vue'
import { state, shouldAutoOpen, open as openOnboarding } from '../onboarding/state'
import hostAdapter from '../../util/host-env'

export default {
  name: 'RootGate',
  components: { Home, Onboarding },
  computed: {
    isStandalone () { return hostAdapter.kind === 'electron' },
    // state 是 Vue.observable 单例，引导内部的 close/finish 会直接驱动这里
    overlay () { return !this.isStandalone && state.open }
  },
  created () {
    // 挂载前判定：main.js 已完成 ThemeManager.init() / syncLocaleFromStorage()，
    // 此刻 storage 路径已绑定，读得到真实标记。
    if (shouldAutoOpen()) { openOnboarding() }
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
