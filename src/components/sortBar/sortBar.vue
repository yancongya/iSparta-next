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
      <b class="bar-count"><is-number-tween :value="itemCount" /></b>
    </span>

    <!-- 统计：一眼看出成功/失败/进行中，不必逐条扫列表 -->
    <span v-if="itemCount" class="bar-stats">
      <span v-if="doneCount" class="bar-stat is-done" :title="$t('statDone')">
        <is-icon name="check-circle" size="sm" /><is-number-tween :value="doneCount" />
      </span>
      <span v-if="failCount" class="bar-stat is-fail" :title="$t('statFail')">
        <is-icon name="x-circle" size="sm" /><is-number-tween :value="failCount" />
      </span>
      <span v-if="runningCount" class="bar-stat is-running" :title="$t('statRunning')">
        <is-pacman size="xs" :dot-count="2" :label="$t('statRunning')" /><is-number-tween :value="runningCount" />
      </span>
    </span>

    <!-- 总进度 -->
    <div v-if="itemCount" class="bar-progress">
      <div class="bar-total" :title="$t('totalProgress')">
        <span class="bar-total__fill" :class="{ 'is-shimmer': runningCount > 0 }" :style="{ width: totalPercent + '%' }"></span>
      </div>
    </div>

    <div class="bar-kbd">
      <button
        type="button"
        class="bar-kbd__btn"
        :class="{ 'is-on': shortcutsOpen }"
        :title="$t('shortcutTip')"
        :aria-expanded="shortcutsOpen ? 'true' : 'false'"
        @click.stop="shortcutsOpen = !shortcutsOpen"
      >
        <is-icon name="keyboard" size="sm" />
      </button>
      <transition name="is-fade">
        <div v-if="shortcutsOpen" class="bar-kbd__panel" @click.stop>
          <div class="bar-kbd__row">
            <span class="is-kbd-group">
              <kbd class="is-kbd">Ctrl</kbd><span>+</span><kbd class="is-kbd">A</kbd>
            </span>
            <span>{{ $t('selectAll') }}</span>
          </div>
          <div class="bar-kbd__row">
            <span class="is-kbd-group">
              <kbd class="is-kbd">Delete</kbd>
            </span>
            <span>{{ $t('shortcutDelete') }}</span>
          </div>
          <div class="bar-kbd__row">
            <span class="is-kbd-group">
              <kbd class="is-kbd">Ctrl</kbd><span>+</span><kbd class="is-kbd">V</kbd>
            </span>
            <span>{{ $t('pasteHint') }}</span>
          </div>
          <div class="bar-kbd__row bar-kbd__row--plain">
            <span>{{ $t('shortcutBlankClick') }}</span>
          </div>
        </div>
      </transition>
    </div>
  </section>
</template>

<script>
import confetti from '../../ui-next/confetti'
import IsPacman from '../../ui-next/components/IsPacman.vue'

export default {
  components: { 'is-pacman': IsPacman },
  data () {
    return {
      pressed: '',
      shortcutsOpen: false
    }
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
    }
  },
  mounted () {
    this._onDocClick = (e) => {
      if (!this.shortcutsOpen) return
      var host = this.$el
      if (host && host.contains && !host.contains(e.target)) {
        this.shortcutsOpen = false
      }
    }
    document.addEventListener('click', this._onDocClick)
  },
  watch: {
    // 彩带防误触发：只有本会话里真的有任务跑起来过才庆祝。
    // 否则「删除唯一未完成项凑成 100%」这种收尾也会放烟花。
    runningCount (n) {
      if (n > 0) { this._wasRunning = true }
    },
    itemCount (n) {
      if (n === 0) { this._wasRunning = false }
    },
    totalPercent (nv, ov) {
      if (nv === 100 && ov !== 100 && this.itemCount && this._wasRunning) {
        this._wasRunning = false
        confetti.celebrate()
      }
    }
  },
  beforeDestroy () {
    if (this._onDocClick) {
      document.removeEventListener('click', this._onDocClick)
      this._onDocClick = null
    }
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
