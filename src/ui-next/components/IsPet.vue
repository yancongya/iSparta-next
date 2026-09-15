<template>
  <div
    class="is-pet"
    :class="'is-pet--' + mood"
    :style="{ '--pet-speed': speed + 's' }"
    aria-hidden="true"
  >
    <!-- 胶片小精灵：顶部齿孔呼应 APNG/GIF 工具属性 -->
    <span class="is-pet__perf"><i /><i /><i /><i /></span>
    <span class="is-pet__body">
      <span class="is-pet__eye is-pet__eye--l"><i /></span>
      <span class="is-pet__eye is-pet__eye--r"><i /></span>
      <span class="is-pet__mouth" />
    </span>
    <span class="is-pet__feet"><i /><i /></span>
  </div>
</template>

<!--
  像素小精灵彩蛋（灵感：参考项目的仓鼠轮「数据联动拟物」）：
  - idle    空态待机：缓慢漂浮 + 周期性眨眼
  - excited 拖拽悬停：蹦跳 + 瞪眼 + 张嘴欢呼
  - working 转换进行中：原地奔跑，speed 由并行任务数驱动（越多越快）
  纯 CSS 动画，全部走 transform/opacity；prefers-reduced-motion 由全局规则降级。
-->
<script>
export default {
  name: 'IsPet',
  props: {
    mood: { type: String, default: 'idle' }, // idle | excited | working
    // 单次循环秒数（working 态用：runningCount 越大越小）
    speed: { type: Number, default: 1.6 }
  }
}
</script>

<style lang="scss">
.is-pet {
  // 尺寸变量：调用方（如底栏小尺寸场景）只需覆盖这几个值
  --pet-w: 44px;
  --pet-body-w: 34px;
  --pet-body-h: 28px;
  --pet-eye: 9px;
  --pet-pupil: 4px;
  --pet-r: 9px;

  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  width: var(--pet-w);
  height: var(--pet-w);
  pointer-events: none;

  &__perf {
    display: flex;
    gap: 5px;
    margin-bottom: 1px;

    i {
      width: 5px;
      height: 3px;
      border-radius: 1px;
      background: var(--is-text-3);
    }
  }

  &__body {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: var(--pet-body-w);
    height: var(--pet-body-h);
    border: 1.5px solid var(--is-accent);
    border-radius: var(--pet-r);
    background: var(--is-accent-soft);
    box-shadow: 0 2px 10px rgba(var(--is-accent-rgb), 0.18);
    animation: is-pet-float 2.6s var(--is-ease-std) infinite alternate;
  }

  &__eye {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--pet-eye);
    height: var(--pet-eye);
    border-radius: 50%;
    background: var(--is-card-hi);
    overflow: hidden;

    i {
      width: var(--pet-pupil);
      height: var(--pet-pupil);
      border-radius: 50%;
      background: var(--is-accent);
      animation: is-pet-blink 4.2s var(--is-ease-std) infinite;
    }
  }

  &__mouth {
    position: absolute;
    bottom: 4px;
    left: 50%;
    width: 8px;
    height: 3px;
    margin-left: -4px;
    border-radius: var(--is-r-pill);
    background: var(--is-accent);
    opacity: 0.7;
  }

  &__feet {
    display: flex;
    gap: 10px;
    margin-top: 2px;

    i {
      width: 7px;
      height: 4px;
      border-radius: 2px;
      background: var(--is-accent-dim);
    }
  }

  // ---------- 拖拽悬停：兴奋模式 ----------
  &--excited {
    .is-pet__body {
      animation: is-pet-jump 0.42s var(--is-ease-overshoot) infinite alternate;
      background: var(--is-accent-dim);
    }

    .is-pet__eye {
      width: 11px;
      height: 11px;

      i {
        width: 5px;
        height: 5px;
        animation: none;
      }
    }

    .is-pet__mouth {
      width: 10px;
      height: 7px;
      margin-left: -5px;
      bottom: 2px;
      border-radius: 0 0 var(--is-r-pill) var(--is-r-pill);
      opacity: 1;
    }
  }

  // ---------- 转换中：奔跑模式（--pet-speed 由并行数驱动） ----------
  &--working {
    .is-pet__body {
      animation: is-pet-run var(--pet-speed) var(--is-ease-std) infinite;
    }

    .is-pet__feet i {
      background: var(--is-accent);
      animation: is-pet-step var(--pet-speed) linear infinite;

      &:last-child {
        animation-delay: calc(var(--pet-speed) / 2);
      }
    }

    .is-pet__eye i {
      animation: none;
    }
  }
}

@keyframes is-pet-float {
  from { transform: translateY(-1.5px); }
  to { transform: translateY(1.5px); }
}

@keyframes is-pet-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}

@keyframes is-pet-jump {
  from { transform: translateY(0) scale(1); }
  to { transform: translateY(-7px) scale(1.06); }
}

@keyframes is-pet-run {
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  25% { transform: translateY(-3px) rotate(0deg); }
  50% { transform: translateY(0) rotate(2deg); }
  75% { transform: translateY(-3px) rotate(0deg); }
}

@keyframes is-pet-step {
  0%, 49% { transform: translateY(0); }
  50%, 100% { transform: translateY(-3px); }
}
</style>
