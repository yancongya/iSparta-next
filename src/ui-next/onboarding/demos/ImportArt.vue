<template>
  <div class="ia" aria-hidden="true">
    <!-- ① 拖入：图片序列帧 文件 / 文件夹 -->
    <svg v-if="kind === 'file'" class="ia__svg" viewBox="0 0 120 84" fill="none">
      <rect
        class="ia-drop"
        x="14" y="12" width="92" height="60" rx="10"
        stroke="var(--is-border-hi)" stroke-width="1.5" stroke-dasharray="6 5"
      />
      <g class="ia-frames">
        <rect x="36" y="26" width="22" height="17" rx="3.5" fill="var(--is-accent)" opacity="0.28" />
        <rect x="44" y="32" width="22" height="17" rx="3.5" fill="var(--is-accent)" opacity="0.55" />
        <rect x="52" y="38" width="22" height="17" rx="3.5" fill="var(--is-accent)" />
      </g>
    </svg>

    <!-- ② 粘贴：剪贴板图片 / 截图 -->
    <svg v-else-if="kind === 'paste'" class="ia__svg" viewBox="0 0 120 84" fill="none">
      <rect x="22" y="18" width="52" height="54" rx="8" fill="var(--is-card)" stroke="var(--is-border-strong)" stroke-width="1.5" />
      <rect x="36" y="11" width="24" height="13" rx="4" fill="var(--is-cool-bg)" stroke="var(--is-cool)" stroke-width="1.2" />
      <path d="M34 42h28M34 54h20" stroke="var(--is-border-strong)" stroke-width="2.5" stroke-linecap="round" />
      <g class="ia-key">
        <rect x="82" y="48" width="28" height="24" rx="7" fill="var(--is-card-hi)" stroke="var(--is-border-hi)" stroke-width="1.4" />
        <text x="96" y="65" text-anchor="middle" font-size="12" font-family="var(--is-mono)" fill="var(--is-text)">V</text>
      </g>
    </svg>

    <!-- ③ AE 合成：刷新读取合成树 -->
    <svg v-else class="ia__svg" viewBox="0 0 120 84" fill="none">
      <g class="ia-comp">
        <path d="M56 30l24 13-24 13-24-13z" fill="var(--is-violet-bg)" stroke="var(--is-violet)" stroke-width="1.4" />
      </g>
      <path d="M56 44l24 13-24 13-24-13z" fill="var(--is-card)" stroke="var(--is-border-strong)" stroke-width="1.4" />
      <g class="ia-spin">
        <!-- 圆心 (94,26)、r=13。原先 transform-origin 写的是弧线**起点**(96,30)，
             与真实圆心差了一整个半径，所以转起来像被甩出去。 -->
        <path d="M105.258 19.5A13 13 0 1 1 94 13" fill="none" stroke="var(--is-accent)" stroke-width="2.2" stroke-linecap="round" />
        <path d="M99 13L93.4 9.8L93.4 16.2Z" fill="var(--is-accent)" />
      </g>
    </svg>
  </div>
</template>

<script>
/**
 * 导入方式页的三枚图形（内联 SVG，按 kind 切换）。
 * kind：'file' 拖入序列帧 / 'paste' 剪贴板粘贴 / 'comp' AE 合成树。
 * 动效只用 transform / opacity / stroke-dasharray，颜色全走 token。
 */
export default {
  name: 'ImportArt',
  props: {
    kind: { type: String, default: 'file' }
  }
}
</script>

<style scoped>
.ia {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ia__svg {
  width: 120px;
  height: 84px;
  display: block;
  overflow: visible;
}

/* 相对自身盒求基准，避免画布坐标偏移 */
.ia-frames,
.ia-key,
.ia-comp {
  transform-box: fill-box;
  transform-origin: 50% 50%;
}

/* 刷新弧绕自身圆心转：必须用画布坐标，且原点要与弧心 (94,26) 严格一致
   （bbox 中心 ≠ 弧心，弧只有 300°，重心偏在缺口对面）。 */
.ia-spin {
  transform-box: view-box;
  transform-origin: 94px 26px;
}

.ia-frames { animation: ia-drop 2.6s var(--is-ease-out) infinite; }
.ia-key { animation: ia-tap 1.8s var(--is-ease-std) infinite; }
.ia-comp { animation: ia-lift 2.6s var(--is-ease-std) infinite; }
.ia-spin { animation: ia-rot 3.2s linear infinite; }
.ia-drop { animation: ia-dash 1.4s linear infinite; }

@keyframes ia-drop {
  0% { opacity: 0; transform: translateY(-14px); }
  30% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-3px); }
}

@keyframes ia-tap {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.82); opacity: 0.5; }
}

@keyframes ia-lift {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}

@keyframes ia-rot {
  to { transform: rotate(360deg); }
}

@keyframes ia-dash {
  to { stroke-dashoffset: -22; }
}

@media (prefers-reduced-motion: reduce) {
  .ia-frames,
  .ia-key,
  .ia-comp,
  .ia-spin,
  .ia-drop {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .ia-drop { stroke-dashoffset: 0; }
}
</style>
