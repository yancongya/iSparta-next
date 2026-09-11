<template>
  <span
    class="is-input"
    :class="rootClass"
    @click="focus"
  >
    <input
      ref="input"
      class="is-input__inner"
      :type="type"
      :value="value"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :min="min"
      :max="max"
      :step="step"
      :autocomplete="autocomplete"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keyup="onKeyup"
      @keydown="onKeydown"
      @keyup.enter="$emit('enter', $event)"
    >
    <span v-if="$slots.suffix || suffix" class="is-input__suffix">
      <slot name="suffix">{{ suffix }}</slot>
    </span>
  </span>
</template>

<script>
export default {
  name: 'IsInput',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: [String, Number], default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    size: { type: String, default: 'md' },
    align: { type: String, default: 'left' },
    disabled: { type: Boolean, default: false },
    readonly: { type: Boolean, default: false },
    maxlength: { type: [String, Number], default: undefined },
    min: { type: [String, Number], default: undefined },
    max: { type: [String, Number], default: undefined },
    step: { type: [String, Number], default: undefined },
    autocomplete: { type: String, default: 'off' },
    suffix: { type: String, default: '' },
    // 自动把字符串转成数字后再抛出（等价于 v-model.number，便于显式声明）
    number: { type: Boolean, default: false }
  },
  data () {
    return { focused: false }
  },
  computed: {
    rootClass () {
      return [
        this.size !== 'md' ? 'is-input--' + this.size : '',
        this.align !== 'left' ? 'is-input--' + this.align : '',
        this.focused ? 'is-focus' : '',
        this.disabled ? 'is-disabled' : ''
      ]
    }
  },
  methods: {
    cast (raw) {
      if (!this.number && this.type !== 'number') return raw
      if (raw === '' || raw === null) return ''
      const n = Number(raw)
      return isNaN(n) ? raw : n
    },
    onInput (e) {
      this.$emit('input', this.cast(e.target.value))
    },
    onFocus (e) {
      this.focused = true
      this.$emit('focus', e)
    },
    onBlur (e) {
      this.focused = false
      this.$emit('blur', e)
    },
    onKeyup (e) { this.$emit('keyup', e) },
    onKeydown (e) { this.$emit('keydown', e) },
    focus () {
      if (this.disabled || this.readonly) return
      const el = this.$refs.input
      if (el && document.activeElement !== el) el.focus()
    },
    blur () {
      const el = this.$refs.input
      if (el) el.blur()
    },
    select () {
      const el = this.$refs.input
      if (el) el.select()
    }
  }
}
</script>
