<template>
  <div
    class="ib"
    @contextmenu.prevent
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
        <button type="button" class="ib-brand ib-brand--link" :title="appName" @click="openLanding">
          <span class="ib-brand__mark" aria-hidden="true">
            <!-- 与 public/icons/icon-brand.svg 同源：品牌色 #c8f542 圆形播放标 -->
            <svg width="18" height="18" viewBox="0 0 1024 1024" fill="none">
              <g transform="translate(512 512) scale(2.05) translate(-512 -395.636364)">
                <path d="M512 395.636364m-232.727273 0a232.727273 232.727273 0 1 0 465.454546 0 232.727273 232.727273 0 1 0-465.454546 0Z" fill="#c8f542"/>
                <path d="M453.806545 289.764848a7.214545 7.214545 0 0 1 8.168728-6.112969l77.548606 11.155394c1.881212 0.271515 3.580121 1.272242 4.728242 2.788848l70.943031 93.796849a7.214545 7.214545 0 0 1 0.100848 8.564363L544.267636 498.722909a7.214545 7.214545 0 0 1-4.871757 2.936243L461.459394 512.391758a7.214545 7.214545 0 0 1-6.997333-11.132122l67.285333-101.558303a7.214545 7.214545 0 0 0-0.077576-8.079515L455.00897 294.888727a7.214545 7.214545 0 0 1-1.202425-5.12z m-6.729697 37.783273a3.607273 3.607273 0 0 1 5.054061 0.702061l47.736243 63.146666a7.214545 7.214545 0 0 1 0.104727 8.556607L452.189091 466.540606a3.607273 3.607273 0 0 1-6.543515-2.102303V330.426182a3.607273 3.607273 0 0 1 1.435151-2.878061z" fill="#0c0f0e"/>
              </g>
            </svg>
          </span>
          <span class="ib-brand__text">{{ appName }}</span>
        </button>
        <div class="ib-import__acts">
          <!-- 单按钮切换视图：图标跟当前模式走（任务列表 list ↔ 合成树 layers） -->
          <button
            v-if="supportsCompImport"
            type="button"
            class="ib-iconbtn"
            :class="{ 'is-active': compTreeOpen }"
            :title="compTreeOpen ? $t('inputItems') : $t('compTreeOpen')"
            @click="toggleView"
          >
            <is-icon :name="compTreeOpen ? 'list' : 'layers'" />
          </button>
          <button type="button" class="ib-iconbtn" :title="$t('obOpenGuide') || '使用引导'" @click="openOnboarding">
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
        <!-- CEP 顶栏左侧 logo：点击跳落地页（openExternal 内部走 cep.util） -->
        <button
          v-if="supportsCompImport"
          type="button"
          class="ib-rail__brand"
          :title="appName"
          @click="openLanding"
        >
          <span class="ib-rail__brand-mark" aria-hidden="true">
            <!-- 与 public/icons/icon-brand.svg 同源 -->
            <svg width="18" height="18" viewBox="0 0 1024 1024" fill="none">
              <g transform="translate(512 512) scale(2.05) translate(-512 -395.636364)">
                <path d="M512 395.636364m-232.727273 0a232.727273 232.727273 0 1 0 465.454546 0 232.727273 232.727273 0 1 0-465.454546 0Z" fill="#c8f542"/>
                <path d="M453.806545 289.764848a7.214545 7.214545 0 0 1 8.168728-6.112969l77.548606 11.155394c1.881212 0.271515 3.580121 1.272242 4.728242 2.788848l70.943031 93.796849a7.214545 7.214545 0 0 1 0.100848 8.564363L544.267636 498.722909a7.214545 7.214545 0 0 1-4.871757 2.936243L461.459394 512.391758a7.214545 7.214545 0 0 1-6.997333-11.132122l67.285333-101.558303a7.214545 7.214545 0 0 0-0.077576-8.079515L455.00897 294.888727a7.214545 7.214545 0 0 1-1.202425-5.12z m-6.729697 37.783273a3.607273 3.607273 0 0 1 5.054061 0.702061l47.736243 63.146666a7.214545 7.214545 0 0 1 0.104727 8.556607L452.189091 466.540606a3.607273 3.607273 0 0 1-6.543515-2.102303V330.426182a3.607273 3.607273 0 0 1 1.435151-2.878061z" fill="#0c0f0e"/>
              </g>
            </svg>
          </span>
          <span class="ib-rail__brand-text">{{ appName }}</span>
        </button>

        <!-- 使用引导：随时可重新调起（首启已自动弹过也能再打开） -->
        <button
          type="button"
          class="ib-rail__btn ib-rail__btn--help"
          :title="$t('obOpenGuide')"
          @click="openOnboarding"
        >
          <is-icon name="question" size="sm" />
        </button>

        <!-- 视图切换：单按钮，图标跟当前模式走（任务列表 list ↔ 合成树 layers） -->
        <button
          v-if="supportsCompImport"
          type="button"
          class="ib-rail__btn ib-rail__btn--layers"
          :class="{ 'is-active': compTreeOpen }"
          :title="compTreeOpen ? $t('inputItems') : $t('compTreeOpen')"
          @click="toggleView"
        >
          <is-icon :name="compTreeOpen ? 'list' : 'layers'" size="sm" />
        </button>

        <button type="button" class="ib-rail__btn ib-rail__btn--theme" :title="themeTitle" @click="toggleTheme">
          <is-icon :name="theme === 'dark' ? 'sun' : 'moon'" size="sm" />
        </button>

        <div class="ib-rail__lang">
          <button
            type="button"
            class="ib-rail__btn ib-rail__btn--lang"
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

        <button type="button" class="ib-rail__btn ib-rail__btn--settings" :title="$t('defaultSetting')" @click="openGlobalSetting">
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
          class="ib-rail__btn ib-rail__btn--log"
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
          class="ib-rail__btn ib-rail__btn--end"
          :title="(supportsCompImport ? settingsDialogOpen : settingsOpen) ? $t('foldSettings') : $t('expandSettings')"
          @click="toggleSettings"
        >
          <is-icon :name="(supportsCompImport ? settingsDialogOpen : settingsOpen) ? 'chevron-right' : 'chevron-left'" size="sm" />
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
import { BP_NARROW, BP_WIDE } from '../styles/breakpoints'
import { storage } from '../../util/node-env'
import notice from '../notice'
import { APP_NAME } from '../../brand'
import updateService from '../../util/updateService'
import hostAdapter, { getSourceAdapter } from '../../util/host-env'
import CompTree from '../../components/compTree/compTree.vue'
import { LANDING_URL } from '../../brand'
// 顶栏「?」调起首启引导；落地页外链保留在引导末页（§5.1）
import * as onboarding from '../onboarding/state'

// 中间工具条列宽（px，与 tokens.css --is-rail-w 保持一致）
const RAIL_W = 36
// CEP 工具条改顶栏横排（见 shell.scss body.is-cep），不再夹在列表与侧栏之间
function railW () {
  if (hostAdapter.supportsCompImport) { return 0 }
  return RAIL_W
}
const DEFAULT_SIDE_W = 340
// 允许拖到的最小右栏宽：必须 ≤ EXPAND_SIDE_W，否则折叠态拖出时宽度会被垫高、不跟手
const MIN_SIDE_W = 160
const MAX_SIDE_W = 640
// 左侧列表至少要留出的宽度：原来 380 太保守，
// 820px 窗口下会把右侧上限压到 404，向左只有 84px 行程，手感等同拖不动
const MIN_MAIN_W = 300
// CEP 窄面板：主列表可更窄，否则右栏被挤死无法拖宽
function minMainW () {
  if (typeof window === 'undefined') return MIN_MAIN_W
  // 断点统一见 styles/_bp.scss / breakpoints.js；严格 CEP 注入
  if (hostAdapter.supportsCompImport && window.innerWidth <= BP_WIDE) return 120
  return MIN_MAIN_W
}
// 拖拽折叠阈值：两个值不同形成迟滞区间，避免卡在临界点时反复开合抖动。
// 展开阈值旧值 230 过大：折叠态 grip 贴在右缘，要先把光标拽出 230px 才有反应，
// 手感等同「拖不出来」。压到与 MIN 同档，拖出约 160px 即展开且宽度跟手。
const COLLAPSE_SIDE_W = 120
const EXPAND_SIDE_W = 160
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
      // 拖拽调宽过程中不响应选中联动，避免 watcher 把正在拖的面板夹断
      if (this.resizing) return
      // CEP：选中不自动展开侧栏，由用户拖出；桌面保留选中即展开
      if (this.supportsCompImport) return
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
    // 初始挂载：CEP 不因选中自动展开（用户拖出）；桌面仍「有选中即展开」
    this.settingsOpen = !this.supportsCompImport && this.selectedCount > 0
  },
  mounted () {
    window.addEventListener('paste', this.onPaste)
    window.addEventListener('keydown', this.onKeydown)
    window.addEventListener('keyup', this.onKeyup)
    // 拖到窗口外缘时浏览器不会补发 dragleave，兜底重置遮罩
    window.addEventListener('blur', this.resetDrag)
    // projectList 等子组件要求打开「任务输出设置」：CEP 用全屏覆盖层，桌面展开右栏
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$on('open-task-setting', this.onOpenTaskSetting)
      this.$root.eventBus.$on('task-setting-started', this.onTaskSettingStarted)
    }
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
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$off('open-task-setting', this.onOpenTaskSetting)
      this.$root.eventBus.$off('task-setting-started', this.onTaskSettingStarted)
    }
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
    async onUpdateDownload () {
      // 不支持应用内更新时才走浏览器；支持时主按钮是「立即更新」
      // 仅当外链真的打开了才收起卡片：CEP 下 openExternal 失败时若照样 markLater，
      // 用户看到的是「浏览器没开、卡片还消失了」，只能重启 AE 面板才再见到提示
      var r = await updateService.openDownload(this.updateResult)
      if (r && r.opened) {
        updateService.markLater(this.updateResult && this.updateResult.latest)
      }
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
      // CEP 极窄面板也允许拖出侧栏（只在真正放不下时禁用；断点统一见 styles/_bp.scss，仅 CEP）
      if (this.supportsCompImport && window.innerWidth < BP_NARROW) return
      e.preventDefault()
      this.resizing = true
      this.langOpen = false
      document.body.classList.add('is-column-resizing')
      // 期望侧栏宽 = 光标右侧剩余空间（扣掉中栏）。rail 宽 36px，按在中段会让
      // rawWant 瞬间偏小、面板跳一下——用 bias 把抓取点归零，宽度才严格跟手。
      const rawWant = (clientX) => window.innerWidth - clientX - railW()
      this._resizeBias = rawWant(e.clientX) - (this.settingsOpen ? this.sideW : 0)
      this._onMove = (ev) => {
        const want = rawWant(ev.clientX) - this._resizeBias

        // 允许区间：main 至少留 minMainW，且绝不能把 sideW 顶到 maxByMain 之上
        // （旧写法 Math.max(MIN, min(MAX, maxByMain, want)) 在 maxByMain < MIN 时会
        // 强行垫到 MIN，反过来挤掉 main 的最小宽度）
        const maxByMain = Math.max(0, window.innerWidth - railW() - minMainW())
        const upper = Math.min(MAX_SIDE_W, Math.max(maxByMain, 1))
        const lower = Math.min(MIN_SIDE_W, upper)
        const clampW = (w) => Math.round(Math.max(lower, Math.min(upper, w)))

        if (!this.settingsOpen) {
          // 折叠态：拖过阈值即展开，并把 sideW 写成当前 want（跟手）。
          // 旧逻辑在这里 return 不写 sideW，展开瞬间跳回旧宽度，下一帧再跳到钳位值。
          if (want >= EXPAND_SIDE_W) {
            this.settingsOpen = true
            this.sideW = clampW(want)
            // 以展开后的实际宽度重定 bias，继续拖不跳
            this._resizeBias = rawWant(ev.clientX) - this.sideW
          }
          return
        }
        // 展开态：拖窄到临界以下自动折叠，且不覆盖 sideW，便于展开时还原
        if (want < COLLAPSE_SIDE_W) {
          this.settingsOpen = false
          // 以当前点为新的 0：再往左拖 EXPAND 才重新展开（迟滞）
          this._resizeBias = rawWant(ev.clientX)
          return
        }
        this.sideW = clampW(want)
      }
      this._onUp = () => {
        this.resizing = false
        document.body.classList.remove('is-column-resizing')
        if (this.settingsOpen) this.writeSideW(this.sideW)
        document.removeEventListener('mousemove', this._onMove)
        document.removeEventListener('mouseup', this._onUp)
        this._onMove = null
        this._onUp = null
        this._resizeBias = 0
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
      // CEP：展开 = 铺满屏的输出设置覆盖层（侧栏在小屏无意义）
      if (this.supportsCompImport) {
        this.settingsDialogOpen = !this.settingsDialogOpen
        return
      }
      this.settingsOpen = !this.settingsOpen
    },
    /**
     * projectList 等发出「打开任务输出设置」：
     * CEP 走全屏覆盖层（小屏侧栏 display:none）；桌面展开右栏。
     */
    onOpenTaskSetting () {
      if (this.supportsCompImport) {
        this.settingsDialogOpen = true
      } else {
        this.settingsOpen = true
      }
    },
    /** 任务设置里点「开始」后收起面板，回主列表看进度 */
    onTaskSettingStarted () {
      this.settingsDialogOpen = false
      if (this.supportsCompImport) {
        // CEP 覆盖层已关
      } else {
        this.settingsOpen = false
      }
    },
    openGlobalSetting () {
      this.$root.eventBus.$emit('openGlobalSetting')
    },
    openLanding () {
      hostAdapter.openExternal(LANDING_URL)
    },
    /** 顶栏「?」：随时重新调起首启引导（完成过也照样能看） */
    openOnboarding () {
      onboarding.open()
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
        // CEP 实时同步：AE 当前合成列表整表替换 Comp 任务（含删除/重命名）；空列表也清空
        var gen = (comps && comps.length) ? src.toItems(comps) : []
        var selected = []
        var beforeItems = store.getters.getterItems || []
        for (var k = 0; k < beforeItems.length; k++) {
          var it = beforeItems[k]
          if (it && it.basic && it.basic.type === 'Comp' && it.isSelected) {
            selected.push(Number(it.basic.compIndex) + ':' + String(it.basic.compName || ''))
          }
        }
        store.dispatch('syncCompTasks', { items: gen, selectedKeys: selected })
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
        // 切回任务列表：刷新为 AE 当前合成
        this.loadAllCompsAsTasks()
      } else {
        // 打开树前也刷新，两边都是实时列表
        this.loadAllCompsAsTasks()
        this.onPickComps()
      }
    },
    /** 视图切换：单按钮 toggle（任务列表 ↔ 合成树） */
    toggleView () {
      this.compTreeOpen = !this.compTreeOpen
      if (this.compTreeOpen) {
        this.loadAllCompsAsTasks()
        this.$nextTick(() => {
          if (this.$root && this.$root.eventBus) {
            this.$root.eventBus.$emit('comp-tree-refresh')
          }
        })
      } else {
        this.loadAllCompsAsTasks()
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
      // CEP：选中不自动展开侧栏（用户拖出）；桌面保留
      if (nodes && nodes.length && !this._noSidePanel && !this.supportsCompImport) {
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
          existing[b.compIndex + ':' + (b.compName || '')] = true
        }
      }
      // 用 index:name 复合键，避免 index 全为 0 时误选全部
      var compKeys = []
      for (var j = 0; j < gen.length; j++) {
        var basic = gen[j].basic
        var key = Number(basic.compIndex) + ':' + String(basic.compName || '')
        compKeys.push(key)
        if (!existing[key]) {
          store.dispatch('add', {
            basic: gen[j].basic,
            options: gen[j].options
          })
        }
      }
      store.dispatch('syncCompSelected', compKeys)
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
        // 合成树打开时：全选树节点（与列表 allSelect 同一 isSelected 真相源）
        if (this.supportsCompImport && this.compTreeOpen) {
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
        if (this.supportsCompImport && this.compTreeOpen) {
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
