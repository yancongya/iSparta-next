<template>
  <div
    ref="wrap"
    class="is-cmp"
    :class="{ 'is-dragging': dragging }"
    tabindex="0"
    role="slider"
    :aria-label="ariaLabel"
    :aria-valuenow="Math.round(target)"
    aria-valuemin="0"
    aria-valuemax="100"
    @mousedown="onDown"
    @mousemove="onMove"
    @mouseup="onUp"
    @mouseleave="onUp"
    @keydown.left="nudge(-4)"
    @keydown.right="nudge(4)"
  >
    <!-- 底层：处理后（after）铺满；上层：原始（before）被 clip-path 裁到分隔线左侧 -->
    <img class="is-cmp__after" :src="after" alt="" draggable="false" />
    <img class="is-cmp__before" :src="before" alt="" draggable="false" :style="{ clipPath: 'inset(0 ' + (100 - pos) + '% 0 0)' }" />

    <!-- 分隔线 + 手柄 -->
    <div class="is-cmp__divider" :style="{ left: pos + '%' }">
      <span class="is-cmp__handle">
        <is-icon name="sliders" size="sm" />
      </span>
    </div>

    <span v-if="labelBefore" class="is-cmp__tag is-cmp__tag--before">{{ labelBefore }}</span>
    <span v-if="labelAfter" class="is-cmp__tag is-cmp__tag--after">{{ labelAfter }}</span>
  </div>
</template>

<!--
  图片对比滑块：左右拖动分隔线查看处理前后效果。
  - rAF 阻尼跟随（0.18 系数）：手柄不粘指针，带一点「追手感」
  - clip-path: inset() 裁切上层图，GPU 合成
  - 键盘左右微调（±4%），可聚焦（tabindex=0 + role=slider）
  - reduced-motion：阻尼循环退化为直接跳转
-->
<script>
import IsIcon from './ui/IsIcon.vue'

var REDUCED = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default {
  name: 'IsCompareSlider',
  components: { IsIcon },
  props: {
    before: { type: String, default: '' },
    after: { type: String, default: '' },
    labelBefore: { type: String, default: '' },
    labelAfter: { type: String, default: '' },
    ariaLabel: { type: String, default: 'compare' }
  },
  data () {
    return {
      pos: 50, // 实际渲染位置（阻尼跟随 target）
      target: 50, // 目标位置（指针/键盘设定）
      dragging: false
    }
  },
  watch: {
    target () {
      this.kick()
    }
  },
  beforeDestroy () {
    this.stop()
  },
  methods: {
    kick () {
      if (this._raf) return
      if (REDUCED) {
        this.pos = this.target
        return
      }
      this._raf = window.requestAnimationFrame(this.tick)
    },
    tick () {
      // 阻尼跟随：每帧走剩余距离的 18%，差值 < 0.1 判定到位
      var diff = this.target - this.pos
      if (Math.abs(diff) < 0.1) {
        this.pos = this.target
        this._raf = null
        return
      }
      this.pos += diff * 0.18
      this._raf = window.requestAnimationFrame(this.tick)
    },
    stop () {
      if (this._raf) {
        window.cancelAnimationFrame(this._raf)
        this._raf = null
      }
    },
    nudge (d) {
      this.target = Math.max(0, Math.min(100, this.target + d))
    },
    fromEvent (clientX) {
      var rect = this.$refs.wrap.getBoundingClientRect()
      if (!rect.width) return
      this.target = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    },
    onDown (e) {
      this.dragging = true
      this.fromEvent(e.clientX)
    },
    onMove (e) {
      if (this.dragging) this.fromEvent(e.clientX)
    },
    onUp () {
      this.dragging = false
    }
  }
}
</script>

<style lang="scss">
.is-cmp {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: var(--is-r-md);
  background: var(--is-inset);
  user-select: none;
  cursor: ew-resize;

  &__before,
  &__after {
    display: block;
    width: 100%;
    pointer-events: none;
  }

  &__divider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--is-accent);
    box-shadow: 0 0 8px rgba(var(--is-accent-rgb), 0.55);
    pointer-events: none;
    will-change: left;
  }

  &__handle {
    position: absolute;
    top: 50%;
    left: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 2px solid var(--is-accent);
    border-radius: var(--is-r-pill);
    background: var(--is-card);
    color: var(--is-accent);
    transform: translate(-50%, -50%);
    transition: transform var(--is-dur-base) var(--is-ease-spring),
      box-shadow var(--is-dur-base) var(--is-ease-std);
  }

  &:hover &__handle {
    transform: translate(-50%, -50%) scale(1.12);
    box-shadow: var(--is-glow);
  }

  &__tag {
    position: absolute;
    top: var(--is-s-2);
    padding: 2px var(--is-s-2);
    border-radius: var(--is-r-xs);
    background: var(--is-overlay);
    color: var(--is-text);
    font-size: var(--is-fs-xs);
    font-family: var(--is-mono);
    pointer-events: none;

    &--before { left: var(--is-s-2); }
    &--after { right: var(--is-s-2); }
  }

  &.is-dragging {
    cursor: grabbing;

    .is-cmp__handle {
      transform: translate(-50%, -50%) scale(0.94);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--is-accent);
    outline-offset: 2px;
  }
}
</style>
