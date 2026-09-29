<template>
  <is-dialog
    :visible="visible"
    :title="$t('logTitle')"
    width="100%"
    panel-class="log-panel"
    root-class="log-dialog"
    @close="$emit('close')"
  >
    <template #title>
      <span class="log-title">
        <span class="log-title__dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="log-title__name">{{ $t('logTitle') }}</span>
        <span class="log-title__count mono">{{ shown.length }} / {{ entries.length }}</span>
      </span>
    </template>

    <div class="log">
      <div class="log__bar" role="group" :aria-label="$t('logFilter')">
        <div class="log__chips">
          <button
            v-for="f in filters"
            :key="f"
            type="button"
            class="log__chip"
            :class="{ 'is-on': filter === f }"
            @click="filter = f"
          >
            {{ $t(levelKey(f)) }}
            <span v-if="f !== 'all' && counts[f]" class="log__chip-n mono">{{ counts[f] }}</span>
          </button>
        </div>
        <is-checkbox v-model="follow" class="log__follow">{{ $t('logFollow') }}</is-checkbox>
      </div>

      <is-scroll-fade ref="list" class="log__list" tabindex="0" :aria-label="$t('logTitle')">
        <p v-if="!shown.length" class="log__empty">{{ $t('logEmpty') }}</p>
        <div
          v-for="e in shown"
          :key="e.id"
          class="log__row"
          :class="'log__row--' + e.level"
          :title="fullText(e)"
        >
          <span class="log__t mono">{{ e.t }}</span>
          <span class="log__lv mono">{{ e.level }}</span>
          <span class="log__msg">{{ e.msg }}<span v-if="e.detail" class="log__detail mono">{{ e.detail }}</span></span>
        </div>
      </is-scroll-fade>
    </div>

    <template #footer>
      <button type="button" class="log__act" @click="copyAll">
        <is-icon name="save" size="sm" />{{ $t('logCopy') }}
      </button>
      <button type="button" class="log__act log__act--danger" @click="clear">
        <is-icon name="trash" size="sm" />{{ $t('logClear') }}
      </button>
    </template>
  </is-dialog>
</template>

<!--
  全局运行日志面板：工具条上的日志按钮打开。
  自动跟随滚动只在用户本来就停在底部时生效——否则用户往上翻看历史时会被强行拽走。
  条目单行省略（悬停 title 看全文），筛选 chips 固定一行；面板在 CEP 小屏铺满可用区。
-->
<script>
import IsDialog from './ui/IsDialog.vue'
import IsIcon from './ui/IsIcon.vue'
import IsCheckbox from './ui/IsCheckbox.vue'
import log from '../log'

export default {
  name: 'IsLogPanel',
  components: { IsDialog, IsIcon, IsCheckbox },
  props: {
    visible: { type: Boolean, default: false }
  },
  data () {
    return {
      filters: ['all', 'info', 'ok', 'warn', 'error'],
      filter: 'all',
      follow: true
    }
  },
  computed: {
    entries () {
      return log.state.entries
    },
    shown () {
      if (this.filter === 'all') { return this.entries }
      return this.entries.filter((e) => e.level === this.filter)
    },
    counts () {
      var c = { info: 0, ok: 0, warn: 0, error: 0 }
      this.entries.forEach(function (e) { if (c[e.level] !== undefined) { c[e.level] += 1 } })
      return c
    }
  },
  watch: {
    visible (v) {
      if (v) {
        log.markRead()
        this.$nextTick(this.scrollToEnd)
      }
    },
    'entries.length' () {
      if (this.visible && this.follow) {
        this.$nextTick(this.scrollToEnd)
      }
    },
    filter () {
      this.$nextTick(this.scrollToEnd)
    }
  },
  methods: {
    // 本仓库字典是扁平键，vue-i18n 会把「logLevel.all」当路径解析，故显式映射
    levelKey (f) {
      return { all: 'logLvAll', info: 'logLvInfo', ok: 'logLvOk', warn: 'logLvWarn', error: 'logLvError' }[f] || 'logLvAll'
    },
    fullText (e) {
      return e.detail ? e.msg + ' · ' + e.detail : e.msg
    },
    scrollToEnd () {
      var host = this.$refs.list
      var el = host && (host.$el || host)
      if (el && el.scrollTop !== undefined) { el.scrollTop = el.scrollHeight }
      if (host && typeof host.scrollToBottom === 'function') { host.scrollToBottom() }
    },
    clear () {
      log.clear()
    },
    copyAll () {
      var text = log.toText()
      if (!text) { return }
      var done = () => { this.$emit('copied') }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => this.fallbackCopy(text, done))
      } else {
        this.fallbackCopy(text, done)
      }
    },
    // sandbox 渲染进程里 navigator.clipboard 可能因缺少焦点/权限而 reject，
    // execCommand 虽已废弃但在 Electron 内仍可用，作为兜底
    fallbackCopy (text, done) {
      var ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        done()
      } catch (e) { /* 复制失败时不打断用户 */ }
      document.body.removeChild(ta)
    }
  }
}
</script>
