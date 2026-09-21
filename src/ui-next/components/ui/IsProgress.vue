<template>
  <div
    class="is-progress"
    :class="{ 'is-done': done, 'is-active': active }"
    role="progressbar"
    :aria-valuenow="Math.round(clamped)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div class="is-progress__track">
      <div class="is-progress__fill" :style="{ width: clamped + '%' }">
        <span v-if="active && !done" class="is-progress__shimmer" aria-hidden="true" />
      </div>
    </div>
    <span v-if="showPercent" class="is-progress__pct">{{ Math.round(clamped) }}%</span>
  </div>
</template>

<script>
export default {
  name: 'IsProgress',
  props: {
    percent: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
    showPercent: { type: Boolean, default: true },
    label: { type: String, default: '' }
  },
  computed: {
    clamped () {
      var p = Number(this.percent) || 0
      if (p < 0) return 0
      if (p > 100) return 100
      return p
    }
  }
}
</script>
