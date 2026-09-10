<template>
  <div class="is-focus">
    <div class="is-focus__head">
      <div class="is-focus__meta">
        <span class="is-badge" :data-type="type">{{ type }}</span>
        <h2 class="is-focus__title">{{ title }}</h2>
        <p class="is-focus__sub">{{ subtitle }}</p>
      </div>
      <div class="is-focus__stats">
        <div class="is-stat">
          <span class="is-stat__n">{{ frameCount }}</span>
          <span class="is-stat__l">帧</span>
        </div>
        <div class="is-stat">
          <span class="is-stat__n">{{ statusText }}</span>
          <span class="is-stat__l">状态</span>
        </div>
      </div>
    </div>

    <div class="is-film" v-if="thumbs.length">
      <button
        v-for="(t, i) in thumbs"
        :key="i"
        type="button"
        class="is-film__cell"
        :class="{ 'is-film__cell--on': i === activeFrame }"
        @click="$emit('frame', i)"
      >
        <img v-if="t" :src="t" alt="" />
        <span class="is-film__idx">{{ i + 1 }}</span>
      </button>
    </div>
    <div v-else class="is-film is-film--empty">
      <span>无帧预览（非序列或缩略图加载中）</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TaskFocus',
  props: {
    type: { type: String, default: '' },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    frameCount: { type: Number, default: 0 },
    statusText: { type: String, default: '待处理' },
    thumbs: { type: Array, default: () => [] },
    activeFrame: { type: Number, default: 0 }
  }
}
</script>

<style lang="scss" scoped>
.is-focus {
  display: flex;
  flex-direction: column;
  gap: var(--is-space-5);
  min-height: 100%;

  &__head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--is-space-4);
  }

  &__title {
    margin: 8px 0 4px;
    font-size: 22px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  &__sub {
    margin: 0;
    font-size: 12px;
    color: var(--is-text-secondary);
    font-family: var(--is-mono);
    word-break: break-all;
  }

  &__stats {
    display: flex;
    gap: var(--is-space-3);
  }
}

.is-stat {
  min-width: 72px;
  padding: 10px 12px;
  border-radius: var(--is-radius-sm);
  background: var(--is-card);
  border: 1px solid var(--is-border);
  text-align: center;

  &__n {
    display: block;
    font-size: 16px;
    font-weight: 650;
    font-family: var(--is-mono);
  }

  &__l {
    font-size: 10px;
    color: var(--is-text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
}

.is-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: rgba(74, 108, 247, 0.15);
  color: var(--is-accent);
  border: 1px solid rgba(74, 108, 247, 0.35);

  &[data-type='APNG'] {
    background: rgba(40, 167, 69, 0.12);
    color: #6fdb8a;
    border-color: rgba(40, 167, 69, 0.35);
  }

  &[data-type='GIF'] {
    background: rgba(240, 173, 78, 0.12);
    color: #f5c46a;
    border-color: rgba(240, 173, 78, 0.35);
  }
}

.is-film {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: var(--is-space-2);
  scrollbar-width: thin;

  &--empty {
    justify-content: center;
    align-items: center;
    min-height: 120px;
    border: 1px dashed var(--is-border);
    border-radius: var(--is-radius);
    color: var(--is-text-muted);
    font-size: 12px;
  }

  &__cell {
    position: relative;
    flex: 0 0 auto;
    width: 96px;
    height: 96px;
    border-radius: var(--is-radius-sm);
    border: 1px solid var(--is-border);
    background: #0e0e0e;
    padding: 0;
    overflow: hidden;
    cursor: pointer;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    &--on {
      border-color: var(--is-brand);
      box-shadow: 0 0 0 1px rgba(74, 108, 247, 0.5);
    }

    &:hover {
      border-color: var(--is-border-strong);
    }
  }

  &__idx {
    position: absolute;
    left: 6px;
    bottom: 4px;
    font-size: 10px;
    font-family: var(--is-mono);
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }
}
</style>
