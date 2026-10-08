<template>
  <div class="ob" :class="{ 'ob--cep': isCep }">
    <!-- 顶栏：窗口装饰 + 面板名 + 右上角设置（主题 · 语言） -->
    <header class="ob-top">
      <span class="ob-top__win" aria-hidden="true"><i></i><i></i><i></i></span>
      <span class="ob-top__name">{{ $t('obPanelName') }}</span>

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
      <transition :name="dir === 'prev' ? 'ob-step-prev' : 'ob-step-next'" mode="out-in">
        <component :is="currentComponent" :key="current.key" class="ob-step" />
      </transition>
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
 * 首启引导外壳（桌面 / CEP 共用）
 *
 * 外框三部分：顶栏（含右上角设置）→ 进度点 → 内容区 + 页脚。
 * 环节要点：
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
      langMode: MODE_SYSTEM
    }
  },
  computed: {
    isCep () { return hostAdapter.kind === 'cep' },
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
  },
  beforeDestroy () {
    if (this.unwatchTheme) { this.unwatchTheme() }
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

<style scoped>
.ob {
  position: fixed;
  inset: 0;
  z-index: calc(var(--is-z-dialog) + 100);
  display: flex;
  flex-direction: column;
  background: var(--is-bg);
  color: var(--is-text);
}

/* ---------- 顶栏 ---------- */
.ob-top {
  position: relative;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  gap: var(--is-s-3);
  padding: 0 var(--is-s-3);
  background: var(--is-panel);
  border-bottom: 1px solid var(--is-border);
}

.ob-top__win {
  display: flex;
  gap: 6px;
  flex: 0 0 auto;
}

.ob-top__win i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--is-track);
}

.ob-top__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: var(--is-fs-sm);
  color: var(--is-text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.ob--cep .ob-top__win { display: none; }

/* ---------- 右上角设置 ---------- */
.ob-set { position: relative; flex: 0 0 auto; }

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
  right: 0;
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

/* ---------- 内容区 ---------- */
.ob-screen {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
}

.ob-step {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--is-s-2) var(--is-s-8) var(--is-s-6);
  width: 100%;
  /* 720：输出页的「大小门槛」是左舞台 + 右设置的横向双栏，640 会把右侧压到折行 */
  max-width: 720px;
  margin: 0 auto;
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

/* CEP 极窄：页脚降档，避免按钮换行 */
@media (max-width: 480px) {
  .ob-dots { padding: var(--is-s-4) 0 var(--is-s-2); }
  .ob-foot { padding: 0 var(--is-s-3); }
  .ob-count { display: none; }
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

<style>
/* ==========================================================================
   步骤页共享版式（**非 scoped**：供 steps/* 与 demos/* 复用）
   统一 ob- 前缀，避免与工作台样式冲突。
   ========================================================================== */

.ob-pane {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-4);
}

.ob-pane--center {
  align-items: center;
  text-align: center;
  gap: var(--is-s-3);
  padding-top: var(--is-s-4);
}

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
.ob-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: var(--is-s-3);
}

.ob-card {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-2);
  padding: var(--is-s-4);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
}

.ob-card__ico {
  color: var(--is-accent);
  display: flex;
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

/* CEP 窄宽：卡片单列 */
@media (max-width: 480px) {
  .ob-h1 { font-size: var(--is-fs-xl); }
  .ob-h2 { font-size: var(--is-fs-lg); }
  .ob-cards { grid-template-columns: 1fr; }
}
</style>

