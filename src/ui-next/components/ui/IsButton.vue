<template>
  <button
    class="is-btn"
    :class="classes"
    :type="nativeType"
    :disabled="disabled || loading"
    @click="onClick"
  >
    <is-icon v-if="loading" name="loader" spin class="is-btn__spinner" />
    <is-icon v-else-if="icon" :name="icon" />
    <slot />
  </button>
</template>

<script>
import anime from 'animejs'
import IsIcon from './IsIcon.vue'

var REDUCED = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default {
  name: 'IsButton',
  components: { IsIcon },
  props: {
    type: { type: String, default: 'default' },
    size: { type: String, default: 'md' },
    icon: { type: String, default: '' },
    block: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    nativeType: { type: String, default: 'button' },
    // 关闭点击波纹（密集小按钮时可关）
    ripple: { type: Boolean, default: true }
  },
  computed: {
    classes () {
      return [
        'is-btn--' + this.type,
        this.size !== 'md' ? 'is-btn--' + this.size : '',
        this.block ? 'is-btn--block' : '',
        this.loading ? 'is-loading' : ''
      ]
    }
  },
  beforeDestroy () {
    this.killRipples()
  },
  methods: {
    onClick (e) {
      if (this.disabled || this.loading) return
      if (this.ripple && !REDUCED) this.spawnRipple(e)
      this.$emit('click', e)
    },
    spawnRipple (e) {
      const host = this.$el
      if (!host) return
      const rect = host.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 1.6
      const el = document.createElement('span')
      el.className = 'is-btn__ripple'
      el.style.width = el.style.height = size + 'px'
      el.style.left = (e.clientX - rect.left - size / 2) + 'px'
      el.style.top = (e.clientY - rect.top - size / 2) + 'px'
      host.appendChild(el)
      this._ripples = this._ripples || []
      this._ripples.push(anime({
        targets: el,
        scale: [0, 1],
        opacity: [0.3, 0],
        duration: 620,
        easing: 'easeOutExpo',
        complete: () => {
          if (el.parentNode) el.parentNode.removeChild(el)
          this._ripples = (this._ripples || []).filter(a => a !== el)
        }
      }))
    },
    killRipples () {
      (this._ripples || []).forEach(a => { if (a && a.pause) a.pause() })
      this._ripples = []
    }
  }
}
</script>
