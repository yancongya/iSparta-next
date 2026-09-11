<template>
  <div class="is-form-item" :class="{ 'is-form-item--stack': stack }">
    <label v-if="hasLabel" class="is-form-item__label" :style="labelStyle">
      <slot name="label">{{ label }}</slot>
    </label>
    <div class="is-form-item__body">
      <slot />
      <em v-if="hint" class="is-form-item__hint">{{ hint }}</em>
    </div>
  </div>
</template>

<script>
export default {
  name: 'IsFormItem',
  inject: {
    isForm: { default: null }
  },
  props: {
    label: { type: String, default: '' },
    labelWidth: { type: String, default: '' },
    hint: { type: String, default: '' }
  },
  computed: {
    stack () {
      if (this.isForm) return this.isForm.layout === 'vertical'
      return false
    },
    hasLabel () {
      return !!(this.$slots.label || this.label)
    },
    width () {
      return this.labelWidth || (this.isForm && this.isForm.labelWidth) || ''
    },
    labelStyle () {
      return this.width ? { width: this.width, flexBasis: this.width } : null
    }
  }
}
</script>
