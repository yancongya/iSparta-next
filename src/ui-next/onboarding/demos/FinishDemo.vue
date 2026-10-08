<template>
  <div class="demo" aria-hidden="true">
    <svg class="demo__svg" viewBox="0 0 200 200" fill="none">
      <!-- 圆环描边绘制 -->
      <circle
        class="demo__ring anim"
        cx="100" cy="100" r="62"
        stroke="var(--is-accent)" stroke-width="3" stroke-linecap="round"
        transform="rotate(-90 100 100)"
      />
      <!-- 对勾绘制 -->
      <path
        class="demo__check anim"
        d="M74 102l18 19 36-40"
        stroke="var(--is-accent)" stroke-width="3.4"
        stroke-linecap="round" stroke-linejoin="round"
      />
      <!-- 三点弹出（错相位） -->
      <circle class="demo__dot demo__dot--1 anim" cx="100" cy="166" r="3.4" fill="var(--is-ok)" />
      <circle class="demo__dot demo__dot--2 anim" cx="100" cy="166" r="3.4" fill="var(--is-cool)" />
      <circle class="demo__dot demo__dot--3 anim" cx="100" cy="166" r="3.4" fill="var(--is-violet)" />
    </svg>
  </div>
</template>

<script>
/** 完成页动图：环绘制 → 对勾绘制 → 三点弹出，全部内联 SVG + token 色。 */
export default { name: 'FinishDemo' }
</script>

<style scoped>
.demo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.demo__svg {
  width: 152px;
  height: 152px;
  display: block;
  overflow: visible;
}

.demo__ring {
  stroke-dasharray: 390;
  stroke-dashoffset: 390;
  animation: fd-draw 1.1s var(--is-ease-out) both;
}

.demo__check {
  stroke-dasharray: 76;
  stroke-dashoffset: 76;
  animation: fd-draw 0.55s var(--is-ease-out) 0.95s both;
}

.demo__dot {
  opacity: 0;
  animation: fd-dot 0.6s var(--is-ease-spring) both;
}

.demo__dot--1 { animation-delay: 1.5s; }
.demo__dot--2 { animation-delay: 1.62s; }
.demo__dot--3 { animation-delay: 1.74s; }

@keyframes fd-draw {
  to { stroke-dashoffset: 0; }
}

@keyframes fd-dot {
  0% { opacity: 0; transform: translateY(8px) scale(0.4); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .demo__ring,
  .demo__check,
  .demo__dot {
    animation: none;
    opacity: 1;
    stroke-dashoffset: 0;
    transform: none;
  }
}
</style>
