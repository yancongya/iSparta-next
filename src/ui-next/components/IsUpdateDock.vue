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
          :spin="phase === 'downloading' || (phase === 'installing' && !isCepInstalling)"
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
        v-if="phase === 'downloading' || phase === 'downloaded' || (phase === 'installing' && !isCepInstalling)"
        class="is-update-dock__progress"
        :percent="autoProgress"
        :active="phase === 'downloading' || (phase === 'installing' && !isCepInstalling)"
        :done="phase === 'downloaded'"
        :show-percent="phase !== 'installing'"
        :label="phase === 'installing' ? $t('updateInstalling') : $t('updateDownloading')"
      />

      <div class="is-update-dock__acts">
        <!-- 安装进行中：面板必须给反馈（静默安装期间没有任何原生界面）。
             CEP 已 detached 起安装包后进入「已启动」终态：不再无限转圈，
             只留一个不可点的状态按钮，避免用户重复触发安装。 -->
        <template v-if="phase === 'installing'">
          <div class="is-update-dock__spacer" />
          <is-button size="sm" type="primary" :disabled="true">
            {{ isCepInstalling ? $t('updateCepInstallStarted') : $t('updateInstalling') }}
          </is-button>
        </template>
        <template v-else>
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
          >{{ isCepInstaller ? $t('updateRunInstaller') : $t('updateRestartNow') }}</is-button>
          <is-button
            v-else-if="phase === 'available' || phase === 'error'"
            size="sm"
            type="primary"
            @click="$emit('update')"
          >{{ primaryLabel }}</is-button>
        </template>
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
    /**
     * CEP 安装包形态（auto.mode === 'installer'）：面板内下的是同一个官方安装包，
     * 终态按钮是「运行安装包」而不是「重启以更新」——AE 不能被安装包重启。
     */
    isCepInstaller () {
      return !!(this.auto && this.auto.mode === 'installer')
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
    /**
     * 安装进行中。两个来源：
     *   · installing —— 桌面：已请求主进程延迟关闭应用进安装（见 updateService）
     *   · launched   —— CEP：已 detached 起静默安装包，等用户重启 AE 生效
     * 两者都必须让面板停在 loading 态：静默安装期间没有任何原生界面，
     * 不显示就等于「点了没反应」。
     */
    autoInstalling () {
      return !!(this.auto && (this.auto.installing || this.auto.launched))
    },
    /**
     * CEP 已 detached 起静默安装包：进入「已启动」终态（check 图标 + 无转圈），
     * 而不是像桌面 quitAndInstall 那样仍在「安装中」（loader 转圈）。
     */
    isCepInstalling () {
      return this.isCepInstaller && this.autoInstalling
    },
    autoProgress () {
      return (this.auto && this.auto.progress) || 0
    },
    phase () {
      if (this.autoInstalling) return 'installing'
      if (this.autoDownloaded) return 'downloaded'
      if (this.autoDownloading) return 'downloading'
      if (this.autoError && this.autoSupported) return 'error'
      return 'available'
    },
    primaryLabel () {
      return this.autoSupported ? this.$t('updateDockUpdate') : this.$t('updateGoDownload')
    },
    headIcon () {
      if (this.phase === 'installing') return this.isCepInstalling ? 'check-circle' : 'loader'
      if (this.phase === 'downloaded') return 'check-circle'
      if (this.phase === 'error') return 'alert'
      if (this.phase === 'downloading') return 'download'
      return 'sparkles'
    },
    headTitle () {
      if (this.phase === 'installing') return this.$t('updateInstallingApp')
      if (this.phase === 'downloaded') return this.$t('updateReadyTitle')
      if (this.phase === 'error') return this.$t('updateDownloadFailed')
      if (this.phase === 'downloading') return this.$t('updateDownloading')
      return this.$t('updateDialogTitle')
    },
    headSub () {
      var pair = 'v' + this.latest + ' ← v' + this.current
      if (this.phase === 'installing') {
        // CEP 装完 AE 不会自重启，必须明确让用户重启面板宿主
        return this.isCepInstaller ? this.$t('updateInstallingCep') : this.$t('updateInstallingBody')
      }
      if (this.phase === 'downloaded') {
        return this.isCepInstaller ? this.$t('updateCepDownloaded') : this.$t('updateDownloaded')
      }
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
