<template>
  <section class="ob-pane">
    <h2 class="ob-h2">{{ $t('obNamingTitle') }}</h2>
    <p class="ob-sub">{{ $t('obNamingSub') }}</p>

    <!-- 与落地页 #naming 左栏同款：长文件名自动分词，点一下取消一个 -->
    <name-split-panel />
  </section>
</template>

<script>
/**
 * 首启 · 文件名自动切分（插在输出设置之后）
 * 只读演示：分词与漏斗都可点，但**不落任何命名预设**。
 * 切分结果写入 naming-store，下一页的 {name} 变量会跟着变。
 */
import NameSplitPanel from '../demos/NameSplitPanel.vue'

export default {
  name: 'NamingStep',
  components: { NameSplitPanel }
}
</script>
