<template>
  <section class="ob-pane">
    <h2 class="ob-h2">{{ $t('obPathTitle') }}</h2>
    <p class="ob-sub">{{ $t('obPathSub') }}</p>

    <!-- 与落地页 #naming 右栏同款：变量积木拼路径 + 真实路径即时预览 -->
    <name-path-panel />
  </section>
</template>

<script>
/**
 * 首启 · 输出路径变量化（紧接文件名切分）
 * {name} 取上一页的切分结果，翻回来改分词这里会跟着变。
 */
import NamePathPanel from '../demos/NamePathPanel.vue'

export default {
  name: 'PathVarsStep',
  components: { NamePathPanel }
}
</script>
