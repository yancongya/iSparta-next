<template>
  <div class="pv">
    <!-- 变量路径输入行 -->
    <div class="pv__row">
      <span v-if="showLabel" class="pv__label">{{ $t('pathVar') }}</span>
      <is-input
        class="pv__in"
        :value="value"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
      />
      <slot name="append" />
    </div>

    <!-- 变量胶囊：点击插入，颜色区分；hover 第一行说作用，第二行给当前值 -->
    <div v-if="chips.length" class="pv__chips">
      <button
        v-for="v in chips"
        :key="v.key"
        type="button"
        class="var-chip"
        :class="'var-chip--c' + v.i"
        :disabled="disabled"
        v-tip="tipFor(v)"
        @click.stop="$emit('insert', v.key)"
      >
        <span class="var-chip__key">{{ '{' + v.key + '}' }}</span>
        <span class="var-chip__val is-ellipsis">{{ v.value || '—' }}</span>
      </button>
    </div>
  </div>
</template>

<script>
// 变量顺序即配色顺序：c1 srcPath / c2 src / c3 srcName / c4 name / c5 type / c6 parent / c7 date
// srcName：Comp=合成名；文件源=与 src 同（目录基名）
const VAR_KEYS = ['srcPath', 'src', 'srcName', 'name', 'type', 'parent', 'date']

export default {
  name: 'PathVars',
  props: {
    value: { type: String, default: '' },
    // outputContext(item) 的结果；为空表示当前无法求值（如多选）
    ctx: { type: Object, default: null },
    showLabel: { type: Boolean, default: true },
    disabled: { type: Boolean, default: false },
    placeholder: { type: String, default: '{srcPath}/output' },
    // output=产物路径语义；seq=序列帧目录语义（srcPath/srcName/parent 含义不同）
    varScope: { type: String, default: 'output' }
  },
  computed: {
    chips () {
      if (!this.ctx) { return [] }
      return VAR_KEYS.map(function (k, idx) {
        return { key: k, i: idx + 1, value: String(this.ctx[k] || '') }
      }, this)
    }
  },
  methods: {
    onInput (v) {
      this.$emit('input', v)
    },
    tipFor (v) {
      const cap = v.key.charAt(0).toUpperCase() + v.key.slice(1)
      const scoped = 'varTip' + (this.varScope === 'seq' ? 'Seq' : '') + cap
      const base = 'varTip' + cap
      const desc = this.$te(scoped) ? this.$t(scoped) : (this.$te(base) ? this.$t(base) : v.key)
      return desc + '\n' + this.$t('varTipCurrent') + ': ' + (v.value || '—')
    }
  }
}
</script>

<style lang="scss">
@import "../styles/pathvars.scss";
</style>
