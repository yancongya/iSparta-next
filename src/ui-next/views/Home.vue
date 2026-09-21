<template>
  <div
    class="ib"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <globalsetting></globalsetting>
    <is-notice-host></is-notice-host>

    <!-- 空态：无任务时全屏导入 -->
    <section v-if="!items.length" class="ib-import">
      <div class="ib-import__top">
        <span class="ib-brand">{{ appName }}</span>
        <div class="ib-import__acts">
          <button type="button" class="ib-iconbtn" :title="$t('defaultSetting')" @click="openGlobalSetting">
            <is-icon name="settings" />
            <span v-if="updateBadge" class="ib-rail__badge" aria-hidden="true" />
          </button>
          <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
            <is-icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
      <div
        class="ib-drop"
        :class="{ 'is-hot': dragging }"
        @click="onPick"
      >
        <div class="ib-drop__icon">
          <is-icon :name="dragging ? 'download' : 'film'" size="xl" />
        </div>
        <p class="ib-drop__kicker">DROP · PASTE · CLICK</p>
        <h1>{{ $t('uploadTips') }}</h1>
        <p class="ib-drop__rule">{{ $t('uploadRule') }}</p>
        <span class="ib-drop__cta">{{ $t('openFolder') }}</span>
        <div class="ib-drop__kbd">
          <span class="is-kbd-group">
            <kbd class="is-kbd" :class="{ 'is-pressed': pressed === 'Control' }">Ctrl</kbd>
            <span>+</span>
            <kbd class="is-kbd" :class="{ 'is-pressed': pressed === 'v' }">V</kbd>
            <span>{{ $t('pasteHint') }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- 有任务：中列表 + 右设置 两栏 -->
    <section v-else class="ib-ws">
      <div class="ib-main">
        <div class="ib-main__list">
          <project-list></project-list>
        </div>
        <sort-bar></sort-bar>
      </div>

      <!-- 中间列：工具条 + 可拖拽分隔 -->
      <div
        class="ib-rail"
        :class="{ 'is-resizing': resizing }"
      >
        <button type="button" class="ib-rail__btn" :title="themeTitle" @click="toggleTheme">
          <is-icon :name="theme === 'dark' ? 'sun' : 'moon'" size="sm" />
        </button>

        <div class="ib-rail__lang">
          <button
            type="button"
            class="ib-rail__btn"
            :title="$t('language') + '：' + currentLangLabel"
            @click="langOpen = !langOpen"
          >
            <is-icon name="globe" size="sm" />
          </button>
          <transition name="is-fade">
            <div v-if="langOpen" class="ib-rail__pop" @mouseleave="langOpen = false">
              <button
                v-for="l in languages"
                :key="l.value"
                type="button"
                class="ib-rail__opt"
                :class="{ 'is-on': l.value === locale }"
                @click="pickLanguage(l.value)"
              >{{ l.label }}</button>
            </div>
          </transition>
        </div>

        <button type="button" class="ib-rail__btn" :title="$t('defaultSetting')" @click="openGlobalSetting">
          <is-icon name="settings" size="sm" />
          <span v-if="updateBadge" class="ib-rail__badge" aria-hidden="true" />
        </button>

        <!-- 运行日志：未读时右上角亮小点，warn/error 才计数，普通 info 不打扰 -->
        <button
          type="button"
          class="ib-rail__btn"
          :class="{ 'is-active': logOpen }"
          :title="$t('logTip')"
          @click="logOpen = true"
        >
          <is-icon name="terminal" size="sm" />
          <span v-if="logUnread" class="ib-rail__badge" aria-hidden="true" />
          <span class="is-sr-only" aria-live="polite">{{ logUnread }}</span>
        </button>

        <div
          class="ib-rail__grip"
          :title="$t('resizeHint')"
          @mousedown="startResize"
        ></div>

        <button
          type="button"
          class="ib-rail__btn"
          :title="settingsOpen ? $t('foldSettings') : $t('expandSettings')"
          @click="toggleSettings"
        >
          <is-icon :name="settingsOpen ? 'chevron-right' : 'chevron-left'" size="sm" />
        </button>
      </div>

      <!-- 右侧：输出设置 -->
      <div class="ib-side" :class="{ 'ib-side--shut': !settingsOpen }" :style="sideStyle">
        <div v-show="settingsOpen" class="ib-side__body">
          <setting></setting>
        </div>
      </div>
    </section>

    <!-- 全局拖拽反馈：拖入瞬间给出「松手就能导入」的确定感 -->
    <transition name="is-fade">
      <div v-if="dragging && items.length" class="ib-dragover">
        <div class="ib-dragover__box">
          <is-icon name="download" size="xl" />
          <span>{{ $t('dropToImport') }}</span>
        </div>
      </div>
    </transition>

    <is-log-panel :visible="logOpen" @close="logOpen = false" />
    <is-update-dock
      :visible="updateDockVisible"
      :result="updateResult"
      :auto="updateAuto"
      @later="onUpdateDockLater"
      @details="onUpdateDockDetails"
      @update="onUpdateDockUpdate"
      @restart="onUpdateRestart"
    />
    <is-update-dialog
      :visible="updateDialogVisible"
      :result="updateResult"
      :auto="updateAuto"
      @later="onUpdateLater"
      @skip="onUpdateSkip"
      @download="onUpdateDownload"
      @restart="onUpdateRestart"
    />
  </div>
</template>

<script>
import projectList from '../../components/projectList/projectList.vue'
import setting from '../../components/setting/setting.vue'
import sortBar from '../../components/sortBar/sortBar.vue'
import globalSetting from '../../components/globalSetting/globalSetting.vue'
import IsNoticeHost from '../components/IsNoticeHost.vue'
import IsLogPanel from '../components/IsLogPanel.vue'
import IsUpdateDialog from '../components/IsUpdateDialog.vue'
import IsUpdateDock from '../components/IsUpdateDock.vue'
import appLog from '../log'
import { f as fsOperate } from '../../components/drag/file.js'
import { naturalSort } from '../../util/sort'
import ThemeManager from '../theme'
import { storage } from '../../util/node-env'
import notice from '../notice'
import { APP_NAME } from '../../brand'
import updateService from '../../util/updateService'

// 中间工具条列宽（px）
const RAIL_W = 36
const DEFAULT_SIDE_W = 340
const MIN_SIDE_W = 260
const MAX_SIDE_W = 640
// 左侧列表至少要留出的宽度：原来 380 太保守，
// 820px 窗口下会把右侧上限压到 404，向左只有 84px 行程，手感等同拖不动
const MIN_MAIN_W = 300
// 拖拽折叠阈值：两个值不同形成迟滞区间，避免卡在临界点时反复开合抖动
const COLLAPSE_SIDE_W = 170
const EXPAND_SIDE_W = 230
const SIDE_W_KEY = 'uiSideW'

export default {
  name: 'UiNextHome',
  components: {
    'project-list': projectList,
    'setting': setting,
    'sort-bar': sortBar,
    'globalsetting': globalSetting,
    'is-notice-host': IsNoticeHost,
    'is-log-panel': IsLogPanel,
    'is-update-dialog': IsUpdateDialog,
    'is-update-dock': IsUpdateDock
  },
  data () {
    return {
      appName: APP_NAME,
      // dragenter/dragleave 会在子元素间反复触发，用计数器判定真正的进出
      dragDepth: 0,
      dragging: false,
      settingsOpen: true,
      theme: 'dark',
      pressed: '',
      langOpen: false,
      resizing: false,
      sideW: DEFAULT_SIDE_W,
      // 运行日志面板
      logOpen: false
    }
  },
  computed: {
    items () {
      return this.$store.getters.getterItems
    },
    updateState () {
      return updateService.getUpdateState()
    },
    updateBadge () {
      return !!(this.updateState && this.updateState.badge)
    },
    updateDialogVisible () {
      return !!(this.updateState && this.updateState.dialogVisible)
    },
    updateDockVisible () {
      return !!(this.updateState && this.updateState.dockVisible)
    },
    updateResult () {
      return (this.updateState && this.updateState.lastResult) || null
    },
    updateAuto () {
      return (this.updateState && this.updateState.auto) || null
    },
    isLocked () {
      return this.$store.getters.getterLocked
    },
    selectedCount () {
      return this.$store.getters.getterSelected.length
    },
    // 面板关着时的未读告警数（读 state 上的响应式字段）
    logUnread () {
      return appLog.state.unread
    },
    themeTitle () {
      return this.theme === 'dark' ? this.$t('themeToLight') : this.$t('themeToDark')
    },
    locale () {
      return this.$i18n.locale
    },
    languages () {
      return [
        { label: '简体中文', value: 'zh-cn' },
        { label: '繁體中文', value: 'zh-tw' },
        { label: 'English', value: 'en-us' }
      ]
    },
    currentLangLabel () {
      const hit = this.languages.filter((l) => l.value === this.locale)
      return hit.length ? hit[0].label : this.locale
    },
    sideStyle () {
      // .ib-side 已设为不参与伸缩，这里用显式 width 表达宽度（折叠时为 0）
      return { width: this.settingsOpen ? this.sideW + 'px' : '0px' }
    },
    // 面板窄档标记：Electron 13 无容器查询单位，由 JS 按面板真实宽度维护，
    // setting.scss 据此对阈值行/复选框降字号，实现"文本自适应缩放"
    sideNarrow () {
      return this.settingsOpen && this.sideW < 340
    }
  },
  watch: {
    // 选中 ↔ 面板联动：无选中自动折叠（把宽度让给列表），选中即自动展开。
    // 只响应「变化沿」，不持续强制——用户手动点开的折叠态面板，
    // 在没有新的选中动作前保持打开，尊重手动意图。
    selectedCount (nv, ov) {
      if (nv > 0 && ov === 0) { this.settingsOpen = true }
      else if (nv === 0 && ov > 0) { this.settingsOpen = false }
    },
    // 类挂到 body 上：immediate 保证恢复的持久化宽度本来就窄时也立即生效
    sideNarrow: {
      immediate: true,
      handler (v) {
        if (typeof document !== 'undefined' && document.body) {
          document.body.classList.toggle('side-narrow', v)
        }
      }
    }
  },
  created () {
    this.theme = ThemeManager.get()
    this._unsubTheme = ThemeManager.onChange((d) => { this.theme = d.theme })
    this.sideW = this.readSideW()
    // 初始挂载同样遵循「无选中即折叠」；store 恢复逻辑保证有任务时至少选中一条，
    // 因此正常情况下带任务启动面板是开的
    this.settingsOpen = this.selectedCount > 0
  },
  mounted () {
    window.addEventListener('paste', this.onPaste)
    window.addEventListener('keydown', this.onKeydown)
    window.addEventListener('keyup', this.onKeyup)
    // 拖到窗口外缘时浏览器不会补发 dragleave，兜底重置遮罩
    window.addEventListener('blur', this.resetDrag)
    // 启动延迟自动检查：失败静默，由 updateService 写日志
    updateService.bootstrapUpdateFromStorage()
    updateService.bindAutoIpcListener()
    updateService.refreshAutoUpdateState().catch(() => {})
    this._updateTimer = setTimeout(() => {
      updateService.runUpdateCheck({ force: false }).catch(() => {})
    }, 8000)
  },
  beforeDestroy () {
    window.removeEventListener('paste', this.onPaste)
    window.removeEventListener('keydown', this.onKeydown)
    window.removeEventListener('keyup', this.onKeyup)
    window.removeEventListener('blur', this.resetDrag)
    if (this._updateTimer) { clearTimeout(this._updateTimer); this._updateTimer = null }
    if (this._unsubTheme) this._unsubTheme()
    if (this._onMove) document.removeEventListener('mousemove', this._onMove)
    if (this._onUp) document.removeEventListener('mouseup', this._onUp)
    if (document.body) document.body.classList.remove('side-narrow')
  },
  methods: {
    onUpdateLater () {
      updateService.markLater(this.updateResult && this.updateResult.latest)
    },
    onUpdateSkip () {
      updateService.markSkipVersion(this.updateResult && this.updateResult.latest)
    },
    onUpdateDownload () {
      updateService.openDownload(this.updateResult)
      updateService.markLater(this.updateResult && this.updateResult.latest)
    },
    onUpdateDockLater () {
      updateService.markLater(this.updateResult && this.updateResult.latest)
    },
    onUpdateDockDetails () {
      updateService.openUpdateDialog()
    },
    onUpdateDockUpdate () {
      updateService.startUpdateFromDock(this.updateResult)
    },
    onUpdateRestart () {
      updateService.restartToUpdate()
    },
    // ---------- 右侧面板宽度：拖拽 + 持久化 ----------
    readSideW () {
      try {
        const v = Number(storage.getItem(SIDE_W_KEY))
        if (isFinite(v) && v >= MIN_SIDE_W && v <= MAX_SIDE_W) { return v }
      } catch (e) { /* 桥未就绪时用默认 */ }
      return DEFAULT_SIDE_W
    },
    writeSideW (v) {
      try { storage.setItem(SIDE_W_KEY, String(v)) } catch (e) { /* ignore */ }
    },
    startResize (e) {
      if (e.button !== 0) return
      e.preventDefault()
      this.resizing = true
      this.langOpen = false
      document.body.classList.add('is-column-resizing')
      this._onMove = (ev) => {
        // 手柄右侧剩余的空间即为右侧面板期望宽度
        const want = window.innerWidth - ev.clientX - RAIL_W

        if (!this.settingsOpen) {
          // 折叠态：拖回足够空间就自动展开，恢复到折叠前的 sideW
          if (want > EXPAND_SIDE_W) this.settingsOpen = true
          return
        }
        // 展开态：拖窄到临界以下自动折叠，且不覆盖 sideW，便于展开时还原
        if (want < COLLAPSE_SIDE_W) {
          this.settingsOpen = false
          return
        }
        const maxByMain = window.innerWidth - RAIL_W - MIN_MAIN_W
        this.sideW = Math.max(MIN_SIDE_W, Math.min(MAX_SIDE_W, maxByMain, want))
      }
      this._onUp = () => {
        this.resizing = false
        document.body.classList.remove('is-column-resizing')
        if (this.settingsOpen) this.writeSideW(this.sideW)
        document.removeEventListener('mousemove', this._onMove)
        document.removeEventListener('mouseup', this._onUp)
        this._onMove = null
        this._onUp = null
      }
      document.addEventListener('mousemove', this._onMove)
      document.addEventListener('mouseup', this._onUp)
    },
    // ---------- 语言 ----------
    pickLanguage (value) {
      this.langOpen = false
      if (this.$i18n.locale === value) return
      this.$i18n.locale = value
      // 写回 globalSetting，重启后默认设置与启动语言保持一致
      try {
        const raw = storage.getItem('globalSetting')
        const parsed = raw ? JSON.parse(raw) : {}
        parsed.language = value
        storage.setItem('globalSetting', JSON.stringify(parsed))
      } catch (e) { /* 存储不可用时本次会话仍然生效 */ }
    },
    toggleTheme () {
      ThemeManager.toggle()
    },
    toggleSettings () {
      this.settingsOpen = !this.settingsOpen
    },
    openGlobalSetting () {
      this.$root.eventBus.$emit('openGlobalSetting')
    },

    // ---------- 拖拽反馈 ----------
    onDragEnter (e) {
      if (!this.hasFiles(e)) return
      this.dragDepth++
      this.dragging = true
    },
    onDragLeave () {
      this.dragDepth = Math.max(0, this.dragDepth - 1)
      if (!this.dragDepth) this.dragging = false
    },
    resetDrag () {
      this.dragDepth = 0
      this.dragging = false
    },
    hasFiles (e) {
      var t = e.dataTransfer && e.dataTransfer.types
      if (!t) return false
      for (var i = 0; i < t.length; i++) {
        if (t[i] === 'Files') return true
      }
      return false
    },
    onDrop (ev) {
      this.resetDrag()
      var files = ev.dataTransfer && ev.dataTransfer.files
      if (files && files.length) { this.importPaths(files) }
    },
    onPaste (ev) {
      var cd = ev.clipboardData
      if (!cd || !cd.files || !cd.files.length) { return }
      this.importPaths(cd.files)
    },

    // ---------- 快捷键 ----------
    onKeydown (e) {
      var mod = e.ctrlKey || e.metaKey
      if (!mod) return
      // 输入框里要保留 Ctrl+A 的原生全选行为
      if (this.isTyping(e.target)) return

      var key = (e.key || '').toLowerCase()
      if (key === 'a') {
        e.preventDefault()
        this.$store.dispatch('allSelect')
      } else if ((key === 'delete' || key === 'backspace') && !this.isLocked) {
        e.preventDefault()
        this.$store.dispatch('remove')
      }
    },
    onKeyup (e) { this.pressed = e.key },
    isTyping (el) {
      if (!el || !el.tagName) return false
      var tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || el.isContentEditable
    },

    // ---------- 导入 ----------
    onPick () {
      var ipc = window.ispartaAPI && window.ispartaAPI.ipc
      if (!ipc) { return }
      ipc.invoke('dialog:openFiles', {
        properties: ['openFile', 'openDirectory', 'multiSelections']
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return }
        this.importPaths(result.filePaths)
      }).catch((e) => { console.error(e) })
    },
    importPaths (list) {
      if (this.isLocked) return
      return fsOperate.readerFiles(list).then((ars) => {
        if (!ars || !ars.length) {
          appLog.warn(this.$t('noticeNothingFound'), list.join(', '))
          notice.warning(this.$t('noticeNothingFound'), this.$t('noticeNothingFoundTip'))
          return
        }
        appLog.info(
          this.$t('logImported', { n: ars.length }),
          ars.map((a) => (a.basic && a.basic.type) || '?').join(' / ')
        )
        for (var i in ars) {
          ars[i].basic.fileList.sort(naturalSort)
          this.$store.dispatch('add', {
            basic: ars[i].basic,
            options: ars[i].options
          })
        }
      }).catch((e) => {
        console.error(e)
        notice.error(this.$t('noticeImportFailed'), e && e.message)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
@import "../styles/shell.scss";
</style>
