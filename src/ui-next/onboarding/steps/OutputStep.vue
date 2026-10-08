<template>
  <section class="ob-pane">
    <h2 class="ob-h2">{{ $t('obOutputTitle') }}</h2>
    <p class="ob-sub">{{ $t('obOutputSub') }}</p>

    <!-- 与落地页 SIZE GATE 同款：滑块即时反映体积，超限自动一档档降质量 -->
    <output-gate />
  </section>
</template>

<script>
/**
 * 首启 · 输出设置
 * 只读演示：可拖滑块、可切格式、可跑自动重压，但**不写任何持久化设置**
 * （避免与设置面板职责重叠）。
 */
import OutputGate from '../demos/OutputGate.vue'

export default {
  name: 'OutputStep',
  components: { OutputGate }
}
</script>
