<template>
  <div class="boot-demo" aria-hidden="true">
    <svg class="boot-demo__svg" viewBox="0 0 132 132" fill="none">
      <!-- 轨道环 + 绕行点：与 WelcomeDemo 同源几何，保证两页视觉同宗-->
      <circle
        class="boot-demo__ring anim"
        cx="66" cy="66" r="54"
        stroke="var(--is-border-strong)" stroke-width="1.5"
      />
      <g class="boot-demo__orbit">
        <circle class="anim" cx="66" cy="12" r="4.5" fill="var(--is-accent)" />
      </g>

      <!-- 品牌标：与 public/icons/icon-brand.svg 同源，色值全走 token -->
      <g class="boot-demo__mark">
        <g transform="translate(66 66) scale(0.1375) translate(-512 -395.636364)">
          <circle cx="512" cy="395.636364" r="232.727273" fill="var(--is-accent)" />
          <path
            d="M453.806545 289.764848a7.214545 7.214545 0 0 1 8.168728-6.112969l77.548606 11.155394c1.881212 0.271515 3.580121 1.272242 4.728242 2.788848l70.943031 93.796849a7.214545 7.214545 0 0 1 0.100848 8.564363L544.267636 498.722909a7.214545 7.214545 0 0 1-4.871757 2.936243L461.459394 512.391758a7.214545 7.214545 0 0 1-6.997333-11.132122l67.285333-101.558303a7.214545 7.214545 0 0 0-0.077576-8.079515L455.00897 294.888727a7.214545 7.214545 0 0 1-1.202425-5.12z m-6.729697 37.783273a3.607273 3.607273 0 0 1 5.054061 0.702061l47.736243 63.146666a3.607273 3.607273 0 0 1 0.104727 8.556607L452.189091 466.540606a3.607273 3.607273 0 0 1-6.543515-2.102303V330.426182a3.607273 3.607273 0 0 1 1.435151-2.878061z"
            fill="var(--is-on-accent)"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<script>
/**
 * 启动页插画：品牌轨道标（与 WelcomeDemo 同源几何，仅去掉字标）。
 * 布局参照产品内「正在处理」页的惯例：插画居中、大标题、副文案、整幅进度条、条下状态词。
 * 全部内联 SVG + token 色，不引位图、不引远程资源。
 */
export default { name: 'BootDemo' }
</script>

<style scoped>
.boot-demo {
  display: flex;
  align-items: center;
  justify-content: center;
}

.boot-demo__svg {
  width: 132px;
  height: 132px;
  display: block;
  overflow: visible;
}

.boot-demo__ring,
.boot-demo__orbit,
.boot-demo__mark {
  transform-box: view-box;
  transform-origin: 50% 50%;
}

.boot-demo__ring {
  opacity: 0.55;
  animation: bd-fade 1.2s var(--is-ease-out) both;
}

.boot-demo__orbit { animation: bd-orbit 9s linear infinite; }
.boot-demo__orbit .anim { animation: is-pulse 2.6s var(--is-ease-std) infinite; }
.boot-demo__mark { animation: bd-pop 0.9s var(--is-ease-spring) 0.15s both; }

@keyframes bd-fade {
  from { opacity: 0; }
  to { opacity: 0.55; }
}

@keyframes bd-orbit {
  to { transform: rotate(360deg); }
}

@keyframes bd-pop {
  0% { transform: scale(0.62); opacity: 0; }
  62% { transform: scale(1.06); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .boot-demo__ring,
  .boot-demo__orbit,
  .boot-demo__orbit .anim,
  .boot-demo__mark {
    animation: none;
    opacity: 1;
    transform: none;
  }

  .boot-demo__ring { opacity: 0.55; }
}
</style>