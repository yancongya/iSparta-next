/**
 * 系统语言探测 —— 环境自适应（生产环境）
 *
 * 用途：首次启动、或用户从未显式选择语言时，跟随操作系统的语言与区域。
 *      「预览环境」不消费本模块（原型台 / 浏览器 mock 的语言由控制台手动指定）。
 *
 * 设计要点：
 *   1. **纯函数、零副作用** —— 不读写 storage、不碰 DOM 状态，便于单测与双端复用。
 *   2. 优先读宿主桥（`ispartaAPI.os.locale`，为将来可能的 `app.getLocale()` 预留），
 *      否则退回 Web 标准 API。CEP 没有 `ispartaAPI`，会自然落到 `navigator.*`，
 *      因此**不需要按端分支**。
 *   3. 应用只提供三语，故中文收敛为 简中 / 繁中 两种，其余语言一律 `en-us`。
 *
 * 与主题的对称性：主题侧已有 `src/ui-next/theme.js`（`mode === 'system'` 跟随
 * `prefers-color-scheme`，含实时监听），语言侧由本模块补齐同一套「system 哨兵」语义。
 */

/** 应用受支持的语言（与 src/i18n.js 的 messages 键一致） */
export const SUPPORTED = ['zh-cn', 'zh-tw', 'en-us']

/** 存储哨兵值：表示「跟随系统」，与 ThemeManager 的 'system' 语义对齐 */
export const MODE_SYSTEM = 'system'

/** 探测彻底失败时的回落值（应用中文优先，保持既有默认行为） */
export const FALLBACK = 'zh-cn'

/**
 * 单个 BCP-47 语言标签 → 应用受支持的 locale。
 * 输入非法（非字符串 / 空 / 非语言标签形状）返回 `null`，
 * 以区别于「合法但应用不支持」的语言（后者返回 `en-us`）。
 *
 *   zh / zh-CN / zh-Hans / zh-SG / zh-MY      → zh-cn
 *   zh-TW / zh-HK / zh-MO / zh-Hant / zh-Hant-HK → zh-tw
 *   其余任何合法标签（en / en-GB / ja / de …）  → en-us
 */
export function normalizeTag (tag) {
  if (typeof tag !== 'string') { return null }
  const t = tag.trim().toLowerCase().replace(/_/g, '-')
  if (!t) { return null }
  const parts = t.split('-')
  const primary = parts[0]
  if (!/^[a-z]{2,3}$/.test(primary)) { return null }
  if (primary === 'zh') {
    const rest = parts.slice(1).join('-')
    // 繁体：显式 Hant，或台 / 港 / 澳地区码（中国香港、中国澳门使用繁体）
    if (/(^|-)hant(-|$)/.test(rest) || /(^|-)(tw|hk|mo)(-|$)/.test(rest)) {
      return 'zh-tw'
    }
    // 其余中文（zh / zh-hans / zh-sg / zh-my …）→ 简体
    return 'zh-cn'
  }
  return 'en-us'
}

/**
 * 按优先级收集宿主环境的语言标签（原始值，未归一化）。
 * 顺序：宿主桥 → `navigator.languages`（已按用户偏好排序）→ `navigator.language`
 *       → `Intl` 解析值。
 */
export function readEnvTags () {
  const out = []
  const push = function (v) {
    if (typeof v === 'string' && v && out.indexOf(v) === -1) { out.push(v) }
  }

  if (typeof window !== 'undefined') {
    // 1) 宿主桥：目前尚未暴露 os.locale，命中即用（Electron 主进程 app.getLocale()）
    try {
      const api = window.ispartaAPI
      if (api && api.os && typeof api.os.locale === 'function') { push(api.os.locale()) }
    } catch (e) { /* 桥未就绪：跳过 */ }

    // 2) Web 标准：navigator.languages 优先（用户偏好列表）
    try {
      const nav = window.navigator
      if (nav) {
        if (nav.languages && nav.languages.length) {
          for (let i = 0; i < nav.languages.length; i++) { push(nav.languages[i]) }
        } else {
          push(nav.language)
        }
      }
    } catch (e) { /* ignore */ }
  }

  // 3) Intl 兜底
  try {
    push(Intl.DateTimeFormat().resolvedOptions().locale)
  } catch (e) { /* ignore */ }

  return out
}

/**
 * 探测结果（含诊断信息，供原型台 / 日志展示）。
 * @returns {{ locale: string, tag: string, source: 'env'|'fallback', candidates: string[] }}
 */
export function explainSystemLocale () {
  const candidates = readEnvTags()
  for (let i = 0; i < candidates.length; i++) {
    const locale = normalizeTag(candidates[i])
    if (locale) { return { locale: locale, tag: candidates[i], source: 'env', candidates: candidates } }
  }
  return { locale: FALLBACK, tag: '', source: 'fallback', candidates: candidates }
}

/** 探测系统语言 → 受支持 locale；全部失败时回落 `FALLBACK` */
export function detectSystemLocale () {
  return explainSystemLocale().locale
}

/**
 * 把「存储里的语言模式」解析成实际 locale。
 * 显式选择（zh-cn / zh-tw / en-us）原样返回；`'system'` 或空值 → 跟随系统。
 * 供 `src/i18n.js` 的 `detectLocale()` 直接调用——**不要把 `'system'` 赋给
 * `i18n.locale`**，vue-i18n 不认这个键。
 */
export function resolveLocale (mode) {
  if (SUPPORTED.indexOf(mode) > -1) { return mode }
  return detectSystemLocale()
}
