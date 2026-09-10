<template>
  <div
    class="is-dropzone"
    :class="{ 'is-dropzone--active': dragging }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
    @click="onPick"
  >
    <div class="is-dropzone__frame" aria-hidden="true"></div>
    <div class="is-dropzone__body">
      <div class="is-dropzone__icon">⬇</div>
      <h2 class="is-dropzone__title">{{ title }}</h2>
      <p class="is-dropzone__hint">{{ hint }}</p>
      <button type="button" class="is-dropzone__btn" @click.stop="onPick">{{ pickLabel }}</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IsDropZone',
  props: {
    title: { type: String, default: '拖入 PNG 序列 / APNG / GIF' },
    hint: { type: String, default: '或点击选择文件夹、多选文件' },
    pickLabel: { type: String, default: '打开目录…' }
  },
  data () {
    return { dragging: false }
  },
  methods: {
    onDragOver () {
      this.dragging = true
    },
    onDragLeave () {
      this.dragging = false
    },
    onDrop (ev) {
      this.dragging = false
      this.$emit('drop', ev)
    },
    onPick () {
      this.$emit('pick')
    }
  }
}
</script>

<style lang="scss" scoped>
.is-dropzone {
  position: relative;
  min-height: 280px;
  border-radius: var(--is-radius);
  background:
    radial-gradient(1200px 400px at 20% 0%, rgba(74, 108, 247, 0.18), transparent 55%),
    linear-gradient(180deg, var(--is-card), var(--is-panel));
  border: 1px dashed var(--is-border-strong);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease, transform 0.2s ease, background 0.2s ease;
  overflow: hidden;

  &:hover {
    border-color: rgba(74, 108, 247, 0.55);
  }

  &--active {
    border-color: var(--is-brand);
    transform: scale(1.01);
    background:
      radial-gradient(900px 360px at 50% 0%, rgba(74, 108, 247, 0.28), transparent 60%),
      var(--is-card);
  }

  &__frame {
    position: absolute;
    inset: 10px;
    border: 1px solid rgba(255, 255, 255, 0.04);
    border-radius: calc(var(--is-radius) - 4px);
    pointer-events: none;
  }

  &__body {
    text-align: center;
    padding: var(--is-space-8);
    position: relative;
    z-index: 1;
  }

  &__icon {
    width: 56px;
    height: 56px;
    margin: 0 auto var(--is-space-4);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    background: rgba(74, 108, 247, 0.15);
    color: var(--is-accent);
    border: 1px solid rgba(74, 108, 247, 0.35);
  }

  &__title {
    margin: 0 0 var(--is-space-2);
    font-size: 18px;
    font-weight: 600;
    color: var(--is-text);
    letter-spacing: 0.02em;
  }

  &__hint {
    margin: 0 0 var(--is-space-5);
    font-size: 13px;
    color: var(--is-text-secondary);
  }

  &__btn {
    appearance: none;
    border: 1px solid transparent;
    background: var(--is-brand);
    color: #fff;
    border-radius: var(--is-radius-sm);
    padding: 10px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;

    &:hover {
      background: var(--is-brand-hover);
    }
  }
}
</style>
