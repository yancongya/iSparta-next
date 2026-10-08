<template>
  <div class="brand">
    <svg class="brand__svg" viewBox="0 0 132 132" fill="none" aria-hidden="true">
      <!-- 轨道环 + 绕行点（点留在无 transform 的父层，避免飞出画布） -->
      <circle class="brand__ring" cx="66" cy="66" r="54" stroke="var(--is-border-strong)" stroke-width="1.5" />
      <g class="brand__orbit">
        <circle class="anim" cx="66" cy="12" r="4.5" fill="var(--is-accent)" />
      </g>

      <!-- 品牌标：与 public/icons/icon-brand.svg 同源几何，色值改走 token -->
      <g class="brand__mark">
        <g transform="translate(66 66) scale(0.1375) translate(-512 -395.636364)">
          <circle cx="512" cy="395.636364" r="232.727273" fill="var(--is-accent)" />
          <path
            d="M453.806545 289.764848a7.214545 7.214545 0 0 1 8.168728-6.112969l77.548606 11.155394c1.881212 0.271515 3.580121 1.272242 4.728242 2.788848l70.943031 93.796849a7.214545 7.214545 0 0 1 0.100848 8.564363L544.267636 498.722909a7.214545 7.214545 0 0 1-4.871757 2.936243L461.459394 512.391758a7.214545 7.214545 0 0 1-6.997333-11.132122l67.285333-101.558303a7.214545 7.214545 0 0 0-0.077576-8.079515L455.00897 294.888727a7.214545 7.214545 0 0 1-1.202425-5.12z m-6.729697 37.783273a3.607273 3.607273 0 0 1 5.054061 0.702061l47.736243 63.146666a7.214545 7.214545 0 0 1 0.104727 8.556607L452.189091 466.540606a3.607273 3.607273 0 0 1-6.543515-2.102303V330.426182a3.607273 3.607273 0 0 1 1.435151-2.878061z"
            fill="var(--is-on-accent)"
          />
        </g>
      </g>
    </svg>

    <!-- 字标：名字取自品牌单一来源 brand.js，不写进 locale -->
    <p class="brand__name">
      <span>iSparta</span><em class="brand__suffix">-next</em>
    </p>
  </div>
</template>

<script>
/**
 * 欢迎页品牌标：项目 logo（内联 SVG，同 icon-brand.svg 几何）+ iSparta-next 字标。
 * 动效只用 transform / opacity，颜色全走 token（暗色荧光绿、亮色砖橙自动跟随）。
 */
export default { name: 'WelcomeDemo' }
</script>

<style scoped>
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--is-s-3);
}

.brand__svg {
  width: 132px;
  height: 132px;
  display: block;
  overflow: visible;
}

/* SVG 内定位基准：统一以 viewBox 中心为原点 */
.brand__ring,
.brand__orbit,
.brand__mark {
  transform-box: view-box;
  transform-origin: 50% 50%;
}

.brand__ring {
  opacity: 0.55;
  animation: wd-draw 1.2s var(--is-ease-out) both;
}

.brand__orbit { animation: wd-orbit 9s linear infinite; }

.brand__orbit .anim { animation: is-pulse 2.6s var(--is-ease-std) infinite; }

.brand__mark { animation: wd-pop 0.9s var(--is-ease-spring) 0.15s both; }

.brand__name {
  margin: 0;
  font-size: var(--is-fs-2xl);
  font-weight: var(--is-fw-bold);
  letter-spacing: -0.01em;
  line-height: 1.2;
  color: var(--is-text);
  animation: wd-rise 0.7s var(--is-ease-out) 0.3s both;
}

.brand__suffix { font-style: normal; color: var(--is-accent); }

@keyframes wd-draw {
  from { opacity: 0; }
  to { opacity: 0.55; }
}

@keyframes wd-orbit {
  to { transform: rotate(360deg); }
}

@keyframes wd-pop {
  0% { transform: scale(0.62); opacity: 0; }
  62% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes wd-rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .brand__ring,
  .brand__orbit,
  .brand__orbit .anim,
  .brand__mark,
  .brand__name {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .brand__ring { opacity: 0.55; }
}
</style>
