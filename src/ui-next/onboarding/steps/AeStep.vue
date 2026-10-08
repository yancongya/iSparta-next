<template>
  <section class="ob-pane ob-pane--center">
    <h2 class="ob-h2">{{ $t('obAeTitle') }}</h2>
    <p class="ob-sub">{{ $t('obAeSub') }}</p>

    <div class="ob-demo"><ae-art /></div>

    <p class="ob-note">{{ $t('obAeStepDebug') }}</p>

    <div class="ob-cta">
      <is-button size="sm" icon="globe" @click="openSite">{{ $t('obAeSite') }}</is-button>
    </div>
  </section>
</template>

<script>
/**
 * 首启 · AE 扩展（条件页）：装完到用上只有「重启 → 窗口菜单」两步，
 * 所以正文一句讲完，不再拆成编号列表；只保留未签名扩展的兜底说明。
 * 官网外链走 hostAdapter.openExternal，CEP 里也能正确打开系统浏览器。
 */
import AeArt from '../demos/AeArt.vue'
import hostAdapter from '../../../util/host-env'
import { LANDING_URL } from '../../../brand'

export default {
  name: 'AeStep',
  components: { AeArt },
  methods: {
    openSite () { hostAdapter.openExternal(LANDING_URL) }
  }
}
</script>
