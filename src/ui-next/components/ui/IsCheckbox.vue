<template>
  <label class="is-check" :class="rootClass" @click="onClick">
    <input
      class="is-check__input"
      type="checkbox"
      :checked="isChecked"
      :disabled="isDisabled"
      :indeterminate.prop="isIndeterminate"
      @click.stop
      @change="onChange"
    >
    <span class="is-check__box">
      <is-icon name="check" />
    </span>
    <span v-if="hasText" class="is-check__label">
      <slot>{{ text }}</slot>
    </span>
  </label>
</template>

<script>
import IsIcon from './IsIcon.vue'

export default {
  name: 'IsCheckbox',
  components: { IsIcon },
  model: { prop: 'value', event: 'input' },
  inject: {
    isCheckboxGroup: { default: null }
  },
  props: {
    // 受控值：布尔（单选）或数组（配合 group / 传入 label）
    value: { type: [Boolean, Array, String, Number], default: false },
    // 在分组/数组模式下，本项代表的值
    label: { type: [String, Number, Boolean], default: undefined },
    trueValue: { default: true },
    falseValue: { default: false },
    indeterminate: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false }
  },
  computed: {
    group () {
      return this.isCheckboxGroup
    },
    isArrayModel () {
      return Array.isArray(this.value)
    },
    isChecked () {
      if (this.group) return (this.group.value || []).indexOf(this.label) > -1
      if (this.isArrayModel) return this.value.indexOf(this.label) > -1
      return this.value === this.trueValue
    },
    isIndeterminate () {
      return this.indeterminate && !this.isChecked
    },
    isDisabled () {
      if (this.group) return !!(this.group.disabled || this.disabled)
      return this.disabled
    },
    text () {
      // el-checkbox 语义：label 既作选中值也作显示文案
      return this.label === undefined || this.label === null ? '' : String(this.label)
    },
    hasText () {
      return !!(this.$slots.default || this.text)
    },
    rootClass () {
      return {
        'is-checked': this.isChecked,
        'is-indeterminate': this.isIndeterminate,
        'is-disabled': this.isDisabled
      }
    }
  },
  methods: {
    onClick (e) {
      if (this.isDisabled) e.preventDefault()
    },
    toggleArray (arr, val, on) {
      const next = arr.slice()
      const i = next.indexOf(val)
      if (on && i === -1) next.push(val)
      if (!on && i > -1) next.splice(i, 1)
      return next
    },
    onChange () {
      if (this.isDisabled) return
      // 半选态被点击时语义为「补齐全选」，而不是取消
      const on = this.isIndeterminate ? true : !this.isChecked

      if (this.group) {
        this.group.change(this.toggleArray(this.group.value || [], this.label, on))
        return
      }
      if (this.isArrayModel) {
        const next = this.toggleArray(this.value, this.label, on)
        this.$emit('input', next)
        this.$emit('change', next)
        return
      }
      const out = on ? this.trueValue : this.falseValue
      this.$emit('input', out)
      this.$emit('change', out)
    }
  }
}
</script>
