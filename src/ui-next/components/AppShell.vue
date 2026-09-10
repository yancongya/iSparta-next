<template>
  <div class="is-shell">
    <header class="is-topbar">
      <div class="is-topbar__brand">
        <span class="is-topbar__mark"></span>
        <span class="is-topbar__name">iSparta-next</span>
        <span class="is-topbar__tag">ui-next</span>
      </div>
      <div class="is-topbar__actions">
        <slot name="top-actions"></slot>
      </div>
    </header>

    <div class="is-main">
      <section class="is-main__queue">
        <slot name="queue"></slot>
      </section>
      <aside class="is-main__side">
        <slot name="side"></slot>
      </aside>
    </div>

    <footer class="is-bottombar">
      <slot name="bottom"></slot>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'IsShell'
}
</script>

<style lang="scss" scoped>
.is-shell {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--is-bg);
  color: var(--is-text);
  font-family: var(--is-font);
  overflow: hidden;
}

.is-topbar {
  height: var(--is-topbar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--is-space-4);
  border-bottom: 1px solid var(--is-border);
  background: linear-gradient(180deg, #1a1a1a, #151515);

  &__brand {
    display: flex;
    align-items: center;
    gap: var(--is-space-2);
  }

  &__mark {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: linear-gradient(135deg, var(--is-brand), var(--is-accent));
    box-shadow: 0 0 12px rgba(74, 108, 247, 0.55);
  }

  &__name {
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.04em;
  }

  &__tag {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 999px;
    border: 1px solid var(--is-border-strong);
    color: var(--is-text-muted);
    font-family: var(--is-mono);
  }
}

.is-main {
  flex: 1 1 auto;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr var(--is-sidebar-w);

  &__queue {
    min-width: 0;
    overflow: auto;
    padding: var(--is-space-4);
    border-right: 1px solid var(--is-border);
  }

  &__side {
    overflow: auto;
    background: var(--is-panel);
    padding: var(--is-space-4);
  }
}

.is-bottombar {
  height: var(--is-bottombar-h);
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--is-space-4);
  border-top: 1px solid var(--is-border);
  background: #161616;
  font-size: 12px;
  color: var(--is-text-secondary);
}
</style>
