<template>
  <transition name="is-dialog" @after-enter="$emit('opened')" @after-leave="$emit('closed')">
    <div
      v-if="showModel"
      class="is-dialog"
      :class="rootClass"
      :style="{ zIndex: zIndex }"
      @keydown.esc="onEsc"
    >
      <div class="is-dialog__mask" @click="onMaskClick"></div>
      <div
        class="is-dialog__panel"
        :class="panelClass"
        role="dialog"
        aria-modal="true"
        :aria-label="title || undefined"
        :style="panelStyle"
        tabindex="-1"
        ref="panel"
      >
        <header v-if="!hideHeader" class="is-dialog__header">
          <h3 class="is-dialog__title">
            <slot name="title">{{ title }}</slot>
          </h3>
          <!-- 标题栏操作区（可选）：如设置弹窗的布局切换图标。
               放在标题与关闭按钮之间，随 header 的 space-between 自动靠右。 -->
          <div v-if="$slots['header-actions']" class="is-dialog__header-actions">
            <slot name="header-actions" />
          </div>
          <button
            v-if="showClose"
            type="button"
            class="is-dialog__close"
            :aria-label="$t('close')"
            @click="close"
          ><is-icon name="close" /></button>
        </header>
        <button
          v-else-if="showClose"
          type="button"
          class="is-dialog__close is-dialog__close--float"
          :aria-label="$t('close')"
          @click="close"
        ><is-icon name="close" /></button>

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
    hideHeader: { type: Boolean, default: false },
    panelClass: { type: [String, Array, Object], default: '' },
    // 外层遮罩容器类名：日志等「铺满」面板用来收紧 .is-dialog 的四周 padding
    rootClass: { type: [String, Array, Object], default: '' },
    showClose: { type: Boolean, default: true },
    closeOnClickModal: { type: Boolean, default: true },
    closeOnEsc: { type: Boolean, default: true },
    lockScroll: { type: Boolean, default: true },
    zIndex: { type: [String, Number], default: '' },
    // 模态框默认提升到 body：成为真正的全局浮层。弹窗常在 .mod-list 内声明，
    // 若留在原地，里面的 mousedown/click 会沿 DOM 冒泡触发列表框选/空白全选
    // （拖动对比分割线时选中背景卡片）。提升到 body 后与列表是兄弟节点，
    // 事件链彻底断开，无需在各处加 .stop 拦截。
    toBody: { type: Boolean, default: true }
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
        this.teleportToBody()
        const panel = this.$refs.panel
        if (panel) panel.focus()
      })
    },
    // 把弹窗根节点移到 body，成为真正的全局浮层：
    // 弹窗多在 .mod-list 等容器内部声明，留在原地时内部 mousedown/click
    // 会沿 DOM 冒泡触发列表框选、空白取消/全选（拖动对比分割线选中背景卡片）。
    // 移到 body 后与列表脱离父子关系，事件不再互通；transition/vue 实例引用不变。
    teleportToBody () {
      if (!this.toBody) return
      const el = this.$el
      if (el && el.parentNode !== document.body) {
        document.body.appendChild(el)
      }
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
