<template>
  <span class="is-stepper" :class="[{ 'is-focus': focused, 'is-disabled': disabled }, sizeClass]">
    <input
      class="is-stepper__inner"
      type="text"
      inputmode="decimal"
      :value="display"
      :disabled="disabled"
      :placeholder="placeholder"
      @input="onInput"
      @focus="focused = true"
      @blur="onBlur"
      @keydown.up.prevent="stepBy(1)"
      @keydown.down.prevent="stepBy(-1)"
    >
    <span v-if="controls" class="is-stepper__ctrl">
      <button
        type="button"
        class="is-stepper__btn"
        :disabled="disabled || isMax"
        tabindex="-1"
        @click="stepBy(1)"
      ><is-icon name="chevron-up" /></button>
      <button
        type="button"
        class="is-stepper__btn"
        :disabled="disabled || isMin"
        tabindex="-1"
        @click="stepBy(-1)"
      ><is-icon name="chevron-down" /></button>
    </span>
  </span>
</template>

<script>
import IsIcon from './IsIcon.vue'

export default {
  name: 'IsInputNumber',
  components: { IsIcon },
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: [Number, String], default: undefined },
    min: { type: Number, default: -Infinity },
    max: { type: Number, default: Infinity },
    step: { type: Number, default: 1 },
    precision: { type: Number, default: undefined },
    disabled: { type: Boolean, default: false },
    controls: { type: Boolean, default: true },
    size: { type: String, default: 'md' },
    placeholder: { type: String, default: '' }
  },
  data () {
    return { focused: false }
  },
  computed: {
    sizeClass () {
      return this.size !== 'md' ? 'is-stepper--' + this.size : ''
    },
    num () {
      const n = Number(this.value)
      return isNaN(n) ? null : n
    },
    display () {
      return this.num === null ? '' : String(this.num)
    },
    isMax () {
      return this.num !== null && this.num >= this.max
    },
    isMin () {
      return this.num !== null && this.num <= this.min
    }
  },
  methods: {
    clamp (n) {
      let v = Math.min(Math.max(n, this.min), this.max)
      const p = this.precision === undefined ? this.decimalsOfStep() : this.precision
      if (p < 20) v = Number(v.toFixed(p))
      return v
    },
    // 未显式给 precision 时，按 step 的小数位推断，避免 0.01 步进出现浮点尾巴
    decimalsOfStep () {
      const s = String(this.step)
      const i = s.indexOf('.')
      return i === -1 ? 0 : s.length - i - 1
    },
    emit (v) {
      if (v === this.value) return
      this.$emit('input', v)
      this.$emit('change', v)
    },
    stepBy (dir) {
      if (this.disabled) return
      const base = this.num === null ? 0 : this.num
      this.emit(this.clamp(base + this.step * dir))
    },
    onInput (e) {
      const raw = e.target.value
      if (raw === '') {
        this.emit(undefined)
        return
      }
      const n = Number(raw)
      if (!isNaN(n)) this.emit(this.clamp(n))
    },
    onBlur () {
      this.focused = false
      // 失焦时把越界/空值归位，保证显示与内部状态一致
      this.emit(this.num === null ? this.clamp(0) : this.clamp(this.num))
    }
  }
}
</script>
