<template>
  <div class="bs">
    <!--
      顶栏直接复用 IsWinBar（主窗自绘顶栏）：logo + 软件名 + 版本号 + 窗口按钮，
      连 mac 红绿灯差异与「双击拖拽区最大化」的判定都是现成的。
      自绘一份只会与主窗漂移 —— 主窗去掉原生标题bar 后，顶栏就以它为准。
    -->
    <is-win-bar />

    <!--
      内容区：严格照参考布局自上而下五段 ——
      插画 → 大标题 → 副文案 → 整幅细进度条 → 条下居中状态词。
      进度百分比只走无障碍读数，不在视觉上另起一块（参考图没有右侧数字）。
    -->
    <main class="bs-body">
      <div class="bs-pane">
        <div class="bs-art"><boot-demo /></div>

        <h1 class="bs-title">{{ $t('obBootTitle') }}</h1>
        <p class="bs-sub">{{ $t('obBootSub') }}</p>

        <!-- 整幅细进度条：撑满内容栏，不是居中短条 -->
        <div
          class="bs-bar"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="$t('obBootTitle')"
        >
          <div class="bs-bar__fill" :style="{ width: percent + '%' }"></div>
        </div>

        <!-- 状态词：与轨道同宽、居中（实测参考图：轨道 x100–699 / 状态词中心 399.5，中点 400） -->
        <p class="bs-status">{{ statusText }}</p>
      </div>
    </main>
  </div>
</template>

<script>
/**
 * 启动进度窗（独立无边框小窗，桌面专属）。
 *
 * 为什么是独立窗而不是引导的第 0 步：
 *   启动进度属于「应用还没就绪」的阶段，而引导窗要等渲染层 storage 就绪才能判定
 *   是否弹出（onboarding/state.js 的 isDone）。若把它塞进引导流程，就等于让一个
 *   尚未就绪的阶段依赖一个依赖它的阶段，顺序上说不通。独立窗由主进程直接开，
 *   不参与引导的步骤状态机。
 *
 * 顶栏不自己画：直接用IsWinBar（主窗自绘顶栏）。主窗去掉原生标题栏后，
 * logo + 软件名 + 版本号 + 窗口按钮以它为准，另画一份必然漂移。
 *
 * 布局参照产品内「正在处理」页的通行版式（自上而下五段）：
 *   插画 → 大标题 → 副文案 → 整幅细进度条 → 条下居中状态词。
 * 百分比不进视觉层（参考图没有右侧数字），只作为 progressbar 的无障碍读数。
 *
 * 生命周期（主进程 background.js 负责，渲染层只报进度）：
 *   app ready → 开本窗（主窗先不show）→ 渲染层跑完阶段 → 发 boot:done
 *   → 主进程关本窗；需要重播引导则改开引导窗，否则 show 主窗。
 */
import IsWinBar from '../components/IsWinBar.vue'
import BootDemo from '../onboarding/demos/BootDemo.vue'

/** 阶段键与 locales 的 obBootStage* 一一对应 */
const STAGE_KEYS = ['obBootStageEnv', 'obBootStageTheme', 'obBootStageCep', 'obBootStageReady']
/** 每个阶段完成后的百分比（递增，最后一个=100） */
const STAGE_PCT = [25, 50, 80, 100]

const windowApi = (typeof window !== 'undefined' && window.ispartaAPI) || null

export default {
  name: 'BootSplash',
  components: { IsWinBar, BootDemo },
  data () {
    return {
      cursor: 0,
      done: STAGE_KEYS.map(() => false),
      reported: 0
    }
  },
  computed: {
    /** 状态词 = 当前阶段文案；全跑完后停在最后一个阶段词（就绪） */
    statusText () {
      const i = Math.min(this.cursor, STAGE_KEYS.length - 1)
      return this.$t(STAGE_KEYS[i])
    },
    percent () {
      let p = 6
      for (let i = 0; i < this.done.length; i++) {
        if (this.done[i]) { p = STAGE_PCT[i] }
      }
      return p
    },
    reduced () {
      return typeof window !== 'undefined' &&
        !!window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  },
  async mounted () {
    // 各阶段对应真实的启动工作；任何一段失败都继续往下走，绝不把用户卡在启动页
    await this.stage(0, () => this.probeStorage())
    await this.stage(1, () => this.waitFrame())
    await this.stage(2, () => this.probeCep())
    await this.stage(3, () => {})

    // 主进程等这个信号才关本窗：留一点时间让 100% 被看见（reduce 下更短）
    await this.wait(this.reduced ? 150 : 420)
    this.report(100)
    if (windowApi && windowApi.ipc && typeof windowApi.ipc.send === 'function') {
      try { windowApi.ipc.send('boot:done') } catch (e) { /* 主进程有 8s 兜底 */ }
    }
  },
  methods: {
    wait (ms) { return new Promise((r) => setTimeout(r, ms)) },


    /** 跑一个阶段：完成后推进游标与百分比，并向主进程报一次进度 */
    async stage (i, fn) {
      try { await fn() } catch (e) { /* 单段失败不阻断 */ }
      this.done[i] = true
      this.cursor = Math.min(i + 1, this.done.length - 1)
      this.report(this.percent)
      await this.wait(this.reduced ? 60 : 170)
    },

    report (pct) {
      if (pct <= this.reported) { return }
      this.reported = pct
      try {
        if (windowApi && windowApi.ipc && typeof windowApi.ipc.send === 'function') {
          windowApi.ipc.send('boot:progress', pct)
        }
      } catch (e) { /* ignore */ }
    },

    /** 阶段 1：确认存储桥可用（读一次真实键，读不到也算通过） */
    async probeStorage () {
      const store = (typeof window !== 'undefined' && window.storage) || null
      if (store && typeof store.getItem === 'function') {
        try { store.getItem('globalSetting') } catch (e) { /* ignore */ }
      }
    },

    /** 阶段 2：等一帧，确保主题类已落到 <html>（main.js 在挂载前已init） */
    waitFrame () {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') { requestAnimationFrame(() => resolve()) }
        else { resolve() }
      })
    },

    /** 阶段 3：只读探测 CEP / 更新元数据，不做任何安装动作 */
    async probeCep () {
      try {
        if (windowApi && windowApi.ipc && typeof windowApi.ipc.invoke === 'function') {
          await windowApi.ipc.invoke('updater:meta')
        }
      } catch (e) { /* ignore */ }
    },

  }
}
</script>

<style scoped>
.bs {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--is-bg);
  color: var(--is-text);
  user-select: none;
  -webkit-user-select: none;
}

/* ---------- 内容区 ---------- */
.bs-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/*
  五段纵向流。间距按参考图的比例给：
  插画顶到底 / 大标题 / 副文案 / 进度条 / 状态词，整体在窗内垂直居中偏上，
  底部留白略大于顶部 —— 与参考图的视觉重心一致。
*/
.bs-pane {
  margin: auto;
  width: 100%;
  /* 与引导 .ob-step 的 880 上限同口径：两窗的内容栏宽看起来是一套 */
  max-width: 880px;
  padding: var(--is-s-8) var(--is-s-8) var(--is-s-10);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.bs-art { display: flex; align-items: center; justify-content: center; }

.bs-title {
  margin: var(--is-s-6) 0 0;
  /* 参考图标题是全页最重的一档：2xl + bold */
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-bold);
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--is-text);
}

.bs-sub {
  margin: var(--is-s-3) 0 0;
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text-2);
  text-wrap: balance;
}

/* ---------- 整幅细进度条 ---------- */
/* 撑满内容栏，高度 6px（实测参考图轨道高 6px、左右各留白 100px @800 宽）。
   用 padding 把轨道从内容栏里再收窄一点，复刻那100px 的留白比例。 */
.bs-bar {
  width: 100%;
  margin-top: var(--is-s-6);
  height: 6px;
  border-radius: var(--is-r-pill);
  background: var(--is-track);
  overflow: hidden;
}

.bs-bar__fill {
  height: 100%;
  border-radius: var(--is-r-pill);
  background: var(--is-accent);
  transition: width var(--is-dur-slow) var(--is-ease-out);
}

/* ---------- 状态词：与轨道同宽、居中 ---------- */
.bs-status {
  width: 100%;
  margin: var(--is-s-3) 0 0;
  text-align: center;
  font-size: var(--is-fs-sm);
  line-height: 1.6;
  color: var(--is-text-3);
  transition: color var(--is-dur-base) var(--is-ease-std);
}

@media (prefers-reduced-motion: reduce) {
  .bs-bar__fill,
  .bs-status { transition: none; }
}
</style>