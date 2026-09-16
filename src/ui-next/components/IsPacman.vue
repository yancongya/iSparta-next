<template>
  <span
    class="is-pac"
    :class="'is-pac--' + size"
    role="img"
    :aria-label="label"
  >
    <svg class="is-pac__svg" viewBox="40 50 460 200" xmlns="http://www.w3.org/2000/svg" :aria-hidden="true">
      <!-- 前进的豆：整体左移一个间距后循环，视觉上像被一路吃掉 -->
      <circle
        v-for="(x, i) in dots"
        :key="'d' + i"
        class="is-pac__dot"
        :cx="x"
        cy="150"
        r="10"
      />
      <!-- 上下颚各覆盖 45°，与「张嘴」主体重叠部分同色不可见，
           靠 ±30° 往复把缺口开合出来 -->
      <path class="is-pac__jaw-b" d="M 150,150 L 220.4,221 A 100 100 0 0 0 250,150 Z"/>
      <path class="is-pac__jaw-t" d="M 150,150 L 220.4,79 A 100 100 0 0 1 250,150 Z"/>
      <path class="is-pac__open" d="M 150,150 L 236.6,100 A 100 100 0 1 0 236.6,200 Z"/>
    </svg>
  </span>
</template>

<!--
  吃豆人 loading：替代原来「虚线圆转圈」的 loader。
  与原稿的差别（原稿直接内联会有问题）：
  - `//` 注释在 CSS 里非法，改成 /* */ 或注释进模板
  - `cy="50%"` 在带 viewBox 的坐标系里按视口高解析，改成显式 150
  - 原稿 cx 最大到 650 已超出 viewBox(50..550)，最右两颗永远看不见；这里收到 3 颗并让 viewBox 覆盖
  - 颜色走 currentColor，跟随主题强调色；尺寸由外层 class 控制
-->
<script>
export default {
  name: 'IsPacman',
  props: {
    size: { type: String, default: 'sm' }, // xs | sm | md
    label: { type: String, default: 'loading' },
    // 豆子数量：窄空间（按钮内）用 2 颗，状态栏用 3 颗
    dotCount: { type: Number, default: 3 }
  },
  computed: {
    dots () {
      // 第一颗从嘴前方 100px 处开始，间距 100 与动画位移量一致，循环不跳帧
      var arr = []
      for (var i = 0; i < this.dotCount; i++) {
        arr.push(250 + i * 100)
      }
      return arr
    }
  }
}
</script>

<style lang="scss">
.is-pac {
  display: inline-flex;
  flex: none;
  align-items: center;
  color: inherit;

  &--xs { width: 20px; }
  &--sm { width: 30px; }
  &--md { width: 44px; }

  &__svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  &__dot,
  &__jaw-t,
  &__jaw-b,
  &__open {
    fill: currentColor;
  }

  &__jaw-t,
  &__jaw-b {
    transform-box: view-box;
    transform-origin: 150px 150px;
    animation-duration: 175ms;
    animation-timing-function: linear;
    animation-direction: alternate;
    animation-iteration-count: infinite;
  }

  &__jaw-t { animation-name: is-pac-jaw-open-t; }
  &__jaw-b { animation-name: is-pac-jaw-open-b; }

  &__dot {
    animation: is-pac-march 600ms linear infinite;
  }
}

@keyframes is-pac-jaw-open-t {
  100% { transform: rotate(-30deg); }
}

@keyframes is-pac-jaw-open-b {
  100% { transform: rotate(30deg); }
}

@keyframes is-pac-march {
  100% { transform: translateX(-100px); }
}

/* 减少动态：定格在「张嘴等待」姿态，去掉行进的豆子——
   仍是一个可辨识的 loading 指示，而不是彻底消失 */
@media (prefers-reduced-motion: reduce) {
  .is-pac__jaw-t,
  .is-pac__jaw-b,
  .is-pac__dot {
    animation: none;
  }

  .is-pac__jaw-t { transform: rotate(-15deg); }
  .is-pac__jaw-b { transform: rotate(15deg); }
}
</style>
