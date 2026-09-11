<template>
  <div class="is-segmented" role="tablist" :class="sizeClass">
    <button
      v-for="opt in normalized"
      :key="opt.value"
      type="button"
      role="tab"
      class="is-segmented__item"
      :class="{ 'is-active': opt.value === value }"
      :aria-selected="opt.value === value"
      :disabled="disabled"
      @click="pick(opt.value)"
    >
      <is-icon v-if="opt.icon" :name="opt.icon" size="sm" />
      <span>{{ opt.label }}</span>
    </button>
  </div>
</template>

<script>
import IsIcon from './IsIcon.vue'

export default {
  name: 'IsSegmented',
  components: { IsIcon },
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: [String, Number, Boolean], default: '' },
    // ['a', 'b'] 或 [{ label, value, icon }]
    options: { type: Array, default () { return [] } },
    disabled: { type: Boolean, default: false },
    size: { type: String, default: 'md' }
  },
  computed: {
    normalized () {
      return this.options.map((o) => {
        if (o && typeof o === 'object') {
          return { label: o.label !== undefined ? o.label : String(o.value), value: o.value, icon: o.icon }
        }
        return { label: String(o), value: o, icon: '' }
      })
    },
    sizeClass () {
      return this.size !== 'md' ? 'is-segmented--' + this.size : ''
    }
  },
  methods: {
    pick (v) {
      if (this.disabled || v === this.value) return
      this.$emit('input', v)
      this.$emit('change', v)
    }
  }
}
</script>
