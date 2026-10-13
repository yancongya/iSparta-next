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

<style scoped lang="scss">
// 断点统一取 styles/_bp.scss
@import "../../styles/bp";

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
  min-width: 0;
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
  /* 面板拉宽后三列各 ~270px，长文案（英文）仍会折行；这里按词换行而非撑破网格 */
  overflow-wrap: anywhere;
}

/* 窄屏降档（含 CEP 面板）：**不再把三枚能力卡改成单列**。
   单列会让这一屏凭空长高约 200px（卡片从 1 行变 3 行），正是「引导内容偏高、
   得上下滚动」的主因。这里改成三列紧凑版：卡片内距收紧、字号降一档，
   实测 429×411 面板下该块由 312px 降到 96px。 */
@media (max-width: $bp-compact) {
  .ob-tagline { font-size: var(--is-fs-md); max-width: none; }

  .ob-mini {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--is-s-2);
    margin-top: var(--is-s-2);
  }

  .ob-mini__item { padding: var(--is-s-3) var(--is-s-2); }

  .ob-mini__ico { margin-bottom: 0; }

  .ob-mini__t { font-size: var(--is-fs-sm); }

  .ob-mini__d { font-size: var(--is-fs-xs); line-height: 1.35; }
}

@media (prefers-reduced-motion: reduce) {
  .ob-mini__item {
    transition: border-color var(--is-dur-fast) var(--is-ease-std),
      background-color var(--is-dur-fast) var(--is-ease-std);
  }

  .ob-mini__item:hover { transform: none; }
}
</style>
