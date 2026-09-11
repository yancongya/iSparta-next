<template>
  <transition name="is-dialog" @after-enter="$emit('opened')" @after-leave="$emit('closed')">
    <div
      v-if="showModel"
      class="is-dialog"
      :style="{ zIndex: zIndex }"
      @keydown.esc="onEsc"
    >
      <div class="is-dialog__mask" @click="onMaskClick"></div>
      <div
        class="is-dialog__panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        :style="panelStyle"
        tabindex="-1"
        ref="panel"
      >
        <header class="is-dialog__header">
          <h3 class="is-dialog__title">
            <slot name="title">{{ title }}</slot>
          </h3>
          <button
            v-if="showClose"
            type="button"
            class="is-dialog__close"
            :aria-label="$t('close')"
            @click="close"
          ><is-icon name="close" /></button>
        </header>

        <div class="is-dialog__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="is-dialog__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </transition>
</template>

<script>
import IsIcon from './IsIcon.vue'

let openCount = 0

export default {
  name: 'IsDialog',
  components: { IsIcon },
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '' },
    width: { type: String, default: '520px' },
    top: { type: String, default: '' },
    showClose: { type: Boolean, default: true },
    closeOnClickModal: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true },
    lockScroll: { type: Boolean, default: true },
    zIndex: { type: [String, Number], default: '' }
  },
  data () {
    return { showModel: false }
  },
  computed: {
    panelStyle () {
      const s = { width: this.width, maxWidth: '100%' }
      if (this.top) { s.marginTop = this.top }
      return s
    }
  },
  watch: {
    visible: {
      immediate: true,
      handler (val) {
        if (val) this.open()
        else this.teardown()
      }
    }
  },
  beforeDestroy () {
    this.teardown()
  },
  methods: {
    open () {
      if (this.showModel) return
      this.showModel = true
      this.$emit('open')
      if (this.lockScroll) {
        openCount++
        document.body.classList.add('is-scroll-locked')
      }
      this._onKey = (e) => {
        if (e.key === 'Escape' && this.closeOnEsc) {
          e.stopPropagation()
          this.close()
        }
      }
      document.addEventListener('keydown', this._onKey)
      this.$nextTick(() => {
        const panel = this.$refs.panel
        if (panel) panel.focus()
      })
    },
    close () {
      if (!this.showModel) return
      this.$emit('update:visible', false)
      this.$emit('close')
    },
    teardown () {
      if (!this.showModel) return
      this.showModel = false
      if (this.lockScroll) {
        openCount = Math.max(0, openCount - 1)
        if (!openCount) document.body.classList.remove('is-scroll-locked')
      }
      if (this._onKey) {
        document.removeEventListener('keydown', this._onKey)
        this._onKey = null
      }
    },
    onMaskClick () {
      if (this.closeOnClickModal) this.close()
    },
    onEsc () {
      if (this.closeOnEsc) this.close()
    }
  }
}
</script>
