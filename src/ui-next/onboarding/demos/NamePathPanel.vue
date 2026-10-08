<template>
  <div class="pv">
    <!-- 上：拼路径（预设 → 模板 → 变量积木） -->
    <div class="pv__build">
      <p class="pv-label">{{ $t('obNamingPath') }}</p>
      <div class="pv-presets" role="group">
        <button
          v-for="p in presets"
          :key="p.key"
          type="button"
          class="pv-preset"
          :class="{ 'is-on': activePreset === p.key }"
          :aria-pressed="activePreset === p.key ? 'true' : 'false'"
          @click="applyPreset(p.key)"
        >{{ p.label }}</button>
      </div>

      <input
        ref="tpl"
        class="pv-input"
        type="text"
        spellcheck="false"
        :value="pathTpl"
        :aria-label="$t('obNamingVarPath')"
        @input="pathTpl = $event.target.value"
      />

      <div class="pv-vars" role="group">
        <button
          v-for="k in VAR_KEYS"
          :key="k"
          type="button"
          class="pv-var"
          @click="insertVar(k)"
        >
          <span class="pv-var__key">{{ '{' + k + '}' }}</span>
          <span class="pv-var__val">{{ varChip(k) }}</span>
        </button>
      </div>
    </div>

    <!-- 下：真实路径 —— 整行横条，跟着上面的模板与上一页的分词一起变 -->
    <div class="pv-out">
      <span class="pv-out__label">{{ $t('obNamingRealPath') }}</span>
      <p class="pv-out__path" :title="resolvedPath">{{ pathShown }}</p>
    </div>
  </div>
</template>

<script>
/**
 * 第 5 页 · 输出路径变量化
 * 预设模板 + 变量积木点选插入 + 真实路径即时预览（结果走底部整行横条）。
 * {name} 取上一页的切分结果（naming-store），其余取演示上下文；
 * 纯占位替换，**不读写任何真实路径**。
 */
import { naming, FALLBACK_NAME } from './naming-store'

const PATH_CTX = {
  srcPath: 'D:/Assets/demo/sticker-pack/frames',
  src: 'frames',
  type: 'PNGs',
  parent: 'D:/Assets/demo/sticker-pack',
  date: '20260915'
}
const VAR_KEYS = ['srcPath', 'src', 'name', 'type', 'parent', 'date']
const PRESET_MAP = {
  src: '{srcPath}',
  beside: '{parent}',
  custom: '{srcPath}/export/{date}'
}

export default {
  name: 'NamePathPanel',
  data () {
    return {
      VAR_KEYS,
      pathTpl: PRESET_MAP.src,
      activePreset: 'src'
    }
  },
  computed: {
    presets () {
      return [
        { key: 'src', label: this.$t('obNamingPresetSrc') },
        { key: 'beside', label: this.$t('obNamingPresetBeside') },
        { key: 'custom', label: this.$t('obNamingPresetCustom') }
      ]
    },
    resolvedPath () { return this.resolveVars(this.pathTpl) },
    /**
     * 单行显示用：超长时从**左**截断 —— 路径尾部（目标目录 / 文件名）才是要看的，
     * 全文另外挂在 title 上。预算按半角宽度算（CJK 记 2），保证 CEP 520 面板下
     * 一次截到位，不会再被 CSS 二次裁掉尾巴。
     */
    pathShown () {
      const full = this.resolvedPath || ''
      const budget = 50
      let w = 0
      for (let i = full.length - 1; i >= 0; i--) {
        w += full.charCodeAt(i) > 0x2e80 ? 2 : 1
        if (w > budget) { return '…' + full.slice(i + 1) }
      }
      return full
    }
  },
  methods: {
    /** {name} 走上一页的切分结果，其余走演示上下文 */
    varValue (key) {
      return key === 'name' ? (naming.name || FALLBACK_NAME) : PATH_CTX[key]
    },
    varChip (key) {
      const v = this.varValue(key)
      return v.length > 18 ? v.slice(0, 17) + '…' : v
    },
    resolveVars (text) {
      return String(text || '').replace(/\{([a-zA-Z]+)\}/g, (m, key) => {
        return (key in PATH_CTX || key === 'name') ? this.varValue(key) : m
      })
    },
    applyPreset (key) {
      if (!(key in PRESET_MAP)) { return }
      this.activePreset = key
      this.pathTpl = PRESET_MAP[key]
    },
    insertVar (key) {
      const el = this.$refs.tpl
      const ins = '{' + key + '}'
      if (!el) { this.pathTpl += ins; return }
      const val = el.value || this.pathTpl
      const start = el.selectionStart == null ? val.length : el.selectionStart
      const end = el.selectionEnd == null ? val.length : el.selectionEnd
      this.pathTpl = val.slice(0, start) + ins + val.slice(end)
      this.$nextTick(() => {
        el.focus()
        try { el.setSelectionRange(start + ins.length, start + ins.length) } catch (e) { /* 忽略 */ }
      })
    }
  }
}
</script>

<style scoped>
/* 单列：上面拼路径，下面一行看结果。
   左右分栏会把「真实路径」挤成窄条，稍长的路径就折成好几行；
   改成占满宽度的整行横条，路径单行显示，页面也不高。 */
.pv {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--is-s-2);
  /* mockup 面板例外：这里模拟的是真实路径设置，模板与预览路径要能选中复制 */
  user-select: text;
  -webkit-user-select: text;
}

.pv__build {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
}

.pv-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--is-s-2);
  margin-bottom: var(--is-s-2);
}

.pv-preset {
  padding: 4px 11px;
  border-radius: var(--is-r-pill);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text-2);
  font-size: var(--is-fs-sm);
  cursor: pointer;
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.pv-preset:hover { border-color: var(--is-border-hi); }

.pv-preset.is-on {
  border-color: var(--is-accent);
  color: var(--is-accent);
  background: var(--is-accent-soft);
}

.pv-label {
  margin: 0 0 var(--is-s-2);
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  letter-spacing: 0.04em;
  color: var(--is-text-3);
}

.pv-input {
  width: 100%;
  padding: 7px 11px;
  border-radius: var(--is-r-sm);
  border: 1.5px solid var(--is-border);
  background: var(--is-inset);
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-sm);
  transition: border-color var(--is-dur-fast) var(--is-ease-std);
}

.pv-input:hover { border-color: var(--is-border-strong); }

.pv-input:focus {
  outline: none;
  border-color: var(--is-accent);
}

.pv-vars {
  display: flex;
  flex-wrap: wrap;
  gap: var(--is-s-2);
  margin-top: var(--is-s-3);
}

.pv-var {
  display: inline-flex;
  align-items: center;
  gap: var(--is-s-1);
  max-width: 100%;
  padding: 3px 8px;
  border-radius: var(--is-r-sm);
  border: 1px solid var(--is-border);
  background: var(--is-inset);
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  cursor: pointer;
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    transform var(--is-dur-fast) var(--is-ease-std);
}

.pv-var:hover {
  border-color: var(--is-accent);
  transform: translateY(-1px);
}

.pv-var__key {
  flex: 0 0 auto;
  color: var(--is-accent);
  font-weight: var(--is-fw-bold);
}

.pv-var__val {
  min-width: 0;
  max-width: 150px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--is-text-3);
}

/* 真实路径横条：标签固定、路径吃满剩余宽度，单行显示。
   超长由 pathShown 从左截断（尾部目录名可见），CSS 只兜底防溢出。 */
.pv-out {
  display: flex;
  align-items: center;
  gap: var(--is-s-2);
  min-width: 0;
  padding: 9px 11px;
  border-radius: var(--is-r-sm);
  border: 1px dashed var(--is-border);
  background: var(--is-inset);
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    background-color var(--is-dur-fast) var(--is-ease-std);
}

.pv-out:hover {
  border-color: var(--is-border-strong);
  background: var(--is-elevated);
}

.pv-out__label {
  flex: 0 0 auto;
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  letter-spacing: 0.04em;
  color: var(--is-text-3);
}

.pv-out__path {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (prefers-reduced-motion: reduce) {
  .pv-preset,
  .pv-var { transition: none; }

  .pv-var:hover { transform: none; }
}
</style>
