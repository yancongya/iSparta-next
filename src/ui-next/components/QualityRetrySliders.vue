<template>
  <div class="quality-retry-sliders">
    <p class="quality-retry-sliders__base">{{ $t('sizeLimitQualityBase', { quality: startQuality }) }}</p>
    <div class="quality-retry-sliders__row">
      <span class="quality-retry-sliders__label">{{ $t('sizeLimitTries') }}</span>
      <is-input
        class="quality-retry-sliders__input"
        type="number"
        :value="draft !== null ? draft : displayTries"
        :min="0"
        :max="triesMax"
        :step="1"
        :disabled="disabled"
        :aria-label="$t('sizeLimitTries')"
        @input="onDraftInput"
        @blur="commitDraft"
        @keyup.enter="commitDraft"
      />
      <span class="quality-retry-sliders__unit">{{ $t('sizeLimitUnitTimes') }}</span>
      <span class="quality-retry-sliders__range">0–{{ triesMax }}</span>
      <button type="button" class="is-info" :aria-label="$t('sizeLimitTries')" v-tip="$t('sizeLimitTriesTip')">
        <is-icon name="info" size="sm" />
      </button>
    </div>
  </div>
</template>

<script>
import { automaticRetryCount } from '../../util/sizeLimitConfig'

/**
 * 文件名沿用早期「范围滑块」时期的命名，现已改为纯整数输入框；
 * 为避免牵连右侧输出设置与默认设置两处引用，不重命名文件。
 * 数值范围始终由 sizeLimitConfig 的基准质量推导，不在组件内另写一套。
 */
export default {
  name: 'QualityRetrySliders',
  props: {
    startQuality: { type: Number, required: true },
    tries: { type: Number, required: true }
  },
  data () {
    return { draft: null }
  },
  watch: {
    // 压缩质量一变，允许范围与显示值都要重算，旧草稿不能留到下次失焦提交
    startQuality () { this.draft = null }
  },
  computed: {
    disabled () { return this.startQuality <= 1 },
    // 上限沿用原有逻辑：可降质的档位数 = 基准质量 - 1，最多 50。
    // 基准由 effectiveQualityStart 给出（启用压缩取压缩质量，未启用取 100）。
    triesMax () { return Math.min(50, Math.max(0, this.startQuality - 1)) },
    // 质量变化后旧次数可能越界，同一函数负责收敛到合法显示值
    displayTries () { return automaticRetryCount(this.startQuality, this.tries) }
  },
  methods: {
    // 与大小阈值输入框同款草稿输入：允许清空/半成品，失焦或回车才提交
    onDraftInput (raw) {
      this.draft = String(raw == null ? '' : raw)
    },
    commitDraft () {
      const raw = this.draft
      this.draft = null
      if (raw === null) return
      const n = Number(String(raw).trim())
      if (!isFinite(n)) return
      // 纯整数 + 0…triesMax 的钳制全部交给已有的 automaticRetryCount，不另写一套范围判定
      const next = automaticRetryCount(this.startQuality, Math.round(n))
      if (next !== this.displayTries) this.$emit('tries-change', next)
    }
  }
}
</script>

<style lang="scss" scoped>
.quality-retry-sliders {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-2);
  width: 100%;
  min-width: 0;

  &__base {
    margin: 0;
    color: var(--is-text-3);
    font-size: var(--is-fs-xs);
    line-height: 1.4;
  }

  &__row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--is-s-2);
    min-width: 0;
  }

  &__label {
    color: var(--is-text-2);
    font-size: var(--is-fs-sm);
    font-weight: var(--is-fw-medium);
    white-space: nowrap;
  }

  // 纯整数输入框：定宽，避免被全局 .is-input 的 100% 宽拉成通栏
  &__input {
    width: 72px;
    flex: none;
  }

  &__unit,
  &__range {
    white-space: nowrap;
    font-size: var(--is-fs-xs);
    color: var(--is-text-3);
  }

  // 范围上限来自压缩质量基准，随设置实时变化
  &__range {
    font-family: var(--is-font-mono, ui-monospace, monospace);
  }
}
</style>
