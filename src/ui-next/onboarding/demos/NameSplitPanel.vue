<template>
  <div class="cm">
    <div class="cm-row">
      <input
        class="cm-input"
        type="text"
        spellcheck="false"
        :value="nameText"
        :aria-label="$t('obNamingOut')"
        @input="onInput($event.target.value)"
      />
      <button
        type="button"
        class="cm-funnel"
        :class="{ 'is-on': wordsOnly }"
        :title="$t('obNamingFilter')"
        :aria-pressed="wordsOnly ? 'true' : 'false'"
        @click="toggleFunnel"
      >
        <is-icon name="filter" size="sm" />
      </button>
    </div>

    <div class="cm-tokens">
      <button
        v-for="(t, i) in tokens"
        :key="i"
        type="button"
        class="cm-tok"
        :class="[t.sep ? 'is-sep' : 'cm-tok--c' + ((colorIdx[i] % 6) + 1), { 'is-off': !t.on }]"
        :aria-pressed="t.on ? 'true' : 'false'"
        @click="toggleToken(i)"
      >{{ t.text }}</button>
    </div>

    <p class="cm-hint">{{ wordsOnly ? $t('obNamingHintWords') : $t('obNamingHint') }}</p>
  </div>
</template>

<script>
/**
 * 第 4 页 · 文件名切分
 * 规则与落地页 #naming 左栏一致：汉字串 / 拉丁词 / 数字 / 单个非字母数字字符各成一段，
 * 纯符号段标记为 sep（默认关掉）。漏斗按钮「只留文字 / 恢复全部」来回切。
 * 切分结果写入 naming-store，供下一页的 {name} 变量取值。
 */
import { setName } from './naming-store'

const TOKEN_RE = /[\u4E00-\u9FFF]+|[A-Za-z]+|\d+|[^A-Za-z0-9\u4E00-\u9FFF]/g
const SEP_RE = /^[^A-Za-z0-9\u4E00-\u9FFF]+$/
const RAW_NAME = '示例贴纸-行走循环 高清_v3'

export default {
  name: 'NameSplitPanel',
  data () {
    return {
      nameText: RAW_NAME,
      tokens: []
    }
  },
  computed: {
    /** 每个非分隔 token 的配色下标（分隔符不占号，避免配色跳号） */
    colorIdx () {
      let w = 0
      return this.tokens.map((t) => {
        if (t.sep) { return 0 }
        const cur = w
        w += 1
        return cur
      })
    },
    joined () { return this.tokens.filter((t) => t.on).map((t) => t.text).join('') },
    /** 「只留文字」= 有分隔符，且分隔符全被关掉 */
    wordsOnly () {
      if (!this.tokens.length) { return false }
      let sepTotal = 0
      let sepOff = 0
      for (let i = 0; i < this.tokens.length; i++) {
        const t = this.tokens[i]
        if (!t.sep && !t.on) { return false }
        if (t.sep) {
          sepTotal += 1
          if (!t.on) { sepOff += 1 }
        }
      }
      return sepTotal > 0 && sepOff === sepTotal
    }
  },
  watch: {
    // 每次切分结果变化都同步给下一页的 {name}
    joined: { immediate: true, handler (v) { setName(v) } }
  },
  created () {
    this.tokens = this.tokenize(RAW_NAME).map((t) => ({ text: t.text, sep: t.sep, on: !t.sep }))
  },
  methods: {
    tokenize (name) {
      const parts = String(name).match(TOKEN_RE) || []
      return parts.map((text) => ({ text, sep: SEP_RE.test(text) }))
    },
    onInput (v) {
      this.nameText = v
      // 手打时全部打开：用户已经自己决定要什么了
      this.tokens = this.tokenize(v).map((t) => ({ text: t.text, sep: t.sep, on: true }))
    },
    toggleToken (i) {
      const next = this.tokens.slice()
      next[i] = { text: next[i].text, sep: next[i].sep, on: !next[i].on }
      this.tokens = next
      this.nameText = next.filter((t) => t.on).map((t) => t.text).join('')
    },
    toggleFunnel () {
      const restore = this.wordsOnly // 当前是「只留文字」→ 恢复分隔符
      this.tokens = this.tokens.map((t) => ({ text: t.text, sep: t.sep, on: t.sep ? restore : true }))
      this.nameText = this.joined
    }
  }
}
</script>

<style scoped>
.cm {
  display: flex;
  flex-direction: column;
  /* mockup 面板例外：这里模拟的是真实命名面板，名字要能选中复制 */
  user-select: text;
  -webkit-user-select: text;
}

.cm-row {
  display: flex;
  gap: var(--is-s-2);
  margin-bottom: var(--is-s-3);
}

.cm-input {
  flex: 1 1 auto;
  min-width: 0;
  padding: 9px 12px;
  border-radius: var(--is-r-sm);
  border: 1.5px solid var(--is-border);
  background: var(--is-inset);
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-md);
  transition: border-color var(--is-dur-fast) var(--is-ease-std);
}

.cm-input:hover { border-color: var(--is-border-strong); }

.cm-input:focus {
  outline: none;
  border-color: var(--is-accent);
}

.cm-funnel {
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: var(--is-r-sm);
  border: 1.5px solid var(--is-border);
  background: var(--is-inset);
  color: var(--is-text-2);
  cursor: pointer;
  transition: border-color var(--is-dur-fast) var(--is-ease-std),
    color var(--is-dur-fast) var(--is-ease-std);
}

.cm-funnel:hover { color: var(--is-text); border-color: var(--is-border-hi); }

.cm-funnel.is-on {
  border-color: var(--is-accent);
  color: var(--is-accent);
  background: var(--is-accent-soft);
}

.cm-tokens {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--is-s-2);
  min-height: 88px;
  margin-bottom: var(--is-s-3);
  padding: var(--is-s-3);
  border-radius: var(--is-r-md);
  border: 1px solid var(--is-border);
  background: var(--is-card);
}

.cm-tok {
  padding: 5px 11px;
  border-radius: var(--is-r-sm);
  border: 1.5px solid transparent;
  background: var(--is-inset);
  color: var(--is-text);
  font-family: var(--is-mono);
  font-size: var(--is-fs-sm);
  font-weight: var(--is-fw-semi);
  cursor: pointer;
  transition: opacity var(--is-dur-fast) var(--is-ease-std),
    transform var(--is-dur-fast) var(--is-ease-std),
    border-color var(--is-dur-fast) var(--is-ease-std);
}

.cm-tok:hover { transform: translateY(-1px); }

.cm-tok.is-sep {
  background: transparent;
  border-color: var(--is-border);
  border-style: dashed;
  color: var(--is-text-3);
  font-weight: var(--is-fw-medium);
}

.cm-tok.is-off {
  opacity: 0.32;
  text-decoration: line-through;
}

/* 六色走 var-* 令牌（RGB 分量），与路径变量 chip 同源。
   底色 + 同色描边：单看一枚也能认出「这是另一段」。 */
.cm-tok--c1 { color: rgb(var(--is-var-1)); background: rgba(var(--is-var-1), 0.15); border-color: rgba(var(--is-var-1), 0.34); }
.cm-tok--c2 { color: rgb(var(--is-var-2)); background: rgba(var(--is-var-2), 0.15); border-color: rgba(var(--is-var-2), 0.34); }
.cm-tok--c3 { color: rgb(var(--is-var-3)); background: rgba(var(--is-var-3), 0.15); border-color: rgba(var(--is-var-3), 0.34); }
.cm-tok--c4 { color: rgb(var(--is-var-4)); background: rgba(var(--is-var-4), 0.15); border-color: rgba(var(--is-var-4), 0.34); }
.cm-tok--c5 { color: rgb(var(--is-var-5)); background: rgba(var(--is-var-5), 0.15); border-color: rgba(var(--is-var-5), 0.34); }
.cm-tok--c6 { color: rgb(var(--is-var-6)); background: rgba(var(--is-var-6), 0.15); border-color: rgba(var(--is-var-6), 0.34); }

.cm-hint {
  margin: 0;
  font-size: var(--is-fs-xs);
  line-height: 1.6;
  color: var(--is-text-3);
}

@media (prefers-reduced-motion: reduce) {
  .cm-tok,
  .cm-funnel { transition: none; }

  .cm-tok:hover { transform: none; }
}
</style>
