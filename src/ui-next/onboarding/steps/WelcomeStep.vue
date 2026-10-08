<template>
  <section class="ob-pane ob-pane--center">
    <div class="ob-demo"><welcome-demo /></div>

    <p class="ob-tagline">{{ $t('obWelcomeSub') }}</p>

    <ul class="ob-mini">
      <li v-for="m in minis" :key="m.title" class="ob-mini__item">
        <span class="ob-mini__ico"><is-icon :name="m.icon" size="sm" /></span>
        <span class="ob-mini__t">{{ m.title }}</span>
        <span class="ob-mini__d">{{ m.text }}</span>
      </li>
    </ul>

    <p class="ob-note">{{ $t('obWelcomeHint') }}</p>
  </section>
</template>

<script>
/** 首启 · 欢迎：项目 logo + 字标 + 一句定位 + 三枚能力小面板。主题/语言在右上角设置里随时可改。 */
import WelcomeDemo from '../demos/WelcomeDemo.vue'

export default {
  name: 'WelcomeStep',
  components: { WelcomeDemo },
  computed: {
    minis () {
      return [
        { icon: 'globe', title: this.$t('obWelcomeLang'), text: this.$t('obWelcomeLangD') },
        { icon: 'sun', title: this.$t('obWelcomeTheme'), text: this.$t('obWelcomeThemeD') },
        { icon: 'box', title: this.$t('obWelcomeMulti'), text: this.$t('obWelcomeMultiD') }
      ]
    }
  }
}
</script>

<style scoped>
.ob-tagline {
  margin: 0;
  max-width: 34ch;
  font-size: var(--is-fs-lg);
  font-weight: var(--is-fw-semi);
  line-height: 1.5;
  color: var(--is-text-2);
}

.ob-mini {
  list-style: none;
  margin: var(--is-s-3) 0 0;
  padding: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--is-s-3);
}

.ob-mini__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--is-s-1);
  padding: var(--is-s-4) var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    background-color var(--is-dur-fast) var(--is-ease-std),
    transform var(--is-dur-base) var(--is-ease-out);
}

/* 整卡一起抬：图标+标题+说明作为一个整体动，不做局部动画 */
.ob-mini__item:hover {
  border-color: var(--is-border-hi);
  background: var(--is-elevated);
  transform: translateY(-2px);
}

.ob-mini__ico {
  display: flex;
  color: var(--is-accent);
  margin-bottom: var(--is-s-1);
}

.ob-mini__t {
  font-size: var(--is-fs-md);
  font-weight: var(--is-fw-semi);
  color: var(--is-text);
}

.ob-mini__d {
  font-size: var(--is-fs-xs);
  line-height: 1.5;
  color: var(--is-text-3);
  text-align: center;
}

@media (max-width: 480px) {
  .ob-mini { grid-template-columns: 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .ob-mini__item {
    transition: border-color var(--is-dur-fast) var(--is-ease-std),
      background-color var(--is-dur-fast) var(--is-ease-std);
  }

  .ob-mini__item:hover { transform: none; }
}
</style>
