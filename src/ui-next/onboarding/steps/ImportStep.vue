<template>
  <section class="ob-pane">
    <h2 class="ob-h2">{{ $t('obImportTitle') }}</h2>
    <p class="ob-sub">{{ $t('obImportSub') }}</p>

    <!-- 卡片只放图形；标题与说明脱离卡片，落在卡片下方 -->
    <ul class="ob-ways">
      <li v-for="w in ways" :key="w.kind" class="ob-way">
        <div class="ob-way__art">
          <import-art :kind="w.kind" />
        </div>
        <p class="ob-way__t">{{ w.title }}</p>
        <p class="ob-way__d">{{ w.text }}</p>
      </li>
    </ul>
  </section>
</template>

<script>
/**
 * 首启 · 导入方式
 * 三种方式对应不同场景，**桌面端与 AE 扩展都支持**，因此这里不再按 hostAdapter 分端。
 */
import ImportArt from '../demos/ImportArt.vue'

export default {
  name: 'ImportStep',
  components: { ImportArt },
  computed: {
    ways () {
      return [
        { kind: 'file', title: this.$t('obImportDrag'), text: this.$t('obImportDragTip') },
        { kind: 'paste', title: this.$t('obImportPaste'), text: this.$t('obImportPasteTip') },
        { kind: 'comp', title: this.$t('obImportComp'), text: this.$t('obImportCompTip') }
      ]
    }
  }
}
</script>

<style scoped>
.ob-ways {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--is-s-3);
}

.ob-way {
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform var(--is-dur-base) var(--is-ease-out);
}

/* 整张卡（图形 + 标题 + 说明）一起抬，图形框同时提亮 —— 不做局部动画 */
.ob-way:hover { transform: translateY(-2px); }

.ob-way__art {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 112px;
  padding: var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-inset);
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    background-color var(--is-dur-fast) var(--is-ease-std);
}

.ob-way:hover .ob-way__art {
  border-color: var(--is-border-hi);
  background: var(--is-elevated);
}

.ob-way__t {
  margin: var(--is-s-3) 0 0;
  font-size: var(--is-fs-md);
  font-weight: var(--is-fw-semi);
  color: var(--is-text);
}

.ob-way__d {
  margin: var(--is-s-1) 0 0;
  font-size: var(--is-fs-sm);
  line-height: 1.55;
  color: var(--is-text-2);
  text-align: center;
}

@media (max-width: 480px) {
  .ob-ways { grid-template-columns: 1fr; }

  .ob-way__art { min-height: 88px; }
}

@media (prefers-reduced-motion: reduce) {
  .ob-way { transition: none; }

  .ob-way:hover { transform: none; }
}
</style>
