<template>
  <div
    ref="wrap"
    class="is-cmp"
    :class="[{ 'is-dragging': dragging, 'is-splitting': dragMode === 'split' }, 'is-cmp--bg-' + bgMode]"
    tabindex="0"
    role="group"
    :aria-label="ariaLabel"
    @pointerdown.stop="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @wheel.prevent="onWheel"
    @dblclick="onDblClick"
  >
    <!--
      分隔线位置由 split（容器百分比）决定：before 层用不参与 transform 的 scene 做 clip，
      两图各自在 canvas 层里同步缩放/平移。裁剪线与分隔线始终锁在容器坐标系，
      因此缩放/平移画布时线不跑偏；拖动线本身只改 split，画布纹丝不动。
    -->
    <div class="is-cmp__scene is-cmp__scene--after">
      <div class="is-cmp__canvas" :style="canvasStyle">
        <img class="is-cmp__after" :src="srcAfter" alt="" draggable="false" />
      </div>
    </div>
    <div class="is-cmp__scene is-cmp__scene--before" :style="beforeClipStyle">
      <div class="is-cmp__canvas" :style="canvasStyle">
        <img class="is-cmp__before" :src="srcBefore" alt="" draggable="false" />
      </div>
    </div>

    <!-- 可拖分隔线 + 把手：左右拖改 split（画布不动），其余区域拖仍平移画布 -->
    <div class="is-cmp__divider" :style="dividerStyle"><span class="is-cmp__handle"></span></div>

    <!-- 标签：半透明深色胶囊，任何主题/背景色下都清晰 -->
    <span v-if="labelBefore" class="is-cmp__tag is-cmp__tag--before">
      <is-icon name="image" size="xs" />{{ labelBefore }}
    </span>
    <button
      v-if="labelAfter && afterClickable"
      v-tip="afterTip"
      type="button"
      class="is-cmp__tag is-cmp__tag--after is-cmp__tag--clickable"
      :title="afterTitle"
      @pointerdown.stop
      @dblclick.stop
      @click.stop="$emit('after-click')"
    >
      <is-icon name="sparkles" size="xs" />{{ labelAfter }}
    </button>
    <span v-else-if="labelAfter" v-tip="afterTip" class="is-cmp__tag is-cmp__tag--after">
      <is-icon name="sparkles" size="xs" />{{ labelAfter }}
    </span>
  </div>
</template>

<!--
  图片对比画布（桌面专用；CEP 不使用本组件）：
  - 分隔线可用鼠标左右拖动改变位置（split，容器百分比）；线本身不随画布缩放/平移跑偏
  - 拖把手/线附近 → 改 split（画布不动）；拖其余区域 → 平移画布；滚轮/按钮缩放（以指针为锚，钳 0.5~5x）
  - 双击恢复默认：缩放/平移归位 + split 回中线 50%
  - before 层的 clip 放在不参与 transform 的 scene 上，两图 canvas 用同一 transform 同步，
    因此缩放/平移后裁剪线与分隔线仍锁在容器坐标（若把 clip 放在 img 上会随 transform 跑偏）
  - 两图 src 由组件托管：replay() 同时清空再赋值，让两侧动画从同一帧起播
-->
<script>
import IsIcon from './ui/IsIcon.vue'

var MIN_SCALE = 0.5
var MAX_SCALE = 5
var BG_ICONS = ['image', 'sun', 'moon', 'grid']
var HANDLE_HIT = 20 // 指针落在分隔线左右这个像素范围内视为拖线，否则平移画布

export default {
  name: 'IsCompareSlider',
  components: { IsIcon },
  props: {
    before: { type: String, default: '' },
    after: { type: String, default: '' },
    labelBefore: { type: String, default: '' },
    labelAfter: { type: String, default: '' },
    afterClickable: { type: Boolean, default: false },
    afterTip: { type: [String, Object], default: '' },
    afterTitle: { type: String, default: '' },
    ariaLabel: { type: String, default: 'compare' }
  },
  data () {
    return {
      dragging: false,
      dragMode: '', // 'pan' 平移画布 / 'split' 拖分隔线
      panStart: null,
      scale: 1,
      tx: 0,
      ty: 0,
      split: 50, // 分隔线位置（容器宽度百分比），不随画布 transform 跑偏
      bgMode: 0, // 0 默认(跟随主题) / 1 浅色 / 2 深色 / 3 棋盘格
      // 两图 src 由组件托管，replay() 同时清空+赋值以对齐动画起点
      srcBefore: this.before,
      srcAfter: this.after
    }
  },
  computed: {
    canvasStyle () {
      return { transform: 'translate(' + this.tx + 'px,' + this.ty + 'px) scale(' + this.scale + ')' }
    },
    // 分隔线定位与 before 裁剪都读同一个 split，二者永远重合；二者都在不参与 transform 的层，
    // 所以缩放/平移画布时线不会跑偏，拖线时也只改容器百分比、不动画布。
    dividerStyle () {
      return { left: this.split + '%' }
    },
    beforeClipStyle () {
      return { clipPath: 'inset(0 ' + (100 - this.split) + '% 0 0)' }
    },
    zoomPercent () {
      return Math.round(this.scale * 100) + '%'
    },
    bgIcon () {
      return BG_ICONS[this.bgMode]
    }
  },
  watch: {
    before (v) { this.srcBefore = v },
    after (v) { this.srcAfter = v },
    // 视图状态抛给外壳 footer：工具条归外壳渲染，这里只驱动画布。
    // 按钮方法（zoomIn/out/reset/cycleBg）仍是本组件公开 API，外壳通过 ref 调用。
    zoomPercent (v) { this.emitViewState(v, this.bgIcon) },
    bgIcon (v) { this.emitViewState(this.zoomPercent, v) }
  },
  mounted () {
    this.emitViewState(this.zoomPercent, this.bgIcon)
  },
  methods: {
    emitViewState (zoomPercent, bgIcon) {
      this.$emit('view-state', { zoomPercent: zoomPercent, bgIcon: bgIcon })
    },
    onDown (e) {
      // 指针捕获：拖动期间所有 move/up 锁在滑块上，鼠标移出弹窗也不会
      // 落到背景任务条触发误选。
      var wrap = this.$refs.wrap
      if (wrap && wrap.setPointerCapture && e.pointerId != null) {
        try { wrap.setPointerCapture(e.pointerId) } catch (err) { /* 捕获失败仍可拖动 */ }
      }
      // 拖拽分流：指针靠近分隔线（容器坐标）就拖线，否则平移画布。
      // 用容器坐标判定，与画布 transform 无关，缩放/平移后命中区仍在线上。
      var rect = wrap.getBoundingClientRect()
      var lineX = rect.left + rect.width * this.split / 100
      var nearLine = Math.abs(e.clientX - lineX) <= HANDLE_HIT
      this.dragMode = nearLine ? 'split' : 'pan'
      this.dragging = true
      this.panStart = { x: e.clientX, y: e.clientY, tx: this.tx, ty: this.ty, split: this.split }
    },
    onMove (e) {
      // 未拖动时：悬停命中分隔线就切 ew-resize 光标，给出「可左右拖」的反馈
      if (!this.dragging) {
        var mwrap = this.$refs.wrap
        if (mwrap) {
          var mrect = mwrap.getBoundingClientRect()
          var mlineX = mrect.left + mrect.width * this.split / 100
          this.dragMode = Math.abs(e.clientX - mlineX) <= HANDLE_HIT ? 'split' : ''
        }
        return
      }
      if (!this.panStart) return
      if (this.dragMode === 'split') {
        // 只改容器里的 split（钳 0~100），画布 tx/ty/scale 一律不动
        var wrap = this.$refs.wrap
        var rect = wrap.getBoundingClientRect()
        if (!rect.width) return
        var delta = (e.clientX - this.panStart.x) / rect.width * 100
        this.split = Math.max(0, Math.min(100, this.panStart.split + delta))
        return
      }
      this.tx = this.panStart.tx + (e.clientX - this.panStart.x)
      this.ty = this.panStart.ty + (e.clientY - this.panStart.y)
    },
    onUp (e) {
      if (!this.dragging) return
      this.dragging = false
      this.dragMode = ''
      this.panStart = null
      var wrap = this.$refs.wrap
      if (wrap && e && e.pointerId != null && wrap.hasPointerCapture && wrap.hasPointerCapture(e.pointerId)) {
        try { wrap.releasePointerCapture(e.pointerId) } catch (err) { /* 已释放 */ }
      }
    },
    // 以指针位置为锚点缩放：指针下的内容点保持不动
    onWheel (e) {
      this.zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY)
    },
    zoomAt (factor, clientX, clientY) {
      var next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor))
      if (next === this.scale) return
      var rect = this.$refs.wrap.getBoundingClientRect()
      var cx = (clientX == null ? rect.left + rect.width / 2 : clientX) - rect.left - rect.width / 2
      var cy = (clientY == null ? rect.top + rect.height / 2 : clientY) - rect.top - rect.height / 2
      var ratio = next / this.scale
      this.tx = cx - (cx - this.tx) * ratio
      this.ty = cy - (cy - this.ty) * ratio
      this.scale = next
    },
    zoomIn () { this.zoomAt(1.25, null, null) },
    zoomOut () { this.zoomAt(1 / 1.25, null, null) },
    resetView () {
      this.scale = 1
      this.tx = 0
      this.ty = 0
      this.split = 50
    },
    onDblClick () { this.resetView() },
    cycleBg () { this.bgMode = (this.bgMode + 1) % BG_ICONS.length },
    // 前后两图是各自循环播放的动图，加载时机不同会导致同一时刻显示不同帧。
    // 同时清空 src 再同一 tick 赋值，让两张图从第一帧一起起播。
    replay () {
      var b = this.before
      var a = this.after
      this.srcBefore = ''
      this.srcAfter = ''
      var vm = this
      this.$nextTick(function () {
        vm.srcBefore = b
        vm.srcAfter = a
      })
    }
  }
}
</script>

<style lang="scss">
.is-cmp {
  position: relative;
  width: 100%;
  // 固定高度：两图绝对定位重叠，尺寸不再由图片堆叠决定，避免弹窗被撑出滚动条。
  // object-fit: contain 保证任意尺寸的源图/产物等比完整显示，不被拉伸变形。
  height: min(46vh, 420px);
  overflow: hidden;
  border-radius: var(--is-r-md);
  background: var(--is-inset);
  user-select: none;
  cursor: grab;

  &--bg-1 { background: #f4f4f4; }
  &--bg-2 { background: #16181a; }
  &--bg-3 {
    background-color: #9a9a9a;
    background-image:
      linear-gradient(45deg, #c9c9c9 25%, transparent 25%),
      linear-gradient(-45deg, #c9c9c9 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #c9c9c9 75%),
      linear-gradient(-45deg, transparent 75%, #c9c9c9 75%);
    background-size: 16px 16px;
    background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  }

  // scene 铺满容器且不参与 transform；before 层在此按 split 裁剪（inline style），
  // 裁剪线随 split 移动但永远不参与画布 transform，故缩放/平移时不会跑偏。
  &__scene {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  // 两图各自的画布层，共用同一个 canvasStyle 同步缩放/平移。
  &__canvas {
    position: absolute;
    inset: 0;
    transform-origin: center center;
    will-change: transform;
  }

  &__before,
  &__after {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  &__divider {
    position: absolute;
    top: 0;
    bottom: 0;
    // left 由 inline style（split%）控制；默认 50 兜底
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--is-accent);
    box-shadow: 0 0 8px rgba(var(--is-accent-rgb), 0.55);
    pointer-events: none;
  }

  &__handle {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 12px;
    height: 12px;
    border: 2px solid var(--is-accent);
    border-radius: var(--is-r-pill);
    background: var(--is-card);
    box-shadow: var(--is-glow);
    transform: translate(-50%, -50%);
  }

  &__after-group {
    position: absolute;
    top: var(--is-s-3);
    right: var(--is-s-3);
    display: inline-flex;
    align-items: center;
    gap: var(--is-s-1);
    pointer-events: none;

    .is-cmp__tag {
      position: static;
    }
  }

  &__tag {
    position: absolute;
    top: var(--is-s-3);
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--is-r-pill);
    background: rgba(0, 0, 0, 0.58);
    backdrop-filter: blur(10px);
    box-shadow: var(--is-shadow-xs);
    color: #fff;
    font-size: var(--is-fs-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
    pointer-events: none;

    .is-icon { opacity: 0.85; }
    &--before { left: var(--is-s-3); }
    &--after { right: var(--is-s-3); }
    &--icon { padding: 5px 8px; }
    &--clickable {
      pointer-events: auto;
      cursor: pointer;
      transition: border-color var(--is-dur-fast) var(--is-ease-std), color var(--is-dur-fast) var(--is-ease-std);

      &:hover {
        border-color: var(--is-accent);
        color: var(--is-accent);
      }
    }
  }

  &.is-dragging { cursor: grabbing; }
  // 指针在分隔线附近时（JS 命中）显示左右拖的样式，给出可拖反馈
  &.is-splitting { cursor: ew-resize; }
  &.is-splitting.is-dragging { cursor: ew-resize; }

  &:focus,
  &:focus-visible {
    outline: none;
  }
}
</style>
