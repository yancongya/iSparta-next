<template>
  <section class="ob-pane ob-pane--center">
    <div class="ob-demo"><finish-demo /></div>
    <h2 class="ob-h1">{{ $t('obFinishTitle') }}</h2>
    <p class="ob-sub">{{ $t('obFinishSub') }}</p>

    <ul class="ob-cards">
      <li v-for="c in cards" :key="c.title" class="ob-card">
        <span class="ob-card__ico"><is-icon :name="c.icon" size="md" /></span>
        <span class="ob-card__title">{{ c.title }}</span>
        <span class="ob-card__text">{{ c.text }}</span>
      </li>
    </ul>

    <div class="ob-cta">
      <is-button size="sm" icon="globe" @click="openSite">{{ $t('obAeSite') }}</is-button>
    </div>
  </section>
</template>

<script>
/** 首启 · 完成导览：动图 + 能力卡片 + 官网入口。关闭动作由外壳页脚的主按钮负责。 */
import FinishDemo from '../demos/FinishDemo.vue'
import hostAdapter from '../../../util/host-env'
import { LANDING_URL } from '../../../brand'

export default {
  name: 'FinishStep',
  components: { FinishDemo },
  computed: {
    cards () {
      return [
        { icon: 'zap', title: this.$t('obFinishBatch'), text: this.$t('obFinishBatchTip') },
        { icon: 'alert', title: this.$t('obFinishLimit'), text: this.$t('obFinishLimitTip') },
        { icon: 'eye', title: this.$t('obFinishCompare'), text: this.$t('obFinishCompareTip') },
        { icon: 'moon', title: this.$t('obFinishTheme'), text: this.$t('obFinishThemeTip') }
      ]
    }
  },
  methods: {
    openSite () { hostAdapter.openExternal(LANDING_URL) }
  }
}
</script>
