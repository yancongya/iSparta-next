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

    <div class="bar-actions">
      <button
        type="button"
        class="bar-icon-btn bar-start"
        :class="{ 'is-running': isConverting }"
        :title="startTitle"
        :disabled="!canStart"
        @click.stop="startSelected"
      >
        <is-icon :name="isConverting ? 'loader' : 'play'" :spin="isConverting" size="sm" />
      </button>
      <div class="bar-kbd">
        <button
          type="button"
          class="bar-icon-btn bar-kbd__btn"
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
              <span>{{ $t(isCepHost ? 'shortcutClearSelect' : 'shortcutDelete') }}</span>
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
    </div>
  </section>
</template>

<script>
import confetti from '../../ui-next/confetti'
import IsPacman from '../../ui-next/components/IsPacman.vue'
import processor from '../../util/processor'
import notice from '../../ui-next/notice'
import hostAdapter from '../../util/host-env'

export default {
  components: { 'is-pacman': IsPacman },
  data () {
    return {
      pressed: '',
      shortcutsOpen: false
    }
  },
  computed: {
    isCepHost () {
      return !!(hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep'))
    },
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
    isConverting () {
      return this.isLocked
    },
    // 与设置页一致：未锁定，且每个勾选项都至少有一种输出格式
    canStart () {
      if (this.isLocked || !this.selectedCount) return false
      return this.$store.getters.getterSelected.every(function (it) {
        var fmt = it.options && it.options.outputFormat
        return !!(fmt && fmt.length)
      })
    },
    startTitle () {
      return this.isConverting ? this.$t('startConvert') : this.$t('start')
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
    },
    // 与设置页「开始」同一条转换链：只跑勾选项
    startSelected () {
      if (!this.canStart) return
      var selected = this.$store.getters.getterSelected
      var locale = this.$i18n.messages[this.$i18n.locale]
      for (var i = 0; i < selected.length; i++) {
        this.$store.dispatch('editProcess', {
          index: i,
          text: '',
          schedule: 0
        })
      }
      var self = this
      setTimeout(function () {
        self.$store.dispatch('setLock', true)
        processor(self.$store, '', locale)
          .then(function () {
            self.$store.dispatch('setLock', false)
            self.reportResult()
          })
          .catch(function (err) {
            console.warn('convert error:', err)
            self.$store.dispatch('setLock', false)
            notice.error(self.$t('noticeConvertAborted'), err && err.message)
          })
      }, 20)
    },
    reportResult () {
      var items = this.$store.getters.getterItems
      var ok = 0
      var fail = 0
      items.forEach(function (it) {
        var s = it.process && it.process.schedule
        if (s === 1) ok++
        else if (s === -1) fail++
      })
      if (fail) {
        notice.warning(this.$t('noticeDone'), this.$t('resultSummary', { ok: ok, fail: fail }))
      } else if (ok) {
        notice.success(this.$t('noticeAllDone'), this.$t('resultSummary', { ok: ok, fail: 0 }))
      }
    }
  }
}
</script>

<style lang="scss">
@import "./sortBar.scss";
</style>
