<template>
  <div class="ob" :class="{ 'ob--cep': isCep }">
    <!-- 顶栏：拖拽区 + 面板名 + 右上角设置（主题 · 语言）；桌面独立窗另有自绘窗口按钮 -->
    <header class="ob-top">
      <span class="ob-top__name">{{ $t('obPanelName') }}</span>

      <div class="ob-top__right">
        <div class="ob-set">
          <button
            type="button"
            class="ob-set__btn"
            aria-haspopup="true"
            :aria-expanded="popOpen ? 'true' : 'false'"
            @click.stop="togglePop"
          >
            <is-icon name="settings" size="sm" />
            <span class="ob-set__val">{{ themeLabel }}</span>
            <span class="ob-set__sep" aria-hidden="true">·</span>
            <span class="ob-set__val">{{ langLabel }}</span>
          </button>

          <transition name="ob-pop">
            <div v-if="popOpen" class="ob-set__pop" @click.stop>
              <div class="ob-set__field">
                <span class="ob-set__lbl">{{ $t('appearance') }}</span>
                <is-segmented
                  :value="themeMode"
                  :options="themeOptions"
                  size="sm"
                  @change="applyTheme"
                />
              </div>
              <div class="ob-set__field">
                <span class="ob-set__lbl">{{ $t('language') }}</span>
                <is-segmented
                  :value="langMode"
                  :options="langOptions"
                  size="sm"
                  @change="applyLang"
                />
              </div>
            </div>
          </transition>
        </div>

        <!-- 窗口按钮：仅桌面独立窗（CEP 是 AE 面板，没有窗口可控制） -->
        <div v-if="canControlWindow" class="ob-win">
          <button
            type="button"
            class="ob-win__btn"
            :title="$t('obWinMinimize')"
            :aria-label="$t('obWinMinimize')"
            @click="winMinimize"
          >
            <is-icon name="minus" size="xs" />
          </button>
          <button
            type="button"
            class="ob-win__btn"
            :title="maximized ? $t('obWinRestore') : $t('obWinMaximize')"
            :aria-label="maximized ? $t('obWinRestore') : $t('obWinMaximize')"
            @click="winToggleMaximize"
          >
            <is-icon :name="maximized ? 'copy' : 'square'" size="xs" />
          </button>
          <button
            type="button"
            class="ob-win__btn ob-win__btn--danger"
            :title="$t('obWinClose')"
            :aria-label="$t('obWinClose')"
            @click="winClose"
          >
            <is-icon name="close" size="xs" />
          </button>
        </div>
      </div>
    </header>

    <!-- 进度点：数量随条件页（AE 扩展）动态变化 -->
    <div class="ob-dots" role="tablist" :aria-label="$t('obPanelName')">
      <span
        v-for="(s, i) in steps"
        :key="s.key"
        class="ob-dot"
        :class="{ 'is-on': i === index, 'is-past': i < index }"
        role="tab"
        :aria-selected="i === index ? 'true' : 'false'"
      ></span>
    </div>

    <!-- 内容区：步骤切换（裁剪，避免动画期间溢出） -->
    <div class="ob-screen">
      <div class="ob-step-scroll">
        <transition :name="dir === 'prev' ? 'ob-step-prev' : 'ob-step-next'" mode="out-in">
          <component :is="currentComponent" :key="current.key" class="ob-step" />
        </transition>
      </div>
    </div>

    <!-- 页脚 -->
    <footer class="ob-foot">
      <button type="button" class="ob-skip" @click="skip">{{ $t('obSkip') }}</button>
      <div class="ob-foot__right">
        <span class="ob-count">{{ index + 1 }} / {{ steps.length }}</span>
        <is-button v-if="index > 0" size="sm" @click="prev">{{ $t('obPrev') }}</is-button>
        <is-button type="primary" size="sm" @click="next">
          {{ isLast ? $t('obDone') : $t('obNext') }}
        </is-button>
      </div>
    </footer>
  </div>
</template>

<script>
/**
 * 首启引导外壳（桌面独立窗 / CEP 面板浮层 共用）
 *
 * 外框三部分：顶栏（拖拽区 + 设置 + 桌面窗口按钮）→ 进度点 → 内容区 + 页脚。
 * 环节要点：
 *   · 桌面是 frameless 独立窗，顶栏必须挂 `-webkit-app-region: drag` 才能拖动窗口；
 *     内部所有可点元素（设置胶囊、弹层、窗口按钮）都要显式 `no-drag`，否则点不动。
 *   · 主题**不自建状态**，一律读写 ThemeManager（与 Home.vue 共用同一实例，
 *     所以「引导里切了、主界面没变」不会发生）。
 *   · 语言写入 globalSetting.language 并同步 i18n.locale，值可为 'system'；
 *     **'system' 绝不赋给 i18n.locale**，必须经 resolveLocale() 解析。
 *   · 本组件不设 overflow:hidden —— 右上角弹层需要溢出顶栏。
 */
import ThemeManager from '../theme'
import { storage } from '../../util/node-env'
import { SUPPORTED, MODE_SYSTEM, resolveLocale } from '../../util/system-locale'
import hostAdapter from '../../util/host-env'
import * as onboarding from './state'

import WelcomeStep from './steps/WelcomeStep.vue'
import ImportStep from './steps/ImportStep.vue'
import OutputStep from './steps/OutputStep.vue'
import NamingStep from './steps/NamingStep.vue'
import PathVarsStep from './steps/PathVarsStep.vue'
import AeStep from './steps/AeStep.vue'
import FinishStep from './steps/FinishStep.vue'

const LANG_LABELS = { 'zh-cn': '简体', 'zh-tw': '繁體', 'en-us': 'EN' }

/** 宿主桥；CEP / browser-mock 下 windowApi.window 不存在，窗口按钮整组隐藏 */
const windowApi = (typeof window !== 'undefined' && window.ispartaAPI) || null

export default {
  name: 'Onboarding',
  components: { WelcomeStep, ImportStep, OutputStep, NamingStep, PathVarsStep, AeStep, FinishStep },
  data () {
    return {
      index: 0,
      dir: 'next',
      popOpen: false,
      themeMode: ThemeManager.getMode(),
      // 解析后的实际主题（'dark'|'light'），胶囊显示它；模式在弹层里选
      themeResolved: ThemeManager.get(),
      langMode: MODE_SYSTEM,
      maximized: false
    }
  },
  computed: {
    isCep () { return hostAdapter.kind === 'cep' },
    // 宿主窗口按钮是否存在：CEP 在 AE 面板里，没有窗口可最小化/最大化/关闭
    canControlWindow () { return !!windowApi && windowApi.window },
    steps () {
      return [
        { key: 'welcome', component: WelcomeStep },
        { key: 'import', component: ImportStep },
        { key: 'output', component: OutputStep },
        { key: 'naming', component: NamingStep },
        { key: 'path', component: PathVarsStep },
        // 条件页：仅在 AE 扩展可用（CEP 宿主，或桌面已装扩展）时出现。
        // 桌面侧的「已装扩展」探测属 W2，当前桌面默认不出，避免教用户用它没有的东西。
        { key: 'ae', component: AeStep, when: () => hostAdapter.supportsCompImport },
        { key: 'finish', component: FinishStep }
      ].filter((s) => !s.when || s.when())
    },
    current () { return this.steps[this.index] || this.steps[0] },
    currentComponent () { return this.current.component },
    isLast () { return this.index >= this.steps.length - 1 },
    themeOptions () {
      return [
        { label: this.$t('themeSystem'), value: 'system', icon: 'globe' },
        { label: this.$t('themeLight'), value: 'light', icon: 'sun' },
        { label: this.$t('themeDark'), value: 'dark', icon: 'moon' }
      ]
    },
    langOptions () {
      return [
        { label: LANG_LABELS['zh-cn'], value: 'zh-cn' },
        { label: LANG_LABELS['zh-tw'], value: 'zh-tw' },
        { label: LANG_LABELS['en-us'], value: 'en-us' },
        { label: this.$t('languageSystem'), value: MODE_SYSTEM }
      ]
    },
    // 胶囊显示**解析后的实际值**（§4.6：例 `⚙ 暗色 · 简中`）。
    // 「跟随系统」这类模式只在弹层里体现，避免出现「跟随系统 · 跟随系统」这种读不懂的状态。
    themeLabel () {
      return this.$t(this.themeResolved === 'light' ? 'themeLight' : 'themeDark')
    },
    langLabel () {
      return LANG_LABELS[this.$i18n.locale] || LANG_LABELS['zh-cn']
    }
  },
  created () {
    this.langMode = this.readLangMode()
    // 与 Home 共用实例：外部（设置面板 / 系统主题变化）改主题也要同步本面板的选中态
    this.unwatchTheme = ThemeManager.onChange((d) => {
      this.themeMode = d.mode
      this.themeResolved = d.theme
    })
    // 最大化状态会因双击拖拽区 / Win+↑ 变化，主进程推回来切图标
    if (windowApi && windowApi.window && typeof windowApi.window.onMaximizedChange === 'function') {
      this.unwatchMax = windowApi.window.onMaximizedChange((v) => { this.maximized = v })
    }
  },
  beforeDestroy () {
    if (this.unwatchTheme) { this.unwatchTheme() }
    if (this.unwatchMax) { this.unwatchMax() }
    document.removeEventListener('keydown', this.onKeydown)
    document.removeEventListener('click', this.onDocClick)
  },
  mounted () {
    document.addEventListener('keydown', this.onKeydown)
    // 点弹层外部关闭（弹层与按钮各自 stop 冒泡，故此处只收「外部点击」）
    document.addEventListener('click', this.onDocClick)
  },
  methods: {
    /* ---------- 步骤推进 ---------- */
    next () {
      if (this.isLast) { this.finish(); return }
      this.dir = 'next'
      this.index += 1
    },
    prev () {
      if (this.index <= 0) { return }
      this.dir = 'prev'
      this.index -= 1
    },
    /** 跳过：与走完一样写完成标记，避免下次启动又弹 */
    skip () { onboarding.finish() },
    finish () { onboarding.finish() },

    /* ---------- 窗口按钮（桌面独立窗） ---------- */
    winMinimize () {
      if (windowApi && windowApi.window) { windowApi.window.minimize() }
    },
    winToggleMaximize () {
      if (windowApi && windowApi.window) { windowApi.window.toggleMaximize() }
    },
    winClose () {
      if (windowApi && windowApi.window) { windowApi.window.close() }
    },

    /* ---------- 右上角设置 ---------- */
    togglePop () { this.popOpen = !this.popOpen },
    closePop () { this.popOpen = false },
    onKeydown (e) {
      if (e.key !== 'Escape') { return }
      if (this.popOpen) { this.closePop() }
    },
    onDocClick () { this.closePop() },

    applyTheme (mode) {
      if (mode === MODE_SYSTEM) { ThemeManager.followSystem() } else { ThemeManager.set(mode) }
      this.themeMode = ThemeManager.getMode()
      this.themeResolved = ThemeManager.get()
    },

    /** 读存储里的语言模式（可能是 'system'，也可能是显式 locale） */
    readLangMode () {
      try {
        const raw = storage.getItem('globalSetting')
        if (raw) {
          const parsed = JSON.parse(raw)
          const v = parsed && parsed.language
          if (v === MODE_SYSTEM || SUPPORTED.indexOf(v) > -1) { return v }
        }
      } catch (e) { /* 读不到按跟随系统 */ }
      return MODE_SYSTEM
    },

    /**
     * 语言：① 立即切 i18n（经 resolveLocale，'system' 不落地）
     *       ② 写回 globalSetting.language 持久化
     */
    applyLang (mode) {
      this.langMode = mode
      const locale = resolveLocale(mode)
      if (SUPPORTED.indexOf(locale) > -1 && this.$i18n.locale !== locale) {
        this.$i18n.locale = locale
      }
      try {
        const raw = storage.getItem('globalSetting')
        const parsed = raw ? JSON.parse(raw) : {}
        const next = parsed && typeof parsed === 'object' ? parsed : {}
        next.language = mode
        storage.setItem('globalSetting', JSON.stringify(next))
      } catch (e) { /* 写不进去只影响持久化，不影响本次会话 */ }
    }
  }
}
</script>

<style scoped lang="scss">
// 断点统一取 styles/_bp.scss（禁止在本文件手写 360/480/820 等字面值）
@import "../styles/bp";

.ob {
  position: fixed;
  inset: 0;
  /* 桌面独立窗下 .ob 就是窗口本身（z-index 无意义）；CEP 仍是工作台上的浮层 */
  z-index: calc(var(--is-z-dialog) + 100);
  display: flex;
  flex-direction: column;
  background: var(--is-bg);
  color: var(--is-text);
  /* 指导面板里的文案默认不可选 —— 选中高亮会让人以为这是可复制的文档。
     三个 mockup 面板（.gate / .cm / .pv）是「模拟产品界面」，
     里面的名字与路径要能选中复制，由各自组件把 user-select 放回 text。 */
  user-select: none;
  -webkit-user-select: none;
}

/* ---------- 顶栏 ---------- */
.ob-top {
  position: relative;
  flex: 0 0 44px;
  display: flex;
  align-items: center;
  gap: var(--is-s-3);
  /* 右侧留出窗口按钮的宽度，按钮才不会被顶到窗口边缘外 */
  padding: 0 0 0 var(--is-s-5);
  background: var(--is-panel);
  border-bottom: 1px solid var(--is-border);
  /* 桌面独立窗 frameless：整条顶栏是拖拽区，窗口才能被拖动 */
  -webkit-app-region: drag;
}

/* 可点元素必须显式退出拖拽区，否则按钮按下被拖拽吞掉 */
.ob-top__right,
.ob-set__btn,
.ob-win__btn { -webkit-app-region: no-drag; }

.ob-top__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--is-fs-sm);
  color: var(--is-text-3);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ob-top__right {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  align-self: stretch;
}

/* ---------- 窗口按钮 ---------- */
.ob-win { display: flex; align-items: stretch; }

.ob-win__btn {
  width: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--is-text-2);
  cursor: pointer;
  transition: background-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.ob-win__btn:hover { background: var(--is-inset); color: var(--is-text); }
.ob-win__btn:active { background: var(--is-track); }

/* 关闭按钮 hover 走危险色，与其他平台惯例一致 */
.ob-win__btn--danger:hover {
  background: #d93025;
  color: #fff;
}

/* CEP 窄面板不该有一排占 138px 的窗口按钮 */
.ob--cep .ob-top { padding-right: 0; }

/* ---------- 右上角设置 ---------- */
.ob-set {
  position: relative;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  padding-right: var(--is-s-2);
}

.ob-set__btn {
  display: flex;
  align-items: center;
  gap: var(--is-s-2);
  cursor: pointer;
  padding: 5px 11px;
  border-radius: var(--is-r-pill);
  border: 1px solid var(--is-border-strong);
  background: var(--is-elevated);
  color: var(--is-text-2);
  font-size: var(--is-fs-xs);
  font-family: inherit;
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.ob-set__btn:hover,
.ob-set__btn[aria-expanded="true"] {
  border-color: var(--is-border-hi);
  color: var(--is-text);
}

.ob-set__sep { color: var(--is-text-3); }

.ob-set__pop {
  position: absolute;
  top: calc(100% + 8px);
  /* 贴设置胶囊右侧；面板有窗口按钮时按钮在更右，这里仍对齐胶囊不越出窗口 */
  right: var(--is-s-2);
  /* 296px：容得下「跟随系统 / 亮色 / 暗色」与「简体 / 繁體 / EN / 跟随系统」各一行，
     否则 IsSegmented 会折行。CEP 极窄 520 下仍在窗口内（left ≈ 224）。 */
  width: 296px;
  max-width: calc(100vw - 2 * var(--is-s-4));
  display: flex;
  flex-direction: column;
  gap: var(--is-s-4);
  padding: var(--is-s-4);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border-strong);
  background: var(--is-elevated);
  box-shadow: var(--is-shadow-lg);
  -webkit-app-region: no-drag;
}

.ob-set__field {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-2);
}

.ob-set__lbl {
  font-size: var(--is-fs-xs);
  color: var(--is-text-3);
}

.ob-pop-enter-active,
.ob-pop-leave-active {
  transition: opacity var(--is-dur-base) var(--is-ease-out),
    transform var(--is-dur-base) var(--is-ease-out);
  transform-origin: top right;
}

.ob-pop-enter,
.ob-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

/* ---------- 进度点 ---------- */
.ob-dots {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--is-s-2);
  padding: var(--is-s-5) 0 var(--is-s-3);
}

.ob-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--is-r-pill);
  background: var(--is-track);
  transition: width var(--is-dur-slow) var(--is-ease-out),
    background-color var(--is-dur-base) var(--is-ease-std);
}

.ob-dot.is-past { background: var(--is-border-strong); }

.ob-dot.is-on {
  width: 20px;
  background: var(--is-accent);
}

/* 光标扫过整排进度点也要有反馈，否则划过毫无变化 */
.ob-dot:hover { background: var(--is-border-hi); }
.ob-dot.is-past:hover { background: var(--is-text-3); }

/* ---------- 内容区 ---------- */
.ob-screen {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.ob-step-scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  /* auto margins center short steps while resolving to zero for tall steps,
     so small CEP panels keep the beginning of the content reachable. */
}

.ob-step {
  flex: 0 0 auto;
  min-width: 0;
  min-height: 0;
  padding: var(--is-s-2) var(--is-s-8) var(--is-s-6);
  width: 100%;
  /* 880：宽出 720 是为了末页 2×2 卡片横排（每列 ~420px，文字不必折成三行），
     同时输出页的「大小门槛」左右双栏也不至于挤。仍窄于窗口时不留白边。 */
  max-width: 880px;
  margin: auto;
}

.ob--cep .ob-step { padding: var(--is-s-2) var(--is-s-4) var(--is-s-5); }

/* 步骤切换：方向感（下一步左进、上一步右进） */
.ob-step-next-enter-active,
.ob-step-next-leave-active,
.ob-step-prev-enter-active,
.ob-step-prev-leave-active {
  transition: opacity var(--is-dur-base) var(--is-ease-std),
    transform var(--is-dur-base) var(--is-ease-out);
}

.ob-step-next-enter { opacity: 0; transform: translateX(18px); }
.ob-step-next-leave-to { opacity: 0; transform: translateX(-18px); }
.ob-step-prev-enter { opacity: 0; transform: translateX(-18px); }
.ob-step-prev-leave-to { opacity: 0; transform: translateX(18px); }

/* ---------- 页脚 ---------- */
.ob-foot {
  flex: 0 0 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--is-s-3);
  padding: 0 var(--is-s-6);
  background: var(--is-panel);
  border-top: 1px solid var(--is-border);
}

.ob--cep .ob-foot { padding: 0 var(--is-s-4); }

.ob-skip {
  border: 0;
  background: none;
  padding: var(--is-s-2);
  cursor: pointer;
  color: var(--is-text-3);
  font-family: inherit;
  font-size: var(--is-fs-sm);
  transition: color var(--is-dur-fast) var(--is-ease-std);
}

.ob-skip:hover { color: var(--is-text); }

.ob-foot__right {
  display: flex;
  align-items: center;
  gap: var(--is-s-3);
}

.ob-count {
  font-size: var(--is-fs-xs);
  color: var(--is-text-3);
  font-variant-numeric: tabular-nums;
}

/* 窄屏降档（含 CEP 面板）。
   AE 面板常见 380–480 宽、高度只有 400 上下；引导一屏放不下的直接观感就是
   「内容偏高、得上下滚动」——而这里本该是「一眼看完、点下一步」。
   故在 $bp-compact 及以下把外壳的纵向留白整体收紧：
   进度点、内容区上下内距、页脚高度各让出一档。 */
@media (max-width: $bp-compact) {
  .ob-dots { padding: var(--is-s-2) 0 var(--is-s-1); }
  .ob-foot { flex: 0 0 48px; padding: 0 var(--is-s-3); }
  .ob-count { display: none; }

  // 注意 `.ob--cep .ob-step` 的 CEP 覆盖规则比裸 `.ob-step` 权重高，
  // 两条都要写，否则 CEP 下这条不生效。
  .ob-step { padding: var(--is-s-1) var(--is-s-3) var(--is-s-3); }
  .ob--cep .ob-step { padding: var(--is-s-1) var(--is-s-3) var(--is-s-3); }
}

/* 窗口被拖窄到放不下两列时，卡片降为单列（先横排后滚动，而不是全程竖排） */
@media (max-width: 700px) {
  .ob-cards { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-reduced-motion: reduce) {
  .ob-dot,
  .ob-pop-enter-active,
  .ob-pop-leave-active,
  .ob-step-next-enter-active,
  .ob-step-next-leave-active,
  .ob-step-prev-enter-active,
  .ob-step-prev-leave-active {
    transition: none;
  }
}
</style>

<style lang="scss">
/* ==========================================================================
   步骤页共享版式（**非 scoped**：供 steps/* 与 demos/* 复用）
   统一 ob- 前缀，避免与工作台样式冲突。
   断点统一取 styles/_bp.scss，禁止手写 360/480/820 等字面值。
   ========================================================================== */
@import "../styles/bp";

.ob-pane {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-4);
}

/* 居中排版：标题/说明/按钮靠内容宽，但**网格类子元素必须显式撑满**。
   flex column 的 align-items:center 会给子项 align-self:center，宽度退回
   shrink-to-fit —— .ob-cards 那样 minmax(190px,1fr) 的 grid 只够排一列，
   表现为卡片竖排 + 页面被迫滚动。 */
.ob-pane--center {
  align-items: center;
  text-align: center;
  gap: var(--is-s-3);
  padding-top: var(--is-s-4);
}

.ob-pane--center > .ob-cards,
.ob-pane--center > .ob-mini,
.ob-pane--center > .ob-ways { width: 100%; }

.ob-demo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ob-h1 {
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-semi);
  line-height: 1.3;
  color: var(--is-text);
}

.ob-h2 {
  font-size: var(--is-fs-xl);
  font-weight: var(--is-fw-semi);
  line-height: 1.35;
  color: var(--is-text);
}

.ob-sub {
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text-2);
  /* 折行时两行等长，避免第二行只剩孤零零两个字 */
  text-wrap: balance;
}

.ob-note {
  font-size: var(--is-fs-xs);
  line-height: 1.6;
  color: var(--is-text-3);
}

/* ---------- 卡片网格 ---------- */
/* 固定两列：auto-fit 在窄容器会退化成 1 列，导致末页四张卡竖排并需要滚动。
   2×2 是「宽屏横排 / 窄屏单列」之间唯一稳定的形状。 */
.ob-cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--is-s-3);
}

/* 横排卡：2×2 布局下每列约 420px，竖排图标会把文字挤成窄条 */
.ob-card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: var(--is-s-3);
  padding: var(--is-s-4);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    background-color var(--is-dur-fast) var(--is-ease-std),
    transform var(--is-dur-base) var(--is-ease-out);
}

.ob-card__ico {
  color: var(--is-accent);
  display: flex;
  /* 图标与标题文字的视觉中线对齐 */
  padding-top: 2px;
  flex: 0 0 auto;
}

/* 标题+说明占满余下宽度：flex 子项默认 min-width:auto 会被长英文撑破列宽 */
.ob-card__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--is-s-1);
  text-align: left;
}

/* 卡片不可点，但整块一起抬一下 —— 光标划过时才有「这是一张卡」的实感 */
.ob-card:hover {
  border-color: var(--is-border-hi);
  background: var(--is-elevated);
  transform: translateY(-2px);
}

.ob-card__title {
  font-size: var(--is-fs-md);
  font-weight: var(--is-fw-semi);
  color: var(--is-text);
}

.ob-card__text {
  font-size: var(--is-fs-sm);
  line-height: 1.6;
  color: var(--is-text-2);
}

/* ---------- 有序步骤列表 ---------- */
.ob-lines {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-3);
}

.ob-line {
  display: flex;
  align-items: flex-start;
  gap: var(--is-s-3);
  padding: var(--is-s-3) var(--is-s-4);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    background-color var(--is-dur-fast) var(--is-ease-std),
    transform var(--is-dur-base) var(--is-ease-out);
}

.ob-line:hover {
  border-color: var(--is-border-hi);
  background: var(--is-elevated);
  transform: translateY(-2px);
}

.ob-line__idx {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--is-accent-dim);
  color: var(--is-accent);
  font-size: var(--is-fs-xs);
  font-weight: var(--is-fw-semi);
}

.ob-line__text {
  font-size: var(--is-fs-sm);
  line-height: 1.6;
  color: var(--is-text-2);
}

.ob-cta {
  display: flex;
  justify-content: center;
  padding-top: var(--is-s-2);
}

/* 窄屏降档（含 CEP 面板）：标题各降一档，内容块之间的间距收紧。
   目标是把「一屏内容」压进 AE 面板的可视高度，而不是让用户滚动看引导。 */
@media (max-width: $bp-compact) {
  .ob-h1 { font-size: var(--is-fs-xl); }
  .ob-h2 { font-size: var(--is-fs-lg); }
  .ob-pane { gap: var(--is-s-2); }
  .ob-pane--center { gap: var(--is-s-2); padding-top: var(--is-s-2); }
  .ob-sub { font-size: var(--is-fs-sm); }
  .ob-lines { gap: var(--is-s-2); }
  .ob-line { padding: var(--is-s-2) var(--is-s-3); }
  .ob-card { padding: var(--is-s-3); }
  .ob-cta { padding-top: 0; }
}

/* 降低动效：卡片只留描边/底色变化，不位移 */
@media (prefers-reduced-motion: reduce) {
  .ob-card,
  .ob-line { transition: border-color var(--is-dur-fast) var(--is-ease-std), background-color var(--is-dur-fast) var(--is-ease-std); }

  .ob-card:hover,
  .ob-line:hover { transform: none; }
}
</style>

