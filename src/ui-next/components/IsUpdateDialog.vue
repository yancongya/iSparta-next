<template>
  <is-dialog
    :visible="visible"
    :hide-header="true"
    :show-close="false"
    panel-class="upd-panel"
    width="440px"
    :title="readyHead"
    @update:visible="onVisible"
  >
    <div class="upd">
      <div class="upd__hero">
        <span class="upd__icon" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 1024 1024" fill="none">
            <g transform="translate(512 512) scale(2.05) translate(-512 -395.636364)">
              <path d="M512 395.636364m-232.727273 0a232.727273 232.727273 0 1 0 465.454546 0 232.727273 232.727273 0 1 0-465.454546 0Z" fill="#c8f542"/>
              <path d="M453.806545 289.764848a7.214545 7.214545 0 0 1 8.168728-6.112969l77.548606 11.155394c1.881212 0.271515 3.580121 1.272242 4.728242 2.788848l70.943031 93.796849a7.214545 7.214545 0 0 1 0.100848 8.564363L544.267636 498.722909a7.214545 7.214545 0 0 1-4.871757 2.936243L461.459394 512.391758a7.214545 7.214545 0 0 1-6.997333-11.132122l67.285333-101.558303a7.214545 7.214545 0 0 0-0.077576-8.079515L455.00897 294.888727a7.214545 7.214545 0 0 1-1.202425-5.12z m-6.729697 37.783273a3.607273 3.607273 0 0 1 5.054061 0.702061l47.736243 63.146666a7.214545 7.214545 0 0 1 0.104727 8.556607L452.189091 466.540606a3.607273 3.607273 0 0 1-6.543515-2.102303V330.426182a3.607273 3.607273 0 0 1 1.435151-2.878061z" fill="#0c0f0e"/>
            </g>
          </svg>
        </span>
        <h2 class="upd__title">{{ readyHead }}</h2>
        <p class="upd__sub">
          {{ $t('updateAvailable', { latest: 'v' + (latest || ''), current: 'v' + (current || '') }) }}
        </p>
      </div>

      <is-alert v-if="needsGatekeeperHint" variant="warning" :description="$t('updateMacHint')" />

      <is-scroll-fade v-if="noteItems.length" class="upd__notes-fade">
        <ul class="upd__list">
          <li
            v-for="(item, i) in noteItems"
            :key="i"
            :class="item.kind === 'group' ? 'upd__list-group' : 'upd__list-item'"
          >{{ item.text }}</li>
        </ul>
      </is-scroll-fade>
      <p v-else class="upd__notes-empty">{{ $t('updateNotesEmpty') }}</p>

      <div v-if="autoSupported && autoDownloading" class="upd__progress-block">
        <is-progress
          :percent="autoProgress"
          :active="true"
          :label="$t('updateDownloading')"
        />
      </div>
      <div v-else-if="autoSupported && autoDownloaded" class="upd__progress-block">
        <is-progress :percent="100" :done="true" :show-percent="true" :label="$t('updateDownloaded')" />
      </div>

      <is-alert
        v-else-if="autoReason === 'dev' || !autoSupported"
        variant="info"
        :description="installFootnote"
      />
      <p v-else class="upd__footnote">{{ installFootnote }}</p>
    </div>

    <template #footer>
      <div class="upd__acts">
        <div class="upd__acts-left">
          <is-button type="text" @click="onSkip">{{ $t('updateSkipVersion') }}</is-button>
        </div>
        <div class="upd__acts-right">
          <is-button @click="onLater">{{ $t('updateLater') }}</is-button>
          <is-button
            v-if="autoSupported && autoDownloaded"
            type="primary"
            @click="onRestart"
          >{{ $t('updateRestartNow') }}</is-button>
          <is-button
            v-else-if="autoSupported && autoDownloading"
            type="primary"
            :disabled="true"
          >{{ $t('updateDownloading') }}</is-button>
          <is-button
            v-else-if="autoSupported"
            type="primary"
            @click="onUpdate"
          >{{ $t('updateDockUpdate') }}</is-button>
          <is-button
            v-else
            type="primary"
            @click="onDownload"
          >{{ $t('updateGoDownload') }}</is-button>
        </div>
      </div>
    </template>
  </is-dialog>
</template>

<script>
import IsDialog from './ui/IsDialog.vue'
import IsProgress from './ui/IsProgress.vue'
import IsScrollFade from './ui/IsScrollFade.vue'
import IsAlert from './ui/IsAlert.vue'

export default {
  name: 'IsUpdateDialog',
  components: { IsDialog, IsProgress, IsScrollFade, IsAlert },
  props: {
    visible: { type: Boolean, default: false },
    result: { type: Object, default: null },
    auto: { type: Object, default: null }
  },
  computed: {
    latest () {
      return (this.result && this.result.latest) || ''
    },
    current () {
      return (this.result && this.result.current) || ''
    },
    notes () {
      return (this.result && this.result.notes) || ''
    },
    needsGatekeeperHint () {
      return !!(this.result && this.result.needsGatekeeperHint)
    },
    autoSupported () {
      return !!(this.auto && this.auto.supported)
    },
    autoReason () {
      return (this.auto && this.auto.reason) || ''
    },
    autoDownloading () {
      return !!(this.auto && this.auto.downloading)
    },
    autoDownloaded () {
      return !!(this.auto && this.auto.downloaded)
    },
    autoProgress () {
      return (this.auto && this.auto.progress) || 0
    },
    readyHead () {
      return this.$t('updateReadyHead', { ver: 'v' + (this.latest || '') })
    },
    noteItems () {
      var raw = this.notes
      if (!raw) { return [] }
      return String(raw).split(/\r?\n/).map(function (line) {
        var t = String(line).trim()
        if (!t) { return null }
        if (/^【.+】$/.test(t)) { return { kind: 'group', text: t } }
        return { kind: 'item', text: t.replace(/^·\s*/, '') }
      }).filter(Boolean)
    },
    installFootnote () {
      if (this.autoSupported && this.autoDownloaded) { return this.$t('updateInstallingBody') }
      if (this.autoReason === 'dev') { return this.$t('updateAutoDev') }
      if (!this.autoSupported) { return this.$t('updateAutoUnsupported') }
      return this.$t('updateDockContinue')
    }
  },
  methods: {
    onVisible (v) {
      if (!v) { this.$emit('later') }
    },
    onLater () {
      this.$emit('later')
    },
    onSkip () {
      this.$emit('skip')
    },
    onDownload () {
      this.$emit('download')
    },
    onUpdate () {
      this.$emit('update')
    },
    onRestart () {
      this.$emit('restart')
    }
  }
}
</script>

<style lang="scss">
/* 布局样式收敛 ui.scss（.upd-*），此处不写组件内布局 */
</style>
