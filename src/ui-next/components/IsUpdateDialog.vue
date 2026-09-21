<template>
  <is-dialog
    :visible="visible"
    :title="$t('updateDialogTitle')"
    width="480px"
    @update:visible="onVisible"
  >
    <div class="upd">
      <p class="upd__head">
        {{ $t('updateAvailable', { latest: 'v' + (latest || ''), current: 'v' + (current || '') }) }}
      </p>
      <p v-if="needsGatekeeperHint" class="upd__hint">{{ $t('updateMacHint') }}</p>
      <div class="upd__notes">
        <p class="upd__notes-title">{{ $t('updateNotesTitle') }}</p>
        <pre v-if="notes" class="upd__notes-body">{{ notes }}</pre>
        <p v-else class="upd__notes-empty">{{ $t('updateNotesEmpty') }}</p>
      </div>
      <div v-if="autoSupported && autoDownloading" class="upd__progress-block">
        <p class="upd__hint">{{ $t('updateDownloading') }}</p>
        <is-progress
          :percent="autoProgress"
          :active="true"
          :label="$t('updateDownloading')"
        />
      </div>
      <div v-else-if="autoSupported && autoDownloaded" class="upd__progress-block">
        <p class="upd__hint">{{ $t('updateDownloaded') }}</p>
        <is-progress :percent="100" :done="true" :show-percent="true" :label="$t('updateDownloaded')" />
      </div>
      <p v-else-if="autoReason === 'dev'" class="upd__hint upd__hint--muted">{{ $t('updateAutoDev') }}</p>
      <p v-else-if="!autoSupported" class="upd__hint upd__hint--muted">{{ $t('updateAutoUnsupported') }}</p>
    </div>
    <template #footer>
      <is-button @click="onLater">{{ $t('updateLater') }}</is-button>
      <is-button @click="onSkip">{{ $t('updateSkipVersion') }}</is-button>
      <is-button
        v-if="autoSupported && autoDownloaded"
        type="primary"
        @click="onRestart"
      >{{ $t('updateRestartNow') }}</is-button>
      <is-button
        v-else
        type="primary"
        @click="onDownload"
      >{{ $t('updateGoDownload') }}</is-button>
    </template>
  </is-dialog>
</template>

<script>
import IsDialog from './ui/IsDialog.vue'
import IsProgress from './ui/IsProgress.vue'

export default {
  name: 'IsUpdateDialog',
  components: { IsDialog, IsProgress },
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
    onRestart () {
      this.$emit('restart')
    }
  }
}
</script>

<style lang="scss">
/* 布局样式收敛 ui.scss（.upd-*），此处不写组件内布局 */
</style>
