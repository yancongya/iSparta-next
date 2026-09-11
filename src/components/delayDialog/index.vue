<template>
  <is-dialog
    :visible="true"
    :title="$t('delayTitle')"
    width="640px"
    :close-on-click-modal="false"
    @close="$emit('close')"
  >
    <!-- 预览区 -->
    <div class="frame-preview">
      <div class="frame-preview__stage is-checker">
        <img v-if="previewSrc" :src="previewSrc" alt="" />
        <span v-else class="frame-preview__ph"><is-icon name="image" size="xl" /></span>
      </div>
      <div class="frame-preview__ctrl">
        <is-button size="sm" :icon="playing ? 'stop' : 'play'" @click="togglePreview">
          {{ playing ? $t('stop') : $t('preview') }}
        </is-button>
        <span class="frame-preview__meta">
          {{ $t('frameIndex') }} {{ cursor + 1 }} / {{ total }}
          <em v-if="totalDuration">· {{ totalDuration }}s</em>
        </span>
      </div>
    </div>

    <!-- 帧间隔列表 -->
    <div v-if="delayProject" class="frame-list">
      <div
        v-for="(file, index) in delayProject.basic.fileList"
        :key="'frame-' + index"
        class="frame"
        :class="{ 'is-current': index === cursor }"
        @click="goto(index)"
      >
        <span class="frame__no">{{ index + 1 }}</span>
        <img v-if="thumbMap[file]" :src="thumbMap[file]" loading="lazy" alt="" />
        <is-input-number
          v-model="delays[index]"
          class="frame__in"
          :min="0"
          :step="0.01"
          :precision="3"
          size="sm"
        />
      </div>
    </div>

    <!-- 统一帧频 -->
    <div class="fps-setting">
      <span class="fps-setting__label">{{ $t('fps') }}</span>
      <is-input v-model="rate" type="number" class="fps-setting__in" :min="0" :max="240" number />
      <is-button size="sm" @click="onResetRate">{{ $t('apply') }}</is-button>
    </div>

    <template #footer>
      <is-button @click="$emit('close')">{{ $t('cancel') }}</is-button>
      <is-button type="primary" @click="onDelayConfirm">{{ $t('confrim') }}</is-button>
    </template>
  </is-dialog>
</template>
<script>
export default {
  props: {
    project: {
      type: Object,
      default: null
    }
  },
  data () {
    return {
      delayProject: null,
      delays: [],
      cursor: 0,
      timer: null,
      playing: false,
      rate: 0,
      // 帧路径 → dataURL，避免每次重渲染都同步读盘
      thumbMap: {}
    }
  },
  computed: {
    total () {
      return this.delays.length
    },
    previewSrc () {
      if (!this.delayProject) { return '' }
      var file = this.delayProject.basic.fileList[this.cursor]
      return (file && this.thumbMap[file]) || ''
    },
    totalDuration () {
      var sum = 0
      for (var i = 0; i < this.delays.length; i++) {
        sum += Number(this.delays[i]) || 0
      }
      return Math.round(sum * 1000) / 1000
    }
  },
  mounted () {
    var project = JSON.parse(JSON.stringify(this.project))
    var delays = project.options.delays ? project.options.delays.slice() : []
    for (var i = 0; i < project.basic.fileList.length; i++) {
      if (!delays[i]) {
        delays[i] = Number((1 / project.options.frameRate).toFixed(3))
      }
    }
    this.delayProject = project
    this.delays = delays
    this.rate = project.options.frameRate
    this.cursor = 0
    // 首帧立即可见，其余按需补
    this.ensureThumb(project.basic.fileList[0])
    this.$nextTick(this.prefetch)
  },
  beforeDestroy () {
    this.stopPreview()
  },
  methods: {
    mediaUrl (p) {
      if (!p) { return '' }
      try {
        var api = window.ispartaAPI && window.ispartaAPI.fs
        if (api && api.readDataUrl) {
          var r = api.readDataUrl(p)
          if (r && r.ok && r.dataUrl) { return r.dataUrl }
        }
      } catch (e) { /* ignore */ }
      return ''
    },
    ensureThumb (file) {
      if (!file || this.thumbMap[file] !== undefined) return
      this.$set(this.thumbMap, file, this.mediaUrl(file))
    },
    // 分批预取缩略图，避免一次性同步读几百张原图把主线程堵死
    prefetch () {
      if (!this.delayProject) return
      var files = this.delayProject.basic.fileList
      var self = this
      var i = 0
      this._prefetchTimer = setInterval(function () {
        var end = Math.min(i + 12, files.length)
        for (; i < end; i++) self.ensureThumb(files[i])
        if (i >= files.length) {
          clearInterval(self._prefetchTimer)
          self._prefetchTimer = null
        }
      }, 30)
    },
    goto (index) {
      this.cursor = index
      this.ensureThumb(this.delayProject.basic.fileList[index])
    },
    togglePreview () {
      if (this.playing) this.stopPreview()
      else this.startPreview()
    },
    startPreview () {
      if (!this.delayProject || this.total < 2) return
      this.playing = true
      this.step()
    },
    // 预览循环可中断：关弹窗或再次点击即停
    step () {
      if (!this.playing) return
      var files = this.delayProject.basic.fileList
      var next = (this.cursor + 1) % files.length
      var wait = Math.max(0, (Number(this.delays[this.cursor]) || 0) * 1000)
      this.timer = window.setTimeout(() => {
        if (!this.playing) return
        this.cursor = next
        this.ensureThumb(files[next])
        this.step()
      }, wait)
    },
    stopPreview () {
      this.playing = false
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
    },
    onDelayConfirm () {
      this.stopPreview()
      var project = this.project
      project.options.frameRate = this.rate
      project.options.delays = this.delays.map(function (d) {
        return Number(d) || 0
      })
      this.$emit('close')
    },
    onResetRate () {
      this.delayProject.options.frameRate = this.rate
      var delays = []
      for (var i = 0; i < this.delayProject.basic.fileList.length; i++) {
        delays[i] = Number((1 / this.rate).toFixed(3))
      }
      this.delays = delays
    }
  }
}
</script>

<style lang="scss">
@import "./sass/index.scss";
</style>
