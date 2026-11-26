<template>
  <div class="own" :class="{ 'own--cep': isCep }">
    <div class="own-card">
      <div class="own-head">
        <is-icon name="sparkles" size="lg" class="own-ico" />
        <h1 class="own-title">{{ $t('obWhatsNewTitle', { ver: version }) }}</h1>
      </div>

      <p class="own-sub">{{ sub }}</p>

      <ul class="own-list">
        <li v-for="(item, i) in highlights" :key="i" class="own-li">
          <is-icon name="check-circle" size="sm" class="own-li-ico" />
          <span>{{ item }}</span>
        </li>
      </ul>

      <div class="own-cta">
        <is-button type="primary" size="md" @click="finish">{{ $t('obWhatsNewStart') }}</is-button>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * 升级后轻量「更新说明」单屏（替代完整 7 步首启引导）。
 *
 * 触发：RootGate 判定为「升级复播」（onboarding/state.js 的 isUpgradeReplay()）且为
 * CEP 面板浮层时渲染。只说明本次更新的重点，点「开始使用」即写完成标记并关闭，
 * 避免「装完一关 loading 立刻弹长引导」的割裂感。
 *
 * 亮点内容优先取「本次版本的实际更新说明」——检查更新时已把 Release 正文存进
 * updatePrefs.lastResult.notes，重启后可同步读到；读不到（手动安装 / 缓存缺失）
 * 才回退到 obWhatsNewH1/H2/H3 三条固定文案。这样升级弹窗永远说本次版本，不再是一成不变的三句。
 *
 * ⚠ 不直接依赖 Onboarding.vue 的 ob-* 全局样式，自包含 scoped 样式，保持独立可维护。
 */
import IsIcon from '../components/ui/IsIcon.vue'
import IsButton from '../components/ui/IsButton.vue'
import hostAdapter from '../../util/host-env'
import * as onboarding from './state'
import { APP_VERSION } from '../../brand'
import { loadUpdatePrefs } from '../../util/updatePrefs'

/** 从 formatReleaseNotes 文本里取首屏摘要（【分组】标题之前的行），最多 max 条 */
function briefLines (notes, max) {
  if (!notes || typeof notes !== 'string') { return [] }
  var lines = notes.split(/\r?\n/)
  var out = []
  for (var i = 0; i < lines.length; i++) {
    var t = String(lines[i]).trim()
    if (!t) { continue }
    if (/^【.+】$/.test(t)) { break }
    out.push(t.replace(/^·\s*/, ''))
    if (out.length >= max) { break }
  }
  return out
}

export default {
  name: 'OnboardingWhatsNew',
  components: { IsIcon, IsButton },
  computed: {
    isCep () { return hostAdapter.kind === 'cep' },
    version () { return APP_VERSION },
    /** 缓存的最新版本恰为当前版本时，才把 notes 当作「本次更新说明」 */
    releaseHighlights () {
      try {
        var last = loadUpdatePrefs().lastResult
        if (!last || !last.notes) { return [] }
        var latest = String(last.latest || '').replace(/^v/, '')
        if (latest && latest !== String(APP_VERSION)) { return [] }
        return briefLines(last.notes, 6)
      } catch (e) { return [] }
    },
    isDynamic () { return this.releaseHighlights.length > 0 },
    sub () {
      return this.isDynamic ? this.$t('obWhatsNewSubDynamic') : this.$t('obWhatsNewSub')
    },
    highlights () {
      if (this.isDynamic) { return this.releaseHighlights }
      return [
        this.$t('obWhatsNewH1'),
        this.$t('obWhatsNewH2'),
        this.$t('obWhatsNewH3')
      ]
    }
  },
  methods: {
    finish () { onboarding.finish() }
  }
}
</script>

<style scoped lang="scss">
// 断点变量来自 styles/_bp.scss（$bp-compact 等）；漏 import 会让 SCSS 报 Undefined variable
@import "../styles/bp";

.own {
  position: fixed;
  inset: 0;
  z-index: calc(var(--is-z-dialog) + 100);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--is-s-6);
  background: var(--is-bg);
  color: var(--is-text);
  user-select: none;
  -webkit-user-select: none;
}

.own-card {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: var(--is-s-4);
  padding: var(--is-s-8);
  border-radius: var(--is-r-lg);
  border: 1px solid var(--is-border);
  background: var(--is-card);
  box-shadow: var(--is-shadow-lg);
}

.own-head {
  display: flex;
  align-items: center;
  gap: var(--is-s-3);
}

.own-ico {
  color: var(--is-accent);
  flex: 0 0 auto;
}

.own-title {
  margin: 0;
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-semi);
  line-height: 1.3;
  color: var(--is-text);
}

.own-sub {
  margin: 0;
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text-2);
  text-wrap: balance;
}

.own-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--is-s-3);
}

.own-li {
  display: flex;
  align-items: flex-start;
  gap: var(--is-s-3);
  font-size: var(--is-fs-base);
  line-height: 1.6;
  color: var(--is-text);
}

.own-li-ico {
  color: var(--is-accent);
  flex: 0 0 auto;
  margin-top: 3px;
}

.own-cta {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--is-s-2);
}

/* 窄屏（含 CEP 面板）收紧内距，单屏放得下 */
@media (max-width: $bp-compact) {
  .own { padding: var(--is-s-3); }
  .own-card { padding: var(--is-s-5); }
  .own-title { font-size: var(--is-fs-xl); }
}

/* CEP 面板内铺满可用宽度（与 IsUpdateDialog 的 .is-dialog.upd-dialog padding:6px + .upd-panel--full width:100% 同口径）；
   桌面端仍是 460px 居中卡片。放在媒体查询之后，避免 compact 下的 .own padding 覆盖。 */
.own--cep {
  padding: 6px;
}
/* CEP 面板内上下也铺满：卡片撑满可用高度，主按钮沉底；
   .own 已 inset:0 + padding:6px，所以 height:100% 即 calc(100vh - 12px) */
.own--cep .own-card {
  max-width: none;
  height: 100%;
}
.own--cep .own-cta {
  margin-top: auto;
}

@media (prefers-reduced-motion: reduce) {
  .own-card { transition: none; }
}
</style>
