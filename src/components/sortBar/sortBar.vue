<template>
  <section class="mod-bar">
    <is-checkbox
      class="bar-selectall"
      :value="allChecked"
      :indeterminate="indeterminate"
      :disabled="isLocked"
      @change="toggleAll"
    >{{ $t('selectAll') }}</is-checkbox>

    <span class="bar-label">
      {{ $t('inputItems') }}
      <b class="bar-count">{{ itemCount }}</b>
    </span>

    <!-- 统计：一眼看出成功/失败/进行中，不必逐条扫列表 -->
    <span v-if="itemCount" class="bar-stats">
      <span v-if="doneCount" class="bar-stat is-done" :title="$t('statDone')">
        <is-icon name="check-circle" size="sm" />{{ doneCount }}
      </span>
      <span v-if="failCount" class="bar-stat is-fail" :title="$t('statFail')">
        <is-icon name="x-circle" size="sm" />{{ failCount }}
      </span>
      <span v-if="runningCount" class="bar-stat is-running" :title="$t('statRunning')">
        <is-icon name="loader" size="sm" spin />{{ runningCount }}
      </span>
    </span>

    <!-- 总进度 -->
    <div v-if="itemCount" class="bar-total" :title="$t('totalProgress')">
      <span class="bar-total__fill" :class="{ 'is-shimmer': runningCount > 0 }" :style="{ width: totalPercent + '%' }"></span>
    </div>

    <span class="bar-shortcuts">
      <span class="is-kbd-group">
        <kbd class="is-kbd" :class="{ 'is-pressed': pressed === 'Control' }">Ctrl</kbd>
        <span>+</span>
        <kbd class="is-kbd" :class="{ 'is-pressed': pressed === 'a' }">A</kbd>
      </span>
      <span class="is-kbd-group">
        <kbd class="is-kbd" :class="{ 'is-pressed': pressed === 'Control' }">Ctrl</kbd>
        <span>+</span>
        <kbd class="is-kbd" :class="{ 'is-pressed': isDelKey }">Del</kbd>
      </span>
    </span>
  </section>
</template>

<script>
export default {
  data () {
    return { pressed: '' }
  },
  computed: {
    items () {
      return this.$store.getters.getterItems
    },
    itemCount () {
      return this.items.length
    },
    isLocked () {
      return this.$store.getters.getterLocked
    },
    selectedCount () {
      return this.$store.getters.getterSelected.length
    },
    allChecked () {
      return this.itemCount > 0 && this.selectedCount === this.itemCount
    },
    indeterminate () {
      return this.selectedCount > 0 && this.selectedCount < this.itemCount
    },
    doneCount () {
      return this.countBy(1)
    },
    failCount () {
      return this.countBy(-1)
    },
    runningCount () {
      var n = 0
      this.items.forEach(function (it) {
        var s = it.process && it.process.schedule
        if (s > 0 && s < 1) n++
      })
      return n
    },
    // 已完成条目按 1 计，进行中按实际 schedule 计，得到整体完成度
    totalPercent () {
      if (!this.itemCount) return 0
      var sum = 0
      this.items.forEach(function (it) {
        var s = it.process && it.process.schedule
        if (s === 1 || s === -1) sum += 1
        else if (s > 0 && s < 1) sum += s
      })
      return Math.round((sum / this.itemCount) * 100)
    },
    isDelKey () {
      return this.pressed === 'Delete' || this.pressed === 'Backspace'
    }
  },
  mounted () {
    this._onKey = (e) => { this.pressed = e.key }
    this._onKeyUp = () => { this.pressed = '' }
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('keyup', this._onKeyUp)
  },
  beforeDestroy () {
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('keyup', this._onKeyUp)
  },
  methods: {
    countBy (schedule) {
      var n = 0
      this.items.forEach(function (it) {
        if (it.process && it.process.schedule === schedule) n++
      })
      return n
    },
    toggleAll () {
      if (this.isLocked) {
        return false
      }
      if (this.allChecked) {
        this.$store.dispatch('noneSelect')
      } else {
        this.$store.dispatch('allSelect')
      }
    }
  }
}
</script>

<style lang="scss">
@import "./sortBar.scss";
</style>
