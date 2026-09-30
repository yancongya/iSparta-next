<template>
  <span
    class="is-icon"
    :class="{ 'is-spin': spin, 'is-filled': filled }"
    :style="styleObj"
    aria-hidden="true"
    v-html="svg"
  ></span>
</template>

<script>
import { ICONS, SIZES } from './icons'

/**
 * 图标渲染：icons.js 内联 path（源文件 src/ui-next/icons/*.svg），
 * 包一层 <svg> 后 v-html；CSS 里 svg{stroke:currentColor} 随主题着色。
 */
export default {
  name: 'IsIcon',
  props: {
    name: { type: String, required: true },
    // 支持预设档位（xs/sm/md/lg/xl）或任意 CSS 长度
    size: { type: [String, Number], default: '' },
    spin: { type: Boolean, default: false },
    filled: { type: Boolean, default: false }
  },
  computed: {
    svg () {
      const body = ICONS[this.name]
      if (!body) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[IsIcon] 未注册的图标：' + this.name)
        }
        return ''
      }
      return '<svg viewBox="0 0 24 24">' + body + '</svg>'
    },
    styleObj () {
      if (!this.size) return null
      const v = SIZES[this.size] || (typeof this.size === 'number' ? this.size + 'px' : this.size)
      return { fontSize: v, width: v, height: v }
    }
  }
}
</script>
