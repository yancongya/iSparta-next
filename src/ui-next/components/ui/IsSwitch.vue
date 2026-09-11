<template>
  <label class="is-switchwrap" :class="{ 'is-disabled': disabled }">
    <span
      class="is-switch"
      :class="{ 'is-on': checked }"
      role="switch"
      tabindex="0"
      :aria-checked="String(checked)"
      :aria-disabled="String(disabled)"
      @click="toggle"
      @keydown.space.prevent="toggle"
      @keydown.enter.prevent="toggle"
    ></span>
    <span v-if="hasText" class="is-switchwrap__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<script>
export default {
  name: 'IsSwitch',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: [Boolean, String, Number], default: false },
    label: { type: String, default: '' },
    trueValue: { default: true },
    falseValue: { default: false },
    disabled: { type: Boolean, default: false }
  },
  computed: {
    checked () { return this.value === this.trueValue },
    hasText () { return !!(this.$slots.default || this.label) }
  },
  methods: {
    toggle () {
      if (this.disabled) return
      const next = this.checked ? this.falseValue : this.trueValue
      this.$emit('input', next)
      this.$emit('change', next)
    }
  }
}
</script>
