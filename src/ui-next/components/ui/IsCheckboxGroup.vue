<template>
  <div class="is-checkbox-group" role="group">
    <slot />
  </div>
</template>

<script>
export default {
  name: 'IsCheckboxGroup',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: Array, default () { return [] } },
    disabled: { type: Boolean, default: false }
  },
  provide () {
    const vm = this
    // 用 getter 暴露，保证子组件读到的是响应式的最新值
    return {
      isCheckboxGroup: {
        get value () { return vm.value },
        get disabled () { return vm.disabled },
        change: vm.emitValue
      }
    }
  },
  methods: {
    emitValue (next) {
      this.$emit('input', next)
      this.$emit('change', next)
    }
  }
}
</script>

<!-- 布局样式收敛在 ui.scss 的 .is-checkbox-group，组件内不再写 scoped 重复规则：
     scoped 编译产物带 [data-v-xxx] 属性选择器（特异度 0,2,0），会压平调用方
     类似 .is-checkbox-group.fmt-grid 的同特异度定制——本项目第 4 次同型层叠事故的根因。 -->
