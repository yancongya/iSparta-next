<template>
  <span
    ref="root"
    class="is-select"
    :class="{ 'is-focus': open, 'is-disabled': disabled }"
  >
    <button
      type="button"
      class="is-select__trigger"
      :disabled="disabled"
      :aria-label="ariaLabel"
      aria-haspopup="listbox"
      :aria-expanded="open ? 'true' : 'false'"
      @click="toggle"
      @keydown="onKey"
    >
      <span class="is-select__text">{{ currentLabel }}</span>
      <span class="is-select__caret" aria-hidden="true"></span>
    </button>
    <div
      v-if="open"
      ref="pop"
      class="is-select__pop"
      :class="{ 'is-select__pop--up': popUp }"
      :style="popStyle"
      role="listbox"
      @mousedown.stop
    >
      <div
        v-for="(o, i) in options"
        :key="String(o.value)"
        class="is-select__opt"
        :class="{ 'is-active': sameValue(o.value), 'is-cursor': i === cursor }"
        role="option"
        :aria-selected="sameValue(o.value) ? 'true' : 'false'"
        @click="choose(o)"
        @mouseenter="cursor = i"
      >{{ o.label }}</div>
    </div>
  </span>
</template>

<script>
/**
 * 自绘下拉选择：主题化触发盒（对齐 is-input 的边框/圆角/聚焦态）+ 浮层列表，
 * 视觉上可与 is-input 定宽类（.num / .w-80）无缝互换——用于「同一槽位随模式
 * 在数值输入与档位下拉之间原位切换」的场景（压缩质量 ↔ 色数）。
 *
 * 交互：点击开合；浮层点击外关闭；↑/↓ 移动游标、Home/End 跳端、Enter/Space 选中、
 * Esc 关闭（stopPropagation 不连带关掉外层弹窗）；空间不足时向上弹出。
 * v-model 约定对齐 IsInput（value prop + input 事件）；options 为 { label, value }，
 * value 类型保持与 options 一致（数字档位不会退化成字符串）。
 */
export default {
  name: 'IsSelect',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: [String, Number], default: '' },
    options: { type: Array, default () { return [] } },
    disabled: { type: Boolean, default: false },
    ariaLabel: { type: String, default: '' }
  },
  data () {
    return { open: false, cursor: 0, popUp: false, popStyle: null }
  },
  computed: {
    currentLabel () {
      for (let i = 0; i < this.options.length; i++) {
        if (this.sameValue(this.options[i].value)) return this.options[i].label
      }
      return this.value === null || this.value === undefined ? '' : String(this.value)
    },
    selectedIndex () {
      for (let i = 0; i < this.options.length; i++) {
        if (this.sameValue(this.options[i].value)) return i
      }
      return -1
    }
  },
  watch: {
    value () {
      if (!this.open) this.cursor = Math.max(0, this.selectedIndex)
    }
  },
  beforeDestroy () {
    this.unbind()
  },
  methods: {
    sameValue (v) {
      return String(v) === String(this.value)
    },
    toggle () {
      if (this.disabled) return
      if (this.open) this.close()
      else this.openPop()
    },
    openPop () {
      this.open = true
      this.cursor = Math.max(0, this.selectedIndex)
      document.addEventListener('mousedown', this.onDocDown, true)
      this.$nextTick(this.place)
    },
    close () {
      this.open = false
      this.unbind()
    },
    unbind () {
      document.removeEventListener('mousedown', this.onDocDown, true)
    },
    onDocDown (e) {
      const root = this.$refs.root
      if (root && !root.contains(e.target)) this.close()
    },
    // 浮层默认向下；下方空间不够而上方够时向上弹（绝对定位相对触发盒）
    place () {
      const root = this.$refs.root
      const pop = this.$refs.pop
      if (!root || !pop) return
      const r = root.getBoundingClientRect()
      const ph = pop.getBoundingClientRect().height
      const below = window.innerHeight - r.bottom
      this.popUp = below < ph + 8 && r.top > below
      this.popStyle = { minWidth: Math.round(r.width) + 'px' }
    },
    choose (o) {
      this.$emit('input', o.value)
      this.$emit('change', o.value)
      this.close()
    },
    onKey (e) {
      if (this.disabled) return
      if (e.key === 'Escape') {
        if (this.open) { e.stopPropagation(); this.close() }
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!this.open) { this.openPop(); return }
        const n = this.options.length
        if (!n) return
        this.cursor = (this.cursor + (e.key === 'ArrowDown' ? 1 : -1) + n) % n
        return
      }
      if (e.key === 'Home' || e.key === 'End') {
        if (!this.open) return
        e.preventDefault()
        this.cursor = e.key === 'Home' ? 0 : this.options.length - 1
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (!this.open) return // 未开：交给按钮原生 click 打开
        e.preventDefault() // 已开：选中当前游标，避免按钮 click 把浮层又关掉
        e.stopPropagation()
        const o = this.options[this.cursor]
        if (o) this.choose(o)
      }
    }
  }
}
</script>

<style lang="scss" scoped>
// 触发盒对齐 ui.scss 的 .is-input（同高同边框同聚焦态），保证与质量输入框等宽互换后不跳版
.is-select {
  position: relative;
  display: inline-flex;
  vertical-align: middle;

  &__trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    width: 100%;
    height: 30px;
    // 右侧只留 caret（8px 宽、right:5px 起）所需最小空位，其余尽量给文本：
    // .num 54px 槽位要完整显示「256」三位数，22px 右内边距会把数字挤成省略号
    padding: 0 16px 0 6px;
    border: 1px solid var(--is-input-border);
    border-radius: var(--is-r-sm);
    background: var(--is-input-bg);
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    outline: none;
    transition: border-color var(--is-dur-base) var(--is-ease-std),
      box-shadow var(--is-dur-base) var(--is-ease-std);
  }

  &:hover .is-select__trigger { border-color: var(--is-input-hover); }

  &.is-focus .is-select__trigger {
    border-color: var(--is-accent);
    box-shadow: var(--is-focus);
  }

  &.is-disabled {
    opacity: 0.45;
    .is-select__trigger { cursor: not-allowed; }
  }

  &__text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__caret {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid var(--is-text-3);
    transition: transform var(--is-dur-fast) var(--is-ease-std);
    pointer-events: none;
  }

  &.is-focus .is-select__caret {
    transform: translateY(-50%) rotate(180deg);
  }

  &__pop {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 100%;
    max-height: 224px;
    overflow-y: auto;
    padding: 4px;
    background: var(--is-card);
    border: 1px solid var(--is-border);
    border-radius: var(--is-r-sm);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    z-index: 3000;

    &--up {
      top: auto;
      bottom: calc(100% + 4px);
    }
  }

  &__opt {
    padding: 5px var(--is-s-2);
    border-radius: var(--is-r-sm);
    font-size: var(--is-fs-sm);
    color: var(--is-text-1, inherit);
    white-space: nowrap;
    cursor: pointer;

    &:hover,
    &.is-cursor {
      background: var(--is-accent-soft);
    }

    &.is-active {
      color: var(--is-accent);
      font-weight: var(--is-fw-semi);
    }
  }
}
</style>
