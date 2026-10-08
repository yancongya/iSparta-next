<template>
  <div class="pv">
    <!-- 左：拼路径（预设 → 模板 → 变量积木） -->
    <div class="pv__col">
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

    <!-- 右：真实路径即时预览（跟着左栏的模板与上一页的分词一起变） -->
    <div class="pv__col pv__col--out">
      <p class="pv-label">{{ $t('obNamingRealPath') }}</p>
      <p class="pv-preview">{{ resolvedPath }}</p>
    </div>
  </div>
</template>

<script>
/**
 * 第 5 页 · 输出路径变量化
 * 与落地页 #naming 右栏一致：预设模板 + 变量积木点选插入 + 真实路径即时预览。
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
    resolvedPath () { return this.resolveVars(this.pathTpl) }
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
/* 横向双栏：左拼路径、右看结果。原来是竖着一路排下来，
   在 CEP 那种矮窗口里必然要上下滚 —— 拆成两栏后单页高度直接砍半。 */
.pv {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
  gap: var(--is-s-3);
  align-items: stretch;
}

.pv__col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
}

.pv__col--out { background: var(--is-inset); }

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
}

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

/* 预览块撑满右栏剩余高度 —— 不用再给 min-height 去「占位」 */
.pv-preview {
  flex: 1 1 auto;
  margin: 0;
  padding: 10px 11px;
  border-radius: var(--is-r-sm);
  border: 1px dashed var(--is-border);
  background: var(--is-card);
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-sm);
  line-height: 1.6;
  word-break: break-all;
}

@media (prefers-reduced-motion: reduce) {
  .pv-preset,
  .pv-var { transition: none; }

  .pv-var:hover { transform: none; }
}

/* CEP 极窄：回落到单列，靠 .ob-step 自己的滚动兜底 */
@media (max-width: 560px) {
  .pv { grid-template-columns: 1fr; }
}
</style>
