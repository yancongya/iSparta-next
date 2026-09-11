<template>
  <form class="is-form" :class="'is-form--' + layout" @submit.prevent="$emit('submit')">
    <slot />
  </form>
</template>

<script>
export default {
  name: 'IsForm',
  props: {
    // horizontal（标签在左）| vertical（标签在上）| inline
    layout: { type: String, default: 'horizontal' },
    labelWidth: { type: String, default: '' }
  },
  provide () {
    const vm = this
    return {
      isForm: {
        get labelWidth () { return vm.labelWidth },
        get layout () { return vm.layout }
      }
    }
  }
}
</script>
