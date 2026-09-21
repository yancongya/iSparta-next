<template>
  <transition name="is-update-dock">
    <div
      v-if="visible"
      class="is-update-dock"
      :class="'is-update-dock--' + phase"
      role="status"
      aria-live="polite"
    >
      <div class="is-update-dock__head">
        <is-icon
          class="is-update-dock__icon"
          :name="headIcon"
          :spin="phase === 'downloading'"
          size="lg"
        />
        <div class="is-update-dock__head-text">
          <strong class="is-update-dock__title">{{ headTitle }}</strong>
          <p class="is-update-dock__sub">{{ headSub }}</p>
        </div>
        <button
          type="button"
          class="is-update-dock__close"
          :aria-label="$t('close')"
          @click="$emit('later')"
        ><is-icon name="close" size="sm" /></button>
      </div>

      <is-progress
        v-if="phase === 'downloading' || phase === 'downloaded'"
        class="is-update-dock__progress"
        :percent="autoProgress"
        :active="phase === 'downloading'"
        :done="phase === 'downloaded'"
        :show-percent="true"
        :label="$t('updateDownloading')"
      />

      <div class="is-update-dock__acts">
        <is-button
          v-if="phase !== 'downloading'"
          size="sm"
          type="text"
          @click="$emit('details')"
        >{{ $t('updateDockDetails') }}</is-button>
        <is-button
          v-if="phase === 'available' || phase === 'error'"
          size="sm"
          type="text"
          @click="$emit('later')"
        >{{ $t('updateLater') }}</is-button>

        <div class="is-update-dock__spacer" />

        <is-button
          v-if="phase === 'downloaded'"
          size="sm"
          type="primary"
          @click="$emit('restart')"
        >{{ $t('updateRestartNow') }}</is-button>
        <is-button
          v-else-if="phase === 'available' || phase === 'error'"
          size="sm"
          type="primary"
          @click="$emit('update')"
        >{{ primaryLabel }}</is-button>
      </div>
    </div>
  </transition>
</template>

<script>
import IsIcon from './ui/IsIcon.vue'
import IsButton from './ui/IsButton.vue'
import IsProgress from './ui/IsProgress.vue'

export default {
  name: 'IsUpdateDock',
  components: { IsIcon, IsButton, IsProgress },
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
    autoSupported () {
      return !!(this.auto && this.auto.supported)
    },
    autoDownloading () {
      return !!(this.auto && this.auto.downloading)
    },
    autoDownloaded () {
      return !!(this.auto && this.auto.downloaded)
    },
    autoError () {
      return !!(this.auto && this.auto.error)
    },
    autoProgress () {
      return (this.auto && this.auto.progress) || 0
    },
    phase () {
      if (this.autoDownloaded) return 'downloaded'
      if (this.autoDownloading) return 'downloading'
      if (this.autoError && this.autoSupported) return 'error'
      return 'available'
    },
    primaryLabel () {
      return this.autoSupported ? this.$t('updateDockUpdate') : this.$t('updateGoDownload')
    },
    headIcon () {
      if (this.phase === 'downloaded') return 'check-circle'
      if (this.phase === 'error') return 'alert'
      if (this.phase === 'downloading') return 'download'
      return 'sparkles'
    },
    headTitle () {
      if (this.phase === 'downloaded') return this.$t('updateReadyTitle')
      if (this.phase === 'error') return this.$t('updateDownloadFailed')
      if (this.phase === 'downloading') return this.$t('updateDownloading')
      return this.$t('updateDialogTitle')
    },
    headSub () {
      var pair = 'v' + this.latest + ' ← v' + this.current
      if (this.phase === 'downloaded') return this.$t('updateDownloaded')
      if (this.phase === 'error') return this.$t('updateAutoUnsupported')
      if (this.phase === 'downloading') return this.$t('updateDockContinue') + ' · ' + pair
      return this.$t('updateAvailable', {
        latest: 'v' + this.latest,
        current: 'v' + this.current
      })
    }
  }
}
</script>
