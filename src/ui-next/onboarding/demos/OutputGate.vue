<template>
  <div class="gate">
    <!-- ── 左：实时结果 ───────────────────────────────────────── -->
    <div class="gate__stage">
      <div class="gate-q">
        <div class="gate-q__head">
          <span>{{ $t('obGateQuality') }}</span>
          <b class="gate-q__val">{{ q }}</b>
        </div>
        <input
          class="gate-q__slider"
          type="range"
          min="10"
          max="100"
          step="1"
          :value="q"
          :aria-label="$t('obGateQuality')"
          @input="onSlide($event.target.value)"
        />
      </div>

      <div class="gate-result" :class="resultClass">
        <!-- 横向一行到底：格式 · 状态 · 体积 · 阈值。原来竖着堆 4 行，高度全耗在这 -->
        <div class="gate-result__line">
          <span class="gate-result__fmt">{{ fmt }}</span>
          <span class="gate-badge" :class="[badgeClass, { 'is-pop': pop }]">{{ badgeText }}</span>
          <span :key="logSeq" class="gate-result__size">{{ sizeText }}</span>
          <span class="gate-result__vs">{{ vsText }}</span>
        </div>
        <div class="gate-meter">
          <div class="gate-meter__fill" :class="fillClass" :style="{ width: fillPct + '%' }"></div>
          <div class="gate-meter__limit" :style="{ left: limitPct + '%' }"></div>
        </div>
      </div>

      <div class="gate-formats" role="group">
        <button
          v-for="f in FORMATS"
          :key="f"
          type="button"
          class="gate-fmt"
          :class="{ 'is-on': f === fmt }"
          :aria-pressed="f === fmt ? 'true' : 'false'"
          @click="pickFmt(f)"
        >{{ f }}</button>
      </div>

      <!-- 日志只留最新一行：不给滚动条，也就不会把整页顶高 -->
      <p class="gate-log" :class="latestLog ? latestLog.cls : ''" :aria-label="$t('obGateReplay')">{{ latestLog ? latestLog.text : idleText }}</p>
    </div>

    <!-- ── 右：阈值设置（选项横向分栏，压到 3 行以内） ───────────── -->
    <aside class="gate__panel">
      <p class="gate__panel-title">{{ $t('obGateThreshold') }}</p>

      <div class="gate-grid">
        <label class="gate-field gate-field--wide">
          <span>{{ $t('obGateLimit') }}</span>
          <span class="gate-field__row">
            <input
              class="gate-num gate-num--limit"
              type="number"
              :min="unit === 'KB' ? 1 : 0.1"
              :step="unit === 'KB' ? 32 : 0.1"
              v-model.number="limitRaw"
              @change="stop"
            />
            <span class="gate-unit">
              <button
                type="button"
                class="gate-unit__btn"
                :class="{ 'is-on': unit === 'MB' }"
                @click="setUnit('MB')"
              >MB</button>
              <button
                type="button"
                class="gate-unit__btn"
                :class="{ 'is-on': unit === 'KB' }"
                @click="setUnit('KB')"
              >KB</button>
            </span>
          </span>
        </label>

        <label class="gate-toggle">
          <input type="checkbox" v-model="enabled" @change="stop">
          <span>{{ $t('obGateEnable') }}</span>
        </label>

        <label class="gate-toggle">
          <input class="gate-check" type="checkbox" v-model="autoQuality" @change="stop">
          <span>{{ $t('obGateAutoQuality') }}</span>
        </label>

        <label class="gate-field">
          <span>{{ $t('obGateStep') }}</span>
          <span class="gate-field__row">
            <input class="gate-num" type="number" min="1" max="20" v-model.number="stepVal" @change="stop">
            <span class="gate-suffix">q</span>
          </span>
        </label>

        <label class="gate-field">
          <span>{{ $t('obGateTries') }}</span>
          <span class="gate-field__row">
            <input class="gate-num" type="number" min="3" max="8" v-model.number="tries" @change="stop">
            <span class="gate-suffix">{{ $t('obGateTimes') }}</span>
          </span>
        </label>
      </div>

      <p class="gate-hint">{{ $t('obGateHint') }}</p>

      <div class="gate-actions">
        <is-button type="primary" size="sm" :disabled="running" @click="runDemo">
          {{ $t('obGateReplay') }}
        </is-button>
      </div>
    </aside>
  </div>
</template>

<script>
/**
 * 输出设置 · 大小门槛（对齐落地页 SIZE GATE 的交互 / 版式 / 动效）
 *
 * 逻辑与 landing/main.js 的 sizeGate 一致：
 *   · sizeForQuality(q, fmt) 是纯函数，体积只由质量与格式推导；
 *   · 阈值单位 MB / KB 互转时同步换算输入值（1 MB = 1024 KB）；
 *   · 「自动重压」从 q=85 起按 step 递减，直到 ≤ 阈值、或达最多重试 / q 触底。
 * 动效只用 width / opacity / transform；颜色全走 token（暗色荧光绿、亮色砖橙）。
 */
const FORMATS = ['APNG', 'GIF', 'WEBP']
const FMT_FACTOR = { APNG: 1, GIF: 0.72, WEBP: 0.55 }

export default {
  name: 'OutputGate',
  data () {
    return {
      FORMATS,
      q: 85,
      fmt: 'APNG',
      unit: 'MB',
      limitRaw: 1,
      enabled: true,
      autoQuality: true,
      stepVal: 12,
      tries: 5,
      running: false,
      pop: false,
      log: [],
      timer: null,
      logSeq: 0
    }
  },
  computed: {
    maxMB () {
      const raw = Math.max(0, Number(this.limitRaw) || 0)
      return this.unit === 'KB' ? raw / 1024 : (raw || 1)
    },
    limitLabel () {
      if (!this.enabled) { return '' }
      const raw = Number(this.limitRaw) || 0
      if (this.unit === 'KB') { return Math.round(raw) + ' KB' }
      return String(Number(raw.toFixed(2))) + ' MB'
    },
    mb () { return this.sizeForQuality(this.q, this.fmt) },
    ok () { return !this.enabled || this.mb <= this.maxMB },
    resultClass () { return this.ok ? 'is-pass' : 'is-over' },
    badgeClass () { return this.ok ? 'is-pass' : 'is-over' },
    badgeText () {
      if (!this.enabled) { return this.$t('obGateNoLimit') }
      return this.ok ? this.$t('obGatePass') : this.$t('obGateOver')
    },
    sizeText () { return this.mb.toFixed(2) + ' MB' },
    vsText () {
      return this.enabled
        ? this.$t('obGateLimit') + ' ' + this.limitLabel
        : this.$t('obGateLimitOff')
    },
    fillClass () { return this.ok ? 'is-ok' : 'is-over' },
    /** 面板上只落最新一行，旧的不留 —— 不产生滚动条也就不会把整页顶高 */
    latestLog () { return this.log.length ? this.log[0] : null },
    idleText () { return this.$t('obGateReplay') },
    /** 计量条量程：给阈值留出 2.2 倍余量，超限也看得见「超了多少」 */
    fillPct () {
      const scale = Math.max(this.maxMB * 2.2, this.mb + 0.2, 1)
      return Math.min(100, (this.mb / scale) * 100)
    },
    limitPct () {
      const scale = Math.max(this.maxMB * 2.2, 1)
      return Math.min(100, (this.maxMB / scale) * 100)
    }
  },
  created () {
    this.reduceMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },
  mounted () {
    // 进页即演示一次（reduce-motion 下瞬完，停在终态）
    this.timer = setTimeout(this.runDemo, this.reduceMotion ? 0 : 700)
  },
  beforeDestroy () { this.stop() },
  methods: {
    /* ---------- 体积模型（与落地页同一条曲线） ---------- */
    sizeForQuality (q, fmt) {
      const t = (100 - q) / 90
      const base = Math.max(0.18, 2.85 * Math.pow(1 - t * 0.88, 1.7) + 0.1)
      return base * (FMT_FACTOR[fmt] || 1)
    },

    /* ---------- 交互 ---------- */
    onSlide (v) {
      this.stop()
      this.q = Number(v) || 85
    },
    pickFmt (f) {
      this.stop()
      this.fmt = f
    },
    setUnit (u) {
      if (u === this.unit) { return }
      this.stop()
      const cur = Number(this.limitRaw) || 1
      this.limitRaw = u === 'KB' ? Math.round(cur * 1024) : Number((cur / 1024).toFixed(2))
      this.unit = u
    },

    /* ---------- 自动重压演示 ---------- */
    addLog (text, cls) {
      this.logSeq += 1
      this.log.unshift({ id: this.logSeq, text, cls: cls || '' })
      if (this.log.length > 5) { this.log.pop() }
    },
    stop () {
      this.running = false
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
    },
    runDemo () {
      this.stop()
      this.log = []
      let q = 85
      let n = 0
      this.running = true
      this.q = q
      // 每档停 900ms：够看清「体积数字掉一档 + 计量条退一格」，430ms 时几乎是一闪而过
      const delay = this.reduceMotion ? 0 : 900

      const attempt = () => {
        if (!this.running) { return }
        this.q = q
        n += 1
        const mb = this.sizeForQuality(q, this.fmt)
        const head = '#' + n + ' · q=' + q + ' · ' + mb.toFixed(2) + 'MB'

        if (!this.enabled) {
          this.addLog(head + ' · ' + this.$t('obGateNoLimit'), 'is-pass')
          this.finish(true)
          return
        }
        if (mb <= this.maxMB) {
          this.addLog(head + ' · ' + this.$t('obGatePass'), 'is-pass')
          this.finish(true)
          return
        }
        this.addLog(head + ' · ' + this.$t('obGateOver'), 'is-over')

        if (!this.autoQuality) { this.finish(false); return }
        if (n >= this.tries || q <= 10) { this.finish(false); return }

        q = Math.max(10, q - this.stepVal)
        this.timer = setTimeout(attempt, delay)
      }

      this.timer = setTimeout(attempt, this.reduceMotion ? 0 : 480)
    },
    finish (ok) {
      this.running = false
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      if (!ok) { return }
      // 达标时给徽标一次「弹一下」，与落地页同款反馈
      this.pop = false
      requestAnimationFrame(() => {
        this.pop = true
        setTimeout(() => { this.pop = false }, 620)
      })
    }
  }
}
</script>

<style scoped>
/* ---------- 版式：左舞台 + 右设置 ----------
   整页按「不竖滚」设计：所有内边距取 s-3，右侧选项走两栏网格，
   日志只留一行 —— 单列高度控制在 ~300px 以内。 */
.gate {
  display: grid;
  grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr);
  gap: var(--is-s-3);
  /* 两张卡等高：舞台的日志用 margin-top:auto 钉在底部，右侧按钮同理 */
  align-items: stretch;
  /* mockup 面板例外：这里模拟的是真实输出面板，数字/日志要能选中复制 */
  user-select: text;
  -webkit-user-select: text;
}

.gate__stage,
.gate__panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--is-s-3);
  border-radius: var(--is-r-lg);
  border: 1px solid var(--is-border);
  background: var(--is-card);
}

/* ---------- 质量滑块 ---------- */
.gate-q { margin-bottom: var(--is-s-3); }

.gate-q__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--is-s-1);
  font-size: var(--is-fs-xs);
  color: var(--is-text-2);
}

.gate-q__val {
  color: var(--is-text);
  font-variant-numeric: tabular-nums;
}

/* 方向锁死左 → 右：不随 RTL / 继承的 direction 反向 */
.gate-q__slider {
  display: block;
  width: 100%;
  margin: 0;
  direction: ltr;
  writing-mode: horizontal-tb;
  unicode-bidi: isolate;
  accent-color: var(--is-accent);
  cursor: pointer;
}

/* ---------- 结果卡（横向一行 + 计量条，共 2 行） ---------- */
.gate-result {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-2);
  padding: var(--is-s-2) var(--is-s-3) var(--is-s-3);
  margin-bottom: var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1.5px solid var(--is-border);
  background: var(--is-inset);
  transition: border-color var(--is-dur-base) var(--is-ease-std),
    background-color var(--is-dur-base) var(--is-ease-std),
    box-shadow var(--is-dur-fast) var(--is-ease-std);
}

.gate-result.is-pass {
  border-color: var(--is-ok);
  background: var(--is-ok-bg);
}

.gate-result.is-over {
  border-color: var(--is-warn);
  background: var(--is-warn-bg);
}

.gate-result__line {
  display: flex;
  align-items: center;
  gap: var(--is-s-2);
  min-width: 0;
}

.gate-result__fmt {
  flex: 0 0 auto;
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  letter-spacing: 0.06em;
  color: var(--is-text-2);
}

.gate-badge {
  flex: 0 0 auto;
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  font-weight: var(--is-fw-bold);
  padding: 2px 9px;
  border-radius: var(--is-r-pill);
  border: 1px solid var(--is-border);
  color: var(--is-text-2);
  background: var(--is-card);
}

.gate-badge.is-pass {
  color: var(--is-ok-fg);
  border-color: var(--is-ok);
  background: var(--is-ok-bg);
}

.gate-badge.is-over {
  color: var(--is-warn-fg);
  border-color: var(--is-warn);
  background: var(--is-warn-bg);
}

.gate-badge.is-pop { animation: gate-pop 0.6s var(--is-ease-overshoot); }

.gate-result__size {
  flex: 0 0 auto;
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-black);
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--is-text);
  font-variant-numeric: tabular-nums;
  /* key 挂在 logSeq 上：每试一次重挂一次节点，这格就跟着闪一下 */
  animation: gate-tick var(--is-dur-slow) var(--is-ease-out);
}

.gate-result__vs {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: var(--is-s-2);
  text-align: right;
  font-size: var(--is-fs-xs);
  color: var(--is-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---------- 计量条 ---------- */
.gate-meter {
  position: relative;
  height: 8px;
  border-radius: var(--is-r-pill);
  background: var(--is-track);
}

.gate-meter__fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  border-radius: var(--is-r-pill);
  background: var(--is-accent);
  transition: width var(--is-dur-slow) var(--is-ease-out),
    background-color var(--is-dur-base) var(--is-ease-std);
}

.gate-meter__fill.is-ok { background: var(--is-ok); }
.gate-meter__fill.is-over { background: var(--is-warn); }

/* 阈值刻度线：不再挂文字标签（那一行右侧已经写了「阈值 1 MB」），
   否则标签会顶到上面的体积数字上。 */
.gate-meter__limit {
  position: absolute;
  top: -3px;
  bottom: -3px;
  width: 2px;
  border-radius: 1px;
  background: var(--is-text);
  transition: left var(--is-dur-base) var(--is-ease-std);
}

/* ---------- 格式 chip ---------- */
.gate-formats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--is-s-2);
  margin-bottom: var(--is-s-3);
}

.gate-fmt {
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  color: var(--is-text-2);
  background: var(--is-inset);
  border: 1.5px solid var(--is-border);
  border-radius: var(--is-r-pill);
  padding: 4px 11px;
  cursor: pointer;
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.gate-fmt:hover { border-color: var(--is-border-hi); }

.gate-fmt.is-on {
  color: var(--is-accent);
  border-color: var(--is-accent);
  background: var(--is-accent-soft);
  font-weight: var(--is-fw-semi);
}

/* 结果卡与日志是只读展示，且自带通过/超限状态色 ——
   hover 不去碰描边色（会盖掉状态语义），只加一层极轻的投影。 */
.gate-result:hover,
.gate-log:hover { box-shadow: var(--is-shadow-xs); }

/* ---------- 试次日志：只留最新一行，永不产生滚动条 ---------- */
.gate-log {
  margin: auto 0 0;
  padding: 5px 10px;
  border-radius: var(--is-r-sm);
  border: 1px solid var(--is-border);
  background: var(--is-inset);
  font-family: var(--is-mono);
  font-size: 10px;
  line-height: 1.5;
  color: var(--is-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: box-shadow var(--is-dur-fast) var(--is-ease-std);
  animation: gate-in var(--is-dur-base) var(--is-ease-out) both;
}

.gate-log.is-pass {
  border-color: var(--is-ok);
  color: var(--is-ok-fg);
  background: var(--is-ok-bg);
}

.gate-log.is-over {
  border-color: var(--is-warn);
  color: var(--is-warn-fg);
  background: var(--is-warn-bg);
}

/* ---------- 右侧设置 ---------- */
.gate__panel-title {
  margin: 0 0 var(--is-s-2);
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  letter-spacing: 0.04em;
  color: var(--is-text-3);
}

/* 选项横向铺开：阈值独占一行，其余两两并排 —— 5 行压到 3 行 */
.gate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--is-s-2) var(--is-s-3);
  margin-bottom: var(--is-s-3);
}

.gate-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--is-s-2);
  min-width: 0;
  font-size: var(--is-fs-sm);
  color: var(--is-text-2);
}

.gate-field > span:first-child {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.gate-field--wide { grid-column: 1 / -1; }

.gate-field__row {
  display: inline-flex;
  align-items: center;
  gap: var(--is-s-1);
  flex: 0 0 auto;
}

.gate-toggle {
  display: flex;
  align-items: center;
  gap: var(--is-s-2);
  min-width: 0;
  font-size: var(--is-fs-sm);
  color: var(--is-text-2);
  cursor: pointer;
}

.gate-toggle > span {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color var(--is-dur-fast) var(--is-ease-std);
}

.gate-toggle:hover > span { color: var(--is-text); }

.gate-toggle input,
.gate-check {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  accent-color: var(--is-accent);
  cursor: pointer;
}

.gate-num {
  width: 58px;
  padding: 4px 6px;
  border-radius: var(--is-r-sm);
  border: 1.5px solid var(--is-border);
  background: var(--is-inset);
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-sm);
  text-align: center;
  transition: border-color var(--is-dur-fast) var(--is-ease-std);
}

.gate-num--limit { width: 64px; }

.gate-num:hover { border-color: var(--is-border-strong); }

.gate-num:focus {
  outline: none;
  border-color: var(--is-accent);
}

.gate-suffix {
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  color: var(--is-text-3);
}

.gate-unit {
  display: inline-flex;
  border: 1.5px solid var(--is-border);
  border-radius: var(--is-r-sm);
  overflow: hidden;
}

.gate-unit__btn {
  border: 0;
  background: var(--is-inset);
  color: var(--is-text-3);
  font-family: var(--is-mono);
  font-size: 10px;
  font-weight: var(--is-fw-bold);
  padding: 5px 7px;
  cursor: pointer;
  transition: background-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

/* 未选中那半片才有 hover：选中态已是强调色，再变反而晃 */
.gate-unit__btn:hover {
  color: var(--is-text);
  background: var(--is-hover);
}

.gate-unit__btn.is-on {
  background: var(--is-accent);
  color: var(--is-on-accent);
}

.gate-hint {
  margin: 0 0 var(--is-s-2);
  font-size: var(--is-fs-xs);
  line-height: 1.5;
  color: var(--is-text-3);
  /* 最多两行，别让它把面板撑起来 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.gate-actions {
  margin-top: auto;
  padding-top: var(--is-s-1);
  display: flex;
}

@keyframes gate-pop {
  0% { transform: scale(1); }
  45% { transform: scale(1.16); }
  100% { transform: scale(1); }
}

@keyframes gate-tick {
  from { opacity: 0.3; transform: translateY(-3px); }
  to { opacity: 1; transform: none; }
}

@keyframes gate-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: none; }
}

/* CEP 极窄：单列堆叠 */
@media (max-width: 560px) {
  .gate { grid-template-columns: 1fr; }
  .gate-result__size { font-size: var(--is-fs-xl); }
}

@media (prefers-reduced-motion: reduce) {
  .gate-result,
  .gate-meter__fill,
  .gate-meter__limit,
  .gate-log,
  .gate-badge.is-pop,
  .gate-result__size,
  .gate-fmt {
    transition: none;
    animation: none;
  }
}
</style>
