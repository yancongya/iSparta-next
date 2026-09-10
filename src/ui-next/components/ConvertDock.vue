<template>
  <div class="is-dock">
    <div class="is-dock__formats">
      <span class="is-dock__label">输出</span>
      <button
        v-for="f in formats"
        :key="f"
        type="button"
        class="is-chip"
        :class="{ 'is-chip--on': value.indexOf(f) > -1 }"
        @click="toggle(f)"
      >{{ f }}</button>
    </div>

    <div class="is-dock__fields" v-if="showRate">
      <label class="is-field">
        <span>帧频</span>
        <input type="number" min="1" max="100" :value="fps" @change="onFps" />
      </label>
      <label class="is-field">
        <span>循环</span>
        <input type="number" min="0" :value="loop" @change="onLoop" />
      </label>
    </div>

    <div class="is-dock__spacer"></div>

    <div class="is-dock__actions">
      <button
        type="button"
        class="is-start"
        :disabled="!canStart || busy"
        @click="$emit('start')"
      >{{ busy ? '转换中…' : '开始转换' }}</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ConvertDock',
  props: {
    formats: { type: Array, default: () => ['APNG', 'GIF', 'WEBP'] },
    value: { type: Array, default: () => [] },
    fps: { type: Number, default: 25 },
    loop: { type: Number, default: 0 },
    showRate: { type: Boolean, default: true },
    canStart: { type: Boolean, default: false },
    busy: { type: Boolean, default: false }
  },
  methods: {
    toggle (f) {
      const next = this.value.slice()
      const i = next.indexOf(f)
      if (i > -1) { next.splice(i, 1) } else { next.push(f) }
      this.$emit('input', next)
      this.$emit('change', next)
    },
    onFps (e) {
      this.$emit('fps', Number(e.target.value))
    },
    onLoop (e) {
      this.$emit('loop', Number(e.target.value))
    }
  }
}
</script>

<style lang="scss" scoped>
.is-dock {
  display: flex;
  align-items: center;
  gap: var(--is-space-4);
  flex-wrap: wrap;

  &__label {
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--is-text-muted);
    margin-right: 4px;
  }

  &__formats,
  &__fields,
  &__actions {
    display: flex;
    align-items: center;
    gap: var(--is-space-2);
  }

  &__spacer {
    flex: 1 1 auto;
  }
}

.is-chip {
  appearance: none;
  border: 1px solid var(--is-border-strong);
  background: transparent;
  color: var(--is-text-secondary);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    color: var(--is-text);
    border-color: rgba(74, 108, 247, 0.5);
  }

  &--on {
    background: rgba(74, 108, 247, 0.18);
    border-color: rgba(74, 108, 247, 0.7);
    color: #dce6ff;
  }
}

.is-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--is-text-secondary);

  input {
    width: 64px;
    background: var(--is-card);
    border: 1px solid var(--is-border);
    color: var(--is-text);
    border-radius: var(--is-radius-xs);
    padding: 6px 8px;
    font-family: var(--is-mono);
    font-size: 12px;

    &:focus {
      outline: none;
      border-color: var(--is-brand);
    }
  }
}

.is-start {
  appearance: none;
  border: 0;
  background: linear-gradient(135deg, var(--is-brand), var(--is-brand-hover));
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  padding: 12px 22px;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(74, 108, 247, 0.35);

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    box-shadow: none;
  }

  &:not(:disabled):hover {
    filter: brightness(1.06);
  }
}
</style>
