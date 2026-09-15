<template>
  <is-dialog
    :visible="true"
    :title="$t('compareTitle')"
    width="720px"
    @close="$emit('close')"
  >
    <div class="cmp-body">
      <is-compare-slider
        v-if="beforeSrc && afterSrc"
        :before="beforeSrc"
        :after="afterSrc"
        :label-before="$t('compareBefore')"
        :label-after="$t('compareAfter')"
        :aria-label="$t('compareTitle')"
      />
      <div v-else class="cmp-empty">
        <is-icon name="image" size="xl" />
        <p>{{ $t('compareNoFile') }}</p>
      </div>
      <p class="cmp-hint">{{ $t('compareHint') }}</p>
    </div>
  </is-dialog>
</template>

<!--
  对比弹窗：原始帧 vs 转换后的输出文件。
  打开条件由父组件控制（仅 done 状态的条目有意义）；
  输出文件路径经 outputPath 模板已解析，直接读 dataURL。
-->
<script>
import IsCompareSlider from '../../ui-next/components/IsCompareSlider.vue'

export default {
  name: 'CompareDialog',
  components: { IsCompareSlider },
  props: {
    project: { type: Object, default: null }
  },
  data () {
    return {
      beforeSrc: '',
      afterSrc: ''
    }
  },
  computed: {
    outPath () {
      var p = this.project && this.project.basic
      return (p && p.outputPath) || ''
    },
    firstInput () {
      var p = this.project && this.project.basic
      return (p && p.fileList && p.fileList[0]) || ''
    }
  },
  mounted () {
    this.beforeSrc = this.readUrl(this.firstInput)
    this.afterSrc = this.readUrl(this.outPath)
  },
  methods: {
    readUrl (p) {
      if (!p) { return '' }
      try {
        var api = window.ispartaAPI && window.ispartaAPI.fs
        if (api && api.readDataUrl) {
          var r = api.readDataUrl(p)
          if (r && r.ok && r.dataUrl) { return r.dataUrl }
        }
      } catch (e) { /* fallthrough */ }
      return ''
    }
  }
}
</script>

<style lang="scss">
.cmp-body {
  display: flex;
  flex-direction: column;
  gap: var(--is-s-3);
}

.cmp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--is-s-2);
  padding: var(--is-s-10) 0;
  color: var(--is-text-3);
}

.cmp-hint {
  margin: 0;
  color: var(--is-text-3);
  font-size: var(--is-fs-xs);
  text-align: center;
}
</style>
