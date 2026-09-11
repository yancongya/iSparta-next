<template>
  <span class="is-ntween" :aria-label="finalLabel">{{ display }}</span>
</template>

<!--
  数字滚动：value 变化时 rAF 从旧值滚到新值（easeOutCubic，源自参考项目配方）。
  用法：<is-number-tween :value="doneCount" /> / <is-number-tween :value="pct" suffix="%" />
  无障碍：aria-label 始终是终值；prefers-reduced-motion 时跳过动画直接显示。
-->
<script>
var REDUCED = typeof window !== 'undefined' &&
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function easeOutCubic (t) {
  return 1 - Math.pow(1 - t, 3)
}

export default {
  name: 'IsNumberTween',
  props: {
    value: { type: Number, default: 0 },
    // 滚动时长；调大更「耐看」，调小更「利落」
    duration: { type: Number, default: 500 },
    // 后缀（如 %）；suffix 拼在显示值后，aria-label 用终值
    suffix: { type: String, default: '' },
    // 保留小数位（0 为整数）
    decimals: { type: Number, default: 0 }
  },
  data () {
    return {
      display: this.format(this.value)
    }
  },
  computed: {
    finalLabel () {
      return this.format(this.value) + this.suffix
    }
  },
  watch: {
    value (nv, ov) {
      if (REDUCED || nv === ov || !isFinite(nv) || !isFinite(ov)) {
        this.display = this.format(nv)
        return
      }
      this.run(ov, nv)
    }
  },
  beforeDestroy () {
    this.cancel()
  },
  methods: {
    format (n) {
      var v = Number(n) || 0
      return v.toFixed(this.decimals)
    },
    cancel () {
      if (this._raf) {
        window.cancelAnimationFrame(this._raf)
        this._raf = null
      }
    },
    run (from, to) {
      this.cancel()
      var start = performance.now()
      var dur = this.duration
      var self = this
      var step = function (now) {
        var t = Math.min(1, (now - start) / dur)
        var cur = from + (to - from) * easeOutCubic(t)
        self.display = self.format(cur) + (t >= 1 ? self.suffix : '')
        if (t < 1) {
          self._raf = window.requestAnimationFrame(step)
        } else {
          self._raf = null
        }
      }
      this._raf = window.requestAnimationFrame(step)
    }
  }
}
</script>
