<template>
  <div class="quality-retry-sliders">
    <p class="quality-retry-sliders__base">{{ $t('sizeLimitQualityBase', { quality: startQuality }) }}</p>
    <label class="quality-retry-slider">
      <span class="quality-retry-slider__head">
        <span>{{ $t('sizeLimitStep') }}</span>
        <span class="quality-retry-slider__value"><button type="button" class="is-info" :aria-label="$t('sizeLimitStep')" v-tip="$t('sizeLimitStepTip')"><is-icon name="info" size="sm" /></button><b>{{ displayStep }} <small>Q</small></b></span>
      </span>
      <input
        type="range"
        min="1"
        :max="stepMax"
        :value="displayStep"
        :disabled="disabled"
        :aria-label="$t('sizeLimitStep')"
        @input="$emit('step-change', Number($event.target.value))"
      />
      <span class="quality-retry-slider__range"><span>1</span><span>{{ stepMax }}</span></span>
    </label>
    <label class="quality-retry-slider">
      <span class="quality-retry-slider__head">
        <span>{{ $t('sizeLimitTries') }}</span>
        <span class="quality-retry-slider__value"><button type="button" class="is-info" :aria-label="$t('sizeLimitTries')" v-tip="$t('sizeLimitTriesTip')"><is-icon name="info" size="sm" /></button><b>{{ tries }} <small>{{ $t('sizeLimitUnitTimes') }}</small></b></span>
      </span>
      <input
        type="range"
        min="0"
        :max="triesMax"
        :value="displayTries"
        :disabled="disabled"
        :aria-label="$t('sizeLimitTries')"
        @input="$emit('tries-change', Number($event.target.value))"
      />
      <span class="quality-retry-slider__range"><span>0</span><span>{{ triesMax }}</span></span>
    </label>
  </div>
</template>

<script>
import { maxAdjustableQualityRetries, maxAdjustableQualityStep } from '../../util/sizeLimitConfig'

export default {
  name: 'QualityRetrySliders',
  props: {
    startQuality: { type: Number, required: true },
    step: { type: Number, required: true },
    tries: { type: Number, required: true }
  },
  computed: {
    disabled () { return this.startQuality <= 1 },
    // Keep one mapped increment available at a boundary pair so the user can
    // adjust either slider; the setter remaps the paired value to a valid pair.
    stepMax () { return maxAdjustableQualityStep(this.startQuality, this.tries, this.step) },
    displayStep () { return Math.min(Number(this.step) || 1, this.stepMax) },
    triesMax () { return maxAdjustableQualityRetries(this.startQuality, this.step, this.tries) },
    displayTries () { return Math.min(Number(this.tries) || 0, this.triesMax) }
  }
}
</script>

<style lang="scss" scoped>
.quality-retry-sliders {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-3);
  width: 100%;
  min-width: 0;

  &__base {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--is-text-3);
    font-size: var(--is-fs-xs);
    line-height: 1.4;
  }
}

.quality-retry-slider {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--is-s-1);

  &__head,
  &__value,
  &__range {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--is-s-2);
    min-width: 0;
  }

  &__value { flex: none; }

  &__head {
    color: var(--is-text-2);
    font-size: var(--is-fs-sm);

    b {
      flex: none;
      color: var(--is-accent);
      font-family: var(--is-font-mono, ui-monospace, monospace);
      font-size: var(--is-fs-base);
      font-weight: var(--is-fw-semi);
    }

    small {
      font-size: var(--is-fs-xs);
      font-weight: var(--is-fw-regular);
    }
  }

  &__head > span:first-child { font-weight: var(--is-fw-medium); }

  &__range {
    color: var(--is-text-3);
    font-family: var(--is-font-mono, ui-monospace, monospace);
    font-size: var(--is-fs-xs);
  }

  input[type='range'] {
    display: block;
    width: 100%;
    min-width: 0;
    margin: var(--is-s-1) 0;
    accent-color: var(--is-accent);
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
  }

}
</style>
