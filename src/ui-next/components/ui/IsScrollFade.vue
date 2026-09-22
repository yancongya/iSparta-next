<template>
  <div
    ref="viewport"
    class="is-scroll-fade"
    :class="'is-scroll-fade--' + maskState"
  >
    <div ref="content" class="is-scroll-fade__content">
      <slot />
    </div>
  </div>
</template>

<script>
/**
 * 滚动边缘渐隐：内容可滚动时上下 24px 用 mask 渐隐，提示还有内容。
 * 暴露 $refs.viewport 供调用方读写 scrollTop（如日志自动滚底）。
 */
export default {
  name: 'IsScrollFade',
  data () {
    return { maskState: 'none' }
  },
  mounted () {
    this._onScroll = () => this.updateMask()
    const vp = this.$refs.viewport
    if (vp) {
      vp.addEventListener('scroll', this._onScroll, { passive: true })
    }
    this._ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => this.updateMask())
      : null
    if (this._ro && this.$refs.content) {
      this._ro.observe(this.$refs.content)
      this._ro.observe(vp)
    }
    this.updateMask()
    this._onWin = () => this.updateMask()
    window.addEventListener('resize', this._onWin)
  },
  updated () {
    this.updateMask()
  },
  beforeDestroy () {
    const vp = this.$refs.viewport
    if (vp && this._onScroll) { vp.removeEventListener('scroll', this._onScroll) }
    if (this._ro) { this._ro.disconnect() }
    if (this._onWin) { window.removeEventListener('resize', this._onWin) }
  },
  methods: {
    updateMask () {
      const vp = this.$refs.viewport
      if (!vp) { return }
      const max = vp.scrollHeight - vp.clientHeight
      if (max <= 1) {
        this.maskState = 'none'
        return
      }
      const top = vp.scrollTop > 1
      const bottom = vp.scrollTop < max - 1
      this.maskState = top && bottom ? 'both' : (top ? 'top' : (bottom ? 'bottom' : 'none'))
    },
    scrollToBottom () {
      const vp = this.$refs.viewport
      if (vp) { vp.scrollTop = vp.scrollHeight }
    }
  }
}
</script>
