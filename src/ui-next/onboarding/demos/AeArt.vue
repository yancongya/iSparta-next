<template>
  <div class="ae" aria-hidden="true">
    <svg class="ae__svg" viewBox="0 0 300 120" fill="none">
      <!-- AE 主窗口 -->
      <rect x="8" y="10" width="240" height="96" rx="10" fill="var(--is-card)" stroke="var(--is-border-strong)" stroke-width="1.5" />
      <path d="M8 20a10 10 0 0 1 10-10h220a10 10 0 0 1 10 10v12H8z" fill="var(--is-panel)" />
      <circle cx="22" cy="21" r="3.2" fill="var(--is-bad)" opacity="0.7" />
      <circle cx="34" cy="21" r="3.2" fill="var(--is-track)" />
      <circle cx="46" cy="21" r="3.2" fill="var(--is-track)" />
      <text x="66" y="25" font-size="10" font-family="var(--is-mono)" fill="var(--is-text-3)">After Effects</text>

      <!-- 左：时间轴占位 -->
      <rect x="20" y="42" width="104" height="54" rx="7" fill="var(--is-inset)" stroke="var(--is-border)" />
      <path
        d="M34 56h58M34 70h42M34 84h68"
        stroke="var(--is-border-strong)" stroke-width="3" stroke-linecap="round"
      />

      <!-- 右：本面板滑入 -->
      <g class="ae-panel">
        <rect x="136" y="42" width="100" height="54" rx="7" fill="var(--is-accent-soft)" stroke="var(--is-accent)" stroke-width="1.5" />
        <rect x="148" y="52" width="62" height="8" rx="4" fill="var(--is-accent)" />
        <rect x="148" y="66" width="46" height="6" rx="3" fill="var(--is-border-strong)" />
        <rect x="148" y="78" width="54" height="6" rx="3" fill="var(--is-border-strong)" />
      </g>

      <!-- 右上：重启提示环
           弧的圆心是 (268,62)，r=16。旋转基准必须与圆心重合，
           原写法把弧线**起点**当成了圆心（真实圆心在 (252.0,62.03)），于是环一边转一边甩。 -->
      <g class="ae-spin">
        <path
          d="M281.856 54A16 16 0 1 1 268 46"
          fill="none" stroke="var(--is-warn)" stroke-width="2.6" stroke-linecap="round"
        />
        <!-- 箭头落在弧线终点切线方向（顶部朝右） -->
        <path d="M273.6 46L267.8 42.6L267.8 49.4Z" fill="var(--is-warn)" />
      </g>
    </svg>
  </div>
</template>

<script>
/**
 * AE 扩展页动图：AE 窗口里面板滑入 + 重启提示环。
 * 内联 SVG + token 色；动效只用 transform / opacity。
 */
export default { name: 'AeArt' }
</script>

<style scoped>
.ae {
  display: flex;
  align-items: center;
  justify-content: center;
}

.ae__svg {
  width: 100%;
  max-width: 320px;
  height: auto;
  display: block;
  overflow: visible;
}

.ae-panel {
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: ae-slide 3.2s var(--is-ease-out) infinite;
}

.ae-spin {
  /* view-box 基准 + 显式圆心：transform-origin 必须与圆弧圆心 (268,62) 一致，
     否则旋转是「绕画面外一点」转，看起来会先甩再跳。 */
  transform-box: view-box;
  transform-origin: 268px 62px;
  animation: ae-rot 3.4s linear infinite;
}

@keyframes ae-slide {
  0% { opacity: 0; transform: translateX(52px); }
  34% { opacity: 1; transform: translateX(0); }
  86% { opacity: 1; transform: translateX(0); }
  100% { opacity: 0; transform: translateX(52px); }
}

@keyframes ae-rot {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .ae-panel,
  .ae-spin {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
