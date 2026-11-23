<template>
  <is-dialog
    :visible="true"
    :title="$t('compareTitle')"
    width="720px"
    panel-class="cmp-panel"
    @close="$emit('close')"
  >
    <!-- body：只有画布，不嵌任何控制层；控制元素统一在 footer 外壳 -->
    <is-compare-slider
      v-if="beforeSrc && afterSrc"
      ref="slider"
      :before="beforeSrc"
      :after="afterSrc"
      :label-before="$t('compareBefore')"
      :label-after="$t('compareAfter')"
      :aria-label="$t('compareTitle')"
      @view-state="onViewState"
    />
    <div v-else class="cmp-empty">
      <is-icon name="image" size="xl" />
      <p>{{ $t('compareNoFile') }}</p>
    </div>

    <!-- footer 外壳：视图工具 + 操作按钮 + 提示，全部脱离画布层 -->
    <template slot="footer">
      <div class="cmp-tools">
        <button
          type="button"
          :title="$t('cmpZoomOut')"
          :aria-label="$t('cmpZoomOut')"
          @click="tool('zoomOut')"
        ><is-icon name="minus" size="sm" /></button>
        <span class="cmp-zoom">{{ view.zoomPercent }}</span>
        <button
          type="button"
          :title="$t('cmpZoomIn')"
          :aria-label="$t('cmpZoomIn')"
          @click="tool('zoomIn')"
        ><is-icon name="plus" size="sm" /></button>
        <button
          type="button"
          :title="$t('cmpResetView')"
          :aria-label="$t('cmpResetView')"
          @click="tool('resetView')"
        ><is-icon name="refresh" size="sm" /></button>
        <span class="cmp-tool-sep"></span>
        <button
          type="button"
          :title="$t('cmpBg')"
          :aria-label="$t('cmpBg')"
          @click="tool('cycleBg')"
        ><is-icon :name="view.bgIcon" size="sm" /></button>
      </div>
      <p class="cmp-hint">{{ $t('compareHint') }}</p>
      <button
        v-if="beforeSrc && afterSrc"
        type="button"
        class="cmp-replay"
        @click="replay"
      ><is-icon name="refresh" size="sm" />{{ $t('compareReplay') }}</button>
    </template>
  </is-dialog>
</template>

<!--
  对比弹窗：原始帧 vs 转换后的输出文件。
  打开条件由父组件控制（仅 done 状态的条目有意义）；
  输出文件路径经 outputPath 模板已解析，直接读 dataURL。
-->
<script>
import IsCompareSlider from '../../ui-next/components/IsCompareSlider.vue'
import { outputFilesOf } from '../../util/task-output'

export default {
  name: 'CompareDialog',
  components: { IsCompareSlider },
  props: {
    project: { type: Object, default: null }
  },
  data () {
    return {
      beforeSrc: '',
      afterSrc: '',
      // footer 工具条状态由画布通过 view-state 事件回抛，外壳只负责渲染
      view: { zoomPercent: '100%', bgIcon: 'image' }
    }
  },
  computed: {
    // 输出侧必须走统一产物口径 outputFilesOf（已含冲突后缀解析）：
    // basic.outputPath 只是**目录**，readDataUrl(目录) 会读失败 → 对比永远空。
    // 多格式时取第一个真实存在的产物；都缺失则保持空态提示。
    outFile () {
      var files = outputFilesOf(this.project)
      if (!files.length) return ''
      try {
        var api = window.ispartaAPI && window.ispartaAPI.fs
        if (api && api.existsSync) {
          for (var i = 0; i < files.length; i++) {
            if (api.existsSync(files[i])) return files[i]
          }
          return ''
        }
      } catch (e) { /* fallthrough */ }
      return files[0]
    },
    firstInput () {
      var p = this.project && this.project.basic
      return (p && p.fileList && p.fileList[0]) || ''
    }
  },
  mounted () {
    this.beforeSrc = this.readUrl(this.firstInput)
    this.afterSrc = this.readUrl(this.outFile)
    // 两图是各自循环播放的动图，打开时同时对两图清 src 再同一 tick 赋值，
    // 让动画从第一帧一起起播；之后若有漂移用户可点「重新同步」。
    var vm = this
    this.$nextTick(function () {
      vm.replay()
    })
  },
  methods: {
    onViewState (state) {
      this.view = state
    },
    // footer 工具按钮：外壳只发号施令，实际画布变换仍走 slider 的公开方法
    tool (name) {
      var s = this.$refs.slider
      if (s && typeof s[name] === 'function') s[name]()
    },
    replay () {
      var s = this.$refs.slider
      if (s && s.replay) s.replay()
    },
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
.cmp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--is-s-2);
  padding: var(--is-s-10) 0;
  color: var(--is-text-3);
}

// footer 外壳：工具条 / 提示 / 重新同步同一行铺开，脱离画布层
.cmp-panel {
  // 对比弹窗以画布为主：全局 header 上下各 16px（61px 高）对单行标题偏高，
  // 仅在本面板收紧垂直 padding（关闭按钮 28px 撑高，约降到 44px），不动全局。
  .is-dialog__header {
    padding-top: var(--is-s-2);
    padding-bottom: var(--is-s-2);
  }

  .is-dialog__footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--is-s-2) var(--is-s-3);
  }
}

.cmp-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: none;
  padding: 3px;
  border: 1px solid var(--is-border);
  border-radius: var(--is-r-pill);
  background: var(--is-card);

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    padding: 0;
    border: 0;
    border-radius: var(--is-r-pill);
    background: transparent;
    color: var(--is-text-2);
    cursor: pointer;
    transition: background var(--is-dur-fast) var(--is-ease-std), color var(--is-dur-fast) var(--is-ease-std);

    &:hover { background: var(--is-hover); color: var(--is-accent); }
    &:focus-visible { outline: 2px solid var(--is-accent); outline-offset: -2px; }
  }
}

.cmp-zoom {
  min-width: 42px;
  color: var(--is-text-2);
  font-family: var(--is-mono);
  font-size: var(--is-fs-xs);
  text-align: center;
}

.cmp-tool-sep {
  width: 1px;
  height: 15px;
  margin: 0 3px;
  background: var(--is-border);
}

.cmp-hint {
  flex: 1 1 auto;
  min-width: 160px;
  margin: 0;
  color: var(--is-text-3);
  font-size: var(--is-fs-xs);
  text-align: center;
}

.cmp-replay {
  display: inline-flex;
  align-items: center;
  gap: var(--is-s-1);
  flex: none;
  padding: 4px var(--is-s-2);
  border: 1px solid var(--is-border);
  border-radius: var(--is-r-xs);
  background: var(--is-card);
  color: var(--is-text-2);
  font-size: var(--is-fs-xs);
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    border-color: var(--is-accent);
    color: var(--is-accent);
  }
}
</style>
