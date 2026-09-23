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

    <!-- 空态：无任务时全屏导入（CEP 先铺合成列表，仍为空才显示） -->
    <section v-if="!items.length && !compTreeOpen" class="ib-import">
      <div class="ib-import__top">
        <span class="ib-brand">{{ appName }}</span>
        <div class="ib-import__acts">
          <button
            v-if="supportsCompImport"
            type="button"
            class="ib-iconbtn"
            title="合成树"
            @click="onPickComps"
          >
            <is-icon name="layers" />
          </button>
          <button type="button" class="ib-iconbtn" :title="$t('helpTip') || '帮助'" @click="openLanding">
            <is-icon name="question" />
          </button>
          <button type="button" class="ib-iconbtn" :title="$t('defaultSetting')" @click="openGlobalSetting">
            <is-icon name="settings" />
            <span v-if="updateBadge" class="ib-rail__badge" aria-hidden="true" />
          </button>
          <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
            <is-icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
      <!-- 合成树占任务列表区；不与空态画框嵌套 -->
      <div v-if="supportsCompImport && compTreeOpen" class="ib-main__list">
        <comp-tree @add="onCompTreeAdd" @close="compTreeOpen = false" />
      </div>
      <!-- 空态：CEP 点击刷新合成；桌面点击/拖入导入文件 -->
      <div
        v-else
        class="ib-drop"
        :class="{ 'is-hot': dragging }"
        @click="onPick"
      >
        <div class="ib-drop__icon">
          <div class="ib-folder">
            <div class="ib-folder__front">
              <div class="ib-folder__tip"></div>
              <div class="ib-folder__cover"></div>
            </div>
            <div class="ib-folder__back"></div>
          </div>
        </div>
        <h1>{{ supportsCompImport ? $t('compRefresh') : $t('uploadTips') }}</h1>
        <p class="ib-drop__rule">{{ supportsCompImport ? $t('uploadCompRule') : $t('uploadRule') }}</p>
        <!-- 仅工程/扫描异常时提示；正常扫描结果静默 -->
        <p v-if="projectStatusMsg" class="ib-drop__status">{{ projectStatusMsg }}</p>
        <div v-if="!supportsCompImport" class="keyboard-hint">
          <p>{{ $t('pasteHint') }}</p>
          <div class="keyboard-keys">
            <span class="keyboard-key" id="ctrl-key" :class="{ 'key-pressed': pressed === 'Control' }" @click.stop="onKeyClick('Control')">CTRL</span>
            <span class="plus">+</span>
            <span class="keyboard-key" id="v-key" :class="{ 'key-pressed': pressed === 'v' }" @click.stop="onKeyClick('v')">V</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 有任务：中列表 + 右设置 两栏 -->
    <section v-else class="ib-ws">
      <div class="ib-main">
        <div class="ib-main__list">
          <comp-tree
            v-if="supportsCompImport && compTreeOpen"
            @add="onCompTreeAdd"
            @close="compTreeOpen = false"
            @select="onCompSelect"
            @configure="onCompConfigure"
          />
          <project-list v-else></project-list>
        </div>
        <sort-bar></sort-bar>
      </div>

      <!-- 中间列：工具条 + 可拖拽分隔 -->
      <div
        class="ib-rail"
        :class="{ 'is-resizing': resizing }"
      >
        <button
          v-if="supportsCompImport"
          type="button"
          class="ib-rail__btn"
          :class="{ 'is-active': compTreeOpen }"
          :title="compTreeOpen ? $t('compTreeOpen') : $t('compTreeOpen')"
          @click="toggleCompTree"
        >
          <is-icon name="layers" size="sm" />
        </button>

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

        <!-- 删除所选任务：仅桌面文件任务；CEP 任务=合成列表，删除会清空且无意义 -->
        <button
          v-if="!supportsCompImport"
          type="button"
          class="ib-rail__btn ib-rail__btn--danger"
          :title="$t('shortcutDelete')"
          :disabled="isLocked || !selectedCount"
          @click="onDeleteSelected"
        >
          <is-icon name="trash" size="sm" />
          <span v-if="selectedCount" class="ib-rail__count" aria-hidden="true">{{ selectedCount }}</span>
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
    <!-- CEP：全屏覆盖输出设置（不是小弹窗/外开浏览器）；桌面仍用侧栏 -->
    <div
      v-if="supportsCompImport && settingsDialogOpen"
      class="ib-set-overlay"
    >
      <div class="ib-set-overlay__bar">
        <span>{{ $t('outputConfig') }}</span>
        <button type="button" class="ib-iconbtn" :title="$t('close')" @click="settingsDialogOpen = false">
          <is-icon name="close" />
        </button>
      </div>
      <div class="ib-set-overlay__body">
        <setting></setting>
      </div>
    </div>
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
      @update="onUpdateDockUpdate"
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
import hostAdapter, { getSourceAdapter } from '../../util/host-env'
import CompTree from '../../components/compTree/compTree.vue'
import { LANDING_URL } from '../../brand'

// 中间工具条列宽（px）
const RAIL_W = 36
const DEFAULT_SIDE_W = 340
const MIN_SIDE_W = 260
const MAX_SIDE_W = 640
// 左侧列表至少要留出的宽度：原来 380 太保守，
// 820px 窗口下会把右侧上限压到 404，向左只有 84px 行程，手感等同拖不动
const MIN_MAIN_W = 300
// CEP 窄面板：主列表可更窄，否则右栏被挤死无法拖宽
function minMainW () {
  if (typeof window === 'undefined') return MIN_MAIN_W
  return window.innerWidth < 720 ? 120 : MIN_MAIN_W
}
// 拖拽折叠阈值：两个值不同形成迟滞区间，避免卡在临界点时反复开合抖动
const COLLAPSE_SIDE_W = 170
const EXPAND_SIDE_W = 230
const SIDE_W_KEY = 'uiSideW'

export default {
  name: 'UiNextHome',
  components: {
    'project-list': projectList,
    'comp-tree': CompTree,
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
      settingsOpen: !hostAdapter.supportsCompImport,
      theme: 'dark',
      pressed: '',
      langOpen: false,
      resizing: false,
      sideW: DEFAULT_SIDE_W,
      // 运行日志面板
      logOpen: false,
      compTreeOpen: false,
      settingsDialogOpen: false,
      // 仅工程/扫描异常时非空
      projectStatusMsg: ''
    }
  },
  computed: {
    items () {
      return this.$store.getters.getterItems
    },
    supportsFileImport () {
      return hostAdapter.supportsFileImport !== false
    },
    supportsCompImport () {
      return !!hostAdapter.supportsCompImport
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
    // CEP：任务条默认就是合成列表（不依赖先勾选）
    if (this.supportsCompImport) {
      this.loadAllCompsAsTasks()
    }
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
      // 不支持应用内更新时才走浏览器；支持时主按钮是「立即更新」
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
        const maxByMain = window.innerWidth - RAIL_W - minMainW()
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
    openLanding () {
      hostAdapter.openExternal(LANDING_URL)
    },
    onPickComps () {
      this.compTreeOpen = true
      var self = this
      this.$nextTick(function () {
        if (self.$root && self.$root.eventBus) {
          self.$root.eventBus.$emit('comp-tree-refresh')
        }
      })
    },
    /**
     * 任务条 = 合成列表：切到桌面任务 UI 时，用工程合成铺满 store，
     * 未勾选的也进列表（只改 isSelected），避免「没选合成 → 任务空」。
     */
    /**
     * 启动/刷新：读工程状态 → 扫描全部合成铺任务。
     * 状态正常不提示；noProject/unsaved/扫描失败才写 projectStatusMsg。
     */
    loadAllCompsAsTasks () {
      var src = getSourceAdapter()
      if (!src || typeof src.list !== 'function') return Promise.resolve()
      var store = this.$store
      var self = this
      var statusFn = src.getProjectStatus
      var statusP = (typeof statusFn === 'function')
        ? Promise.resolve(statusFn()).catch(function () { return { ok: false, code: 'error' } })
        : Promise.resolve({ ok: true, code: 'ok' })

      return statusP.then(function (st) {
        if (st && st.code && st.code !== 'ok') {
          if (st.code === 'noProject') self.projectStatusMsg = self.$t('projectNoOpen')
          else if (st.code === 'unsaved') self.projectStatusMsg = self.$t('projectUnsaved')
          else self.projectStatusMsg = self.$t('compScanFailed')
          return null
        }
        self.projectStatusMsg = ''
        return src.list()
      }).then(function (comps) {
        if (!comps || !comps.length) return
        var gen = src.toItems(comps)
        var old = store.getters.getterItems || []
        var existing = {}
        for (var i = 0; i < old.length; i++) {
          var b = old[i] && old[i].basic
          if (b && b.type === 'Comp') {
            existing[b.compIndex] = true
          }
        }
        for (var j = 0; j < gen.length; j++) {
          var idx = gen[j].basic.compIndex
          if (!existing[idx]) {
            store.dispatch('add', {
              basic: gen[j].basic,
              options: gen[j].options
            })
          }
        }
        // 铺底时保持当前勾选；全空则默认全不选，由树/列表再勾
        var selected = []
        var items = store.getters.getterItems || []
        for (var k = 0; k < items.length; k++) {
          var it = items[k]
          if (it && it.basic && it.basic.type === 'Comp' && it.isSelected) {
            selected.push(it.basic.compIndex)
          }
        }
        store.dispatch('syncCompSelected', selected)
        self.wakeCompThumbs()
      }).catch(function () {
        self.projectStatusMsg = self.$t('compScanFailed')
      })
    },
    onCompTreeAdd (items) {
      if (!items || !items.length) return
      for (var i = 0; i < items.length; i++) {
        this.$store.dispatch('add', {
          basic: items[i].basic,
          options: items[i].options
        })
      }
      this.compTreeOpen = false
    },
    /** 选中合成 → 同步为桌面「任务选中」，供右栏设置/底栏计数 */
    toggleCompTree () {
      if (this.compTreeOpen) {
        this.compTreeOpen = false
        // 切到桌面任务 UI：任务条渲染完整合成列表
        this.loadAllCompsAsTasks()
      } else {
        this.onPickComps()
      }
    },
    /** PAG 式：独立 OS 窗口（不撑开侧栏） */
    onCompConfigure (node) {
      // 只同步选中，不打开右栏
      var src = getSourceAdapter()
      if (src) {
        var gen = src.toItems([node])
        // 轻量同步：交给 onCompSelect 前先记住不要开侧栏
        this._noSidePanel = true
        this.onCompSelect([node])
        this._noSidePanel = false
      }
      this.openSettingsWindow()
    },
    openSettingsWindow () {
      // CEP：面板内全屏覆盖层（PAG 式全局设置）；不外开浏览器
      this.settingsDialogOpen = true
    },
    onCompSelect (nodes) {
      if (nodes && nodes.length && !this._noSidePanel) {
        this.settingsOpen = true
      }
      var src = getSourceAdapter()
      if (!src) return
      var store = this.$store
      var selected = nodes || []
      var gen = selected.length ? src.toItems(selected) : []
      // 任务列表始终显示全部任务；树勾选只同步 isSelected，不删行
      var old = store.getters.getterItems || []
      var existing = {}
      for (var i = 0; i < old.length; i++) {
        var b = old[i] && old[i].basic
        if (b && b.type === 'Comp') {
          existing[b.compIndex] = true
        }
      }
      var compIndexes = []
      for (var j = 0; j < gen.length; j++) {
        var idx = gen[j].basic.compIndex
        compIndexes.push(idx)
        if (!existing[idx]) {
          store.dispatch('add', {
            basic: gen[j].basic,
            options: gen[j].options
          })
        }
      }
      store.dispatch('syncCompSelected', compIndexes)
      // 未勾选的合成也已在列表；无原生预览，不渲封面
      this.wakeCompThumbs()
    },
    /** 合成无原生预览 API（须渲帧）；CEP 列表不显示封面 */
    wakeCompThumbs () {},
    onDeleteSelected () {
      if (this.isLocked || !this.selectedCount) return
      this.$store.dispatch('removeSelectedForce')
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
      if (!this.supportsFileImport) return
      var files = ev.dataTransfer && ev.dataTransfer.files
      if (files && files.length) { this.importPaths(files) }
    },
    onPaste (ev) {
      if (!this.supportsFileImport) return
      var cd = ev.clipboardData
      if (!cd || !cd.files || !cd.files.length) { return }
      this.importPaths(cd.files)
    },

    // ---------- 快捷键 ----------
    onKeydown (e) {
      // 输入框里保留原生编辑行为
      if (this.isTyping(e.target)) return

      // 空态键帽按下反馈（CTRL / V），对齐原版 key-pressed
      if (e.key === 'Control') {
        this.pressed = 'Control'
      } else if (e.key === 'v' || e.key === 'V') {
        this.pressed = 'v'
      }

      var mod = e.ctrlKey || e.metaKey
      var key = (e.key || '').toLowerCase()

      if (mod && key === 'a') {
        e.preventDefault()
        // 合成树模式：全选合成（对应桌面选任务）
        if (this.supportsCompImport && this.compTreeOpen && !this.items.length) {
          if (this.$root && this.$root.eventBus) {
            this.$root.eventBus.$emit('comp-tree-select-all')
          }
          return
        }
        if (!this.isLocked) this.$store.dispatch('allSelect')
        return
      }
      // Delete / Backspace：合成树=取消选择；CEP 任务=取消勾选（不删行）；桌面=删除所选
      if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault()
        if (this.supportsCompImport && this.compTreeOpen && !this.items.length) {
          if (this.$root && this.$root.eventBus) {
            this.$root.eventBus.$emit('comp-tree-clear')
          }
          return
        }
        if (this.supportsCompImport) {
          if (!this.isLocked) this.$store.dispatch('noneSelect')
          return
        }
        if (this.selectedCount) this.$store.dispatch('removeSelectedForce')
        return
      }
      // 兼容旧习惯：Ctrl+Delete（CEP 不删任务）
      if (mod && (key === 'delete' || key === 'backspace')) {
        e.preventDefault()
        if (this.supportsCompImport) return
        if (this.selectedCount) this.$store.dispatch('removeSelectedForce')
      }
    },
    onKeyup (e) {
      if (e.key === 'Control' && this.pressed === 'Control') this.pressed = ''
      if ((e.key === 'v' || e.key === 'V') && this.pressed === 'v') this.pressed = ''
    },

    // 点击键帽：闪一下 + 触发粘贴（对齐原版 handleKeyClick）
    onKeyClick (key) {
      this.flashKey(key)
      this.triggerPaste()
    },
    flashKey (key) {
      this.pressed = key
      setTimeout(() => {
        if (this.pressed === key) this.pressed = ''
      }, 150)
    },
    async triggerPaste () {
      try {
        if (!navigator.clipboard || !navigator.clipboard.read) {
          notice.info(this.$t('noticePasteNeedShortcut'))
          return
        }
        const items = await navigator.clipboard.read()
        const files = []
        for (const item of items) {
          const type = item.types.find((t) => t.indexOf('image/') === 0)
          if (!type) continue
          const blob = await item.getType(type)
          const ext = type.split('/')[1] || 'png'
          files.push(new File([blob], 'pasted-image.' + ext, { type }))
        }
        if (!files.length) {
          notice.info(this.$t('noticePasteEmpty'))
          return
        }
        this.importPaths(files)
      } catch (err) {
        notice.warning(this.$t('noticePasteNeedShortcut'))
      }
    },
    isTyping (el) {
      if (!el || !el.tagName) return false
      var tag = el.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || el.isContentEditable
    },

    // ---------- 导入 ----------
    onPick () {
      // CEP：空面板点击 = 刷新扫描合成列表（不是粘贴/选文件）
      if (this.supportsCompImport) {
        this.loadAllCompsAsTasks()
        return
      }
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
      if (!this.supportsFileImport) return
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

/* 窄面板单滚动：外层裁剪，内层列表滚动 */
.ib-main__list {
  overflow-x: hidden;
  overflow-y: auto;
  min-height: 0;
}
/* CEP 全屏覆盖设置层 */
.ib-set-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: var(--is-bg, #1b1b1b);
  color: var(--is-fg, #eee);
}
.ib-set-overlay__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--is-line, rgba(128, 128, 128, 0.25));
  font-weight: 600;
}
.ib-set-overlay__body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 24px;
}
.ib-main__list > * {
  min-height: 0;
}
</style>
