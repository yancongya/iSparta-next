<template>
  <div class="own" :class="{ 'own--cep': isCep }">
    <div class="own-card">
      <div class="own-head">
        <is-icon name="sparkles" size="lg" class="own-ico" />
        <h1 class="own-title">{{ $t('obWhatsNewTitle', { ver: version }) }}</h1>
      </div>

      <p class="own-sub">{{ $t('obWhatsNewSub') }}</p>

      <ul class="own-list">
        <li v-for="(item, i) in highlights" :key="i" class="own-li">
          <is-icon name="check-circle" size="sm" class="own-li-ico" />
          <span>{{ item }}</span>
        </li>
      </ul>

      <div class="own-cta">
        <is-button type="primary" size="md" @click="finish">{{ $t('obWhatsNewStart') }}</is-button>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 升级后轻量「更新说明」单屏（替代完整 7 步首启引导）。
 *
 * 触发：RootGate 判定为「升级复播」（onboarding/state.js 的 isUpgradeReplay()）且为
 * CEP 面板浮层时渲染。只说明本次更新的重点，点「开始使用」即写完成标记并关闭，
 * 避免「装完一关 loading 立刻弹长引导」的割裂感。
 *
 * ⚠ 不直接依赖 Onboarding.vue 的 ob-* 全局样式，自包含 scoped 样式，保持独立可维护。
 */
import IsIcon from '../components/ui/IsIcon.vue'
import IsButton from '../components/ui/IsButton.vue'
import hostAdapter from '../../util/host-env'
import * as onboarding from './state'
import { APP_VERSION } from '../../brand'

export default {
  name: 'OnboardingWhatsNew',
  components: { IsIcon, IsButton },
  computed: {
    isCep () { return hostAdapter.kind === 'cep' },
    version () { return APP_VERSION },
    highlights () {
      return [
        this.$t('obWhatsNewH1'),
        this.$t('obWhatsNewH2'),
        this.$t('obWhatsNewH3')
      ]
    }
  },
  methods: {
    finish () { onboarding.finish() }
  }
}
</script>

<style scoped lang="scss">
// 断点变量来自 styles/_bp.scss（$bp-compact 等）；漏 import 会让 SCSS 报 Undefined variable
@import "../styles/bp";

.own {
  position: fixed;
  inset: 0;
  z-index: calc(var(--is-z-dialog) + 100);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--is-s-6);
  background: var(--is-bg);
  color: var(--is-text);
  user-select: none;
  -webkit-user-select: none;
}

.own-card {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: var(--is-s-4);
  padding: var(--is-s-8);
  border-radius: var(--is-r-lg);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  box-shadow: var(--is-shadow-lg);
}

.own-head {
  display: flex;
  align-items: center;
  gap: var(--is-s-3);
}

.own-ico {
  color: var(--is-accent);
  flex: 0 0 auto;
}

.own-title {
  margin: 0;
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-semi);
  line-height: 1.3;
  color: var(--is-text);
}

.own-sub {
  margin: 0;
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text-2);
  text-wrap: balance;
}

.own-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--is-s-3);
}

.own-li {
  display: flex;
  align-items: flex-start;
  gap: var(--is-s-3);
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text);
}

.own-li-ico {
  color: var(--is-accent);
  flex: 0 0 auto;
  margin-top: 3px;
}

.own-cta {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--is-s-2);
}

/* 窄屏（含 CEP 面板）收紧内距，单屏放得下 */
@media (max-width: $bp-compact) {
  .own { padding: var(--is-s-3); }
  .own-card { padding: var(--is-s-5); }
  .own-title { font-size: var(--is-fs-xl); }
}

@media (prefers-reduced-motion: reduce) {
  .own-card { transition: none; }
}
</style>
