<template>
  <div class="is-app" :class="{ 'is-app--empty': !hasTasks, 'is-app--busy': busy }">
    <!-- 空态：全屏导入舞台 -->
    <section v-if="!hasTasks" class="is-stage is-stage--import">
      <div class="is-stage__chrome">
        <span class="is-mark"></span>
        <span class="is-brand">iSparta-next</span>
        <span class="is-ver">redesign</span>
      </div>
      <slot name="import"></slot>
      <p class="is-stage__foot">序列帧 · APNG · GIF → 动图工具台</p>
    </section>

    <!-- 有任务：工作台（不再是左右分栏） -->
    <section v-else class="is-work">
      <header class="is-work__rail">
        <div class="is-work__brand">
          <span class="is-mark"></span>
          <span class="is-brand">iSparta-next</span>
        </div>
        <div class="is-tabs">
          <button
            v-for="(tab, i) in tabs"
            :key="i"
            type="button"
            class="is-tab"
            :class="{ 'is-tab--on': tab.active }"
            :title="tab.title"
            @click="$emit('select', tab.index)"
          >
            <span class="is-tab__dot" :data-type="tab.type"></span>
            <span class="is-tab__label">{{ tab.label }}</span>
          </button>
        </div>
        <div class="is-work__rail-actions">
          <slot name="rail-actions"></slot>
        </div>
      </header>

      <main class="is-work__stage">
        <slot name="stage"></slot>
      </main>

      <div class="is-work__dock">
        <slot name="dock"></slot>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'IsWorkbench',
  props: {
    hasTasks: { type: Boolean, default: false },
    busy: { type: Boolean, default: false },
    tabs: { type: Array, default: () => [] }
  }
}
</script>

<style lang="scss" scoped>
.is-app {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1400px 600px at 80% -10%, rgba(74, 108, 247, 0.12), transparent 50%),
    radial-gradient(900px 400px at 0% 100%, rgba(124, 155, 255, 0.06), transparent 45%),
    var(--is-bg);
  color: var(--is-text);
  font-family: var(--is-font);
  overflow: hidden;
}

.is-mark {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: linear-gradient(135deg, var(--is-brand), var(--is-accent));
  box-shadow: 0 0 10px rgba(74, 108, 247, 0.6);
}

.is-brand {
  font-size: 12px;
  font-weight: 650;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.is-ver {
  font-size: 10px;
  font-family: var(--is-mono);
  color: var(--is-text-muted);
  border: 1px solid var(--is-border);
  padding: 1px 6px;
  border-radius: 999px;
}

/* ---------- 导入舞台 ---------- */
.is-stage {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--is-space-5);
  padding: var(--is-space-6);
  position: relative;

  &__chrome {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 52px;
    display: flex;
    align-items: center;
    gap: var(--is-space-2);
    padding: 0 var(--is-space-5);
  }

  &__foot {
    margin: 0;
    font-size: 11px;
    color: var(--is-text-muted);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-family: var(--is-mono);
  }
}

/* ---------- 工作台 ---------- */
.is-work {
  height: 100%;
  display: grid;
  grid-template-rows: 56px 1fr auto;

  &__rail {
    display: flex;
    align-items: center;
    gap: var(--is-space-4);
    padding: 0 var(--is-space-4);
    border-bottom: 1px solid var(--is-border);
    background: rgba(0, 0, 0, 0.25);
    backdrop-filter: blur(8px);
  }

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--is-space-2);
    flex: 0 0 auto;
  }

  &__rail-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--is-space-2);
  }

  &__stage {
    min-height: 0;
    overflow: auto;
    padding: var(--is-space-5) var(--is-space-5) var(--is-space-4);
  }

  &__dock {
    border-top: 1px solid var(--is-border);
    background: linear-gradient(180deg, rgba(30, 30, 30, 0.9), rgba(22, 22, 22, 0.98));
    padding: var(--is-space-3) var(--is-space-4);
  }
}

.is-tabs {
  display: flex;
  align-items: center;
  gap: var(--is-space-2);
  overflow-x: auto;
  min-width: 0;
  flex: 1 1 auto;
  scrollbar-width: thin;
}

.is-tab {
  appearance: none;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text-secondary);
  border-radius: 999px;
  padding: 6px 12px 6px 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;

  &:hover {
    border-color: var(--is-border-strong);
    color: var(--is-text);
  }

  &--on {
    border-color: rgba(74, 108, 247, 0.65);
    background: rgba(74, 108, 247, 0.16);
    color: var(--is-text);
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--is-brand);

    &[data-type='APNG'] { background: #28a745; }
    &[data-type='GIF'] { background: #f0ad4e; }
    &[data-type='PNGs'] { background: var(--is-brand); }
  }

  &__label {
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
</style>
