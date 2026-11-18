<template>
  <is-dialog
    :visible="visible"
    :hide-header="true"
    :show-close="false"
    :panel-class="panelClass"
    :width="dialogWidth"
    :root-class="rootClass"
    :title="heroHead"
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
        <h2 class="upd__title">{{ heroHead }}</h2>
        <p class="upd__sub">
          {{ heroSub }}
        </p>
      </div>

      <is-alert v-if="needsGatekeeperHint" variant="warning" :description="$t('updateMacHint')" />

      <template v-if="noteItems.length">
        <is-scroll-fade class="upd__notes-fade" :class="{ 'is-expanded': notesExpanded }">
          <ul class="upd__list">
            <li
              v-for="(item, i) in visibleNoteItems"
              :key="i"
              :class="item.kind === 'group' ? 'upd__list-group' : 'upd__list-item'"
            >{{ item.text }}</li>
          </ul>
        </is-scroll-fade>
        <button
          v-if="hasLongNotes"
          type="button"
          class="upd__notes-toggle"
          :aria-expanded="notesExpanded ? 'true' : 'false'"
          @click="notesExpanded = !notesExpanded"
        >{{ notesExpanded ? $t('updateNotesCollapse') : $t('updateNotesExpand') }}</button>
      </template>
      <p v-else class="upd__notes-empty">{{ $t('updateNotesEmpty') }}</p>

      <!-- 安装中：不能再显示「已下载 100%」——那是上一步的结论，
           这里换成进行中的进度 + 说明（走静默安装，界面是唯一的反馈） -->
      <div v-if="autoCompleted" class="upd__progress-block">
        <is-progress :percent="100" :done="true" :label="$t('updateInstallComplete')" />
        <p class="upd__footnote">{{ $t('updateRestartAe') }}</p>
      </div>
      <div v-else-if="autoInstalling" class="upd__progress-block">
        <!-- 不确定进度：显式关掉百分比，否则会写死成「100%」，看着像已完成 -->
        <is-progress
          :percent="100"
          :active="true"
          :show-percent="false"
          :label="$t('updateInstalling')"
        />
        <p class="upd__footnote">{{ installFootnote }}</p>
      </div>
      <div v-else-if="autoSupported && autoDownloading" class="upd__progress-block">
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
            v-if="autoCompleted"
            type="primary"
            :disabled="true"
          >{{ $t('updateInstallComplete') }}</is-button>
          <is-button
            v-else-if="autoInstalling"
            type="primary"
            :disabled="true"
          >{{ $t('updateInstalling') }}</is-button>
          <is-button
            v-else-if="autoSupported && autoDownloaded"
            type="primary"
            @click="onRestart"
          >{{ isCepInstaller ? $t('updateRunInstaller') : $t('updateRestartNow') }}</is-button>
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
import hostAdapter from '../../util/host-env'

export default {
  name: 'IsUpdateDialog',
  components: { IsDialog, IsProgress, IsScrollFade, IsAlert },
  props: {
    visible: { type: Boolean, default: false },
    result: { type: Object, default: null },
    auto: { type: Object, default: null }
  },
  data () {
    return { notesExpanded: false }
  },
  computed: {
    /** CEP 面板内让更新弹窗铺满可用宽度（桌面仍用 440px 居中卡片） */
    isCep () { return hostAdapter.kind === 'cep' },
    dialogWidth () { return this.isCep ? '100%' : '440px' },
    rootClass () { return this.isCep ? 'upd-dialog' : '' },
    panelClass () { return this.isCep ? 'upd-panel upd-panel--full' : 'upd-panel' },
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
    /** CEP 安装包形态（auto.mode === 'installer'）：终态是「运行安装包」，装完需重启 AE */
    isCepInstaller () {
      return !!(this.auto && this.auto.mode === 'installer')
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
    /** 安装进行中（桌面：已请求关闭应用进安装；CEP：已 detached 起静默安装包） */
    autoInstalling () {
      return !!(this.auto && (this.auto.installing || this.auto.launched))
    },
    autoCompleted () {
      return !!(this.auto && this.auto.completed)
    },
    autoProgress () {
      return (this.auto && this.auto.progress) || 0
    },
    readyHead () {
      return this.$t('updateReadyHead', { ver: 'v' + (this.latest || '') })
    },
    /** 头部标题：安装中必须换掉「已就绪」，否则和下面的「正在安装」自相矛盾 */
    heroHead () {
      if (this.autoCompleted) return this.$t('updateInstallComplete')
      return this.autoInstalling ? this.$t('updateInstallingApp') : this.readyHead
    },
    /** 头部副标题：安装中不再说「发现新版本」，改为版本对照 */
    heroSub () {
      if (this.autoInstalling) {
        return 'v' + (this.latest || '') + ' ← v' + (this.current || '')
      }
      return this.$t('updateAvailable', { latest: 'v' + (this.latest || ''), current: 'v' + (this.current || '') })
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
    /**
     * formatReleaseNotes 输出形如「摘要行… ＋ 【分组】行…」：
     * 第一个【分组】之前的行是首屏 3–6 条摘要，之后是折叠区详细分组。
     * 据此把说明拆成「简述 / 详细」两段，默认只显示简述。
     */
    noteBrief () {
      var out = []
      for (var i = 0; i < this.noteItems.length; i++) {
        if (this.noteItems[i].kind === 'group') break
        out.push(this.noteItems[i])
      }
      return out
    },
    noteDetail () {
      var out = []
      var seen = false
      for (var i = 0; i < this.noteItems.length; i++) {
        if (this.noteItems[i].kind === 'group') { seen = true }
        if (seen) out.push(this.noteItems[i])
      }
      return out
    },
    hasLongNotes () { return this.noteDetail.length > 0 },
    visibleNoteItems () { return this.notesExpanded ? this.noteItems : this.noteBrief },
    installFootnote () {
      if (this.autoCompleted) return this.$t('updateRestartAe')
      if (this.autoInstalling) {
        return this.isCepInstaller ? this.$t('updateInstallingCep') : this.$t('updateInstallingBody')
      }
      if (this.autoSupported && this.autoDownloaded) {
        return this.isCepInstaller ? this.$t('updateCepDownloaded') : this.$t('updateInstallingBody')
      }
      if (this.autoReason === 'dev') { return this.$t('updateAutoDev') }
      if (!this.autoSupported) { return this.$t('updateAutoUnsupported') }
      if (this.isCepInstaller) { return this.$t('updateCepInstallerBody') }
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
