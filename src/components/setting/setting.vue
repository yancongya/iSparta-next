<template>
<section class="mod-setting">
  <h3 class="ui-border-t">{{ $t("outputConfig") }}</h3>
  <section class="mod-empty" v-if="!curtSetting">
    <p>{{ $t("selectAtLeastOne") }}</p>
  </section>
  <section class="mod-multi" v-else-if="curtSetting.length">
    <p>{{ $t("multiText") }}</p>
    <el-button type="primary" v-on:click="start('')" :disabled="isStarted">&ensp;{{ $t("batchStart") }}&ensp;</el-button>
    <el-button type="primary" v-on:click="changeOutput" :disabled="isStarted">{{ $t("outputTofolder") }}</el-button>
  </section>
  <section class="mod-form" v-else>
    <div class="ui-border-b" v-if="showFrame">
      <el-form label-width="">
        <el-form-item :label="$t('fps')">
          <el-input v-model.number="frameRate" type="number" max="100" min="0" size="mini"  placeholder="24"></el-input>
        </el-form-item>
        <el-form-item :label="$t('loop')">
          <el-input v-model.number="loop" type="number" size="mini" placeholder="0"></el-input>{{ $t('times') }}
          <i>({{ $t('loopTips') }})</i>
        </el-form-item>
      </el-form>
    </div>
    <div class="ui-border-b mod-output">
      <el-form label-width="">
        <el-form-item  :label="$t('outputName')" class="suffix">
          <el-input v-model="outputName" size="mini" placeholder="output-ispt"></el-input>
        </el-form-item>
        <p>{{ $t("outputFormat") }}</p>
        <el-checkbox-group v-model="formatList">
          <el-checkbox v-for="format in formatStatic" :label="format" :key="format">{{format}}</el-checkbox>
        </el-checkbox-group>
      </el-form>
    </div>
    <div class="ui-border-b mod-quality">
      <p>{{ $t("compressionQuality") }}</p>
      <el-form :inline="true">
        <el-form-item class="mr-5">
          <el-checkbox v-model="qualityCheck">Quality</el-checkbox>
        </el-form-item>
        <el-form-item>
          <el-input v-model.number="quality" type="number" size="mini" placeholder="100" @blur="qualityBlur"></el-input>
          <i>(0-100)</i>
        </el-form-item>
      </el-form>
    </div>
    <div class="ui-border-b mod-outputto">
      <p>{{ $t("outputTo") }}</p>
      <el-form label-width="">
        <el-form-item>
          <div class="path-modes">
            <button
              type="button"
              class="path-mode"
              :class="{ 'path-mode--on': pathModeUI === 'output' }"
              @click.prevent.stop="setOutputToMode('output')"
            >{{ $t("outputToOutput") }}</button>
            <button
              type="button"
              class="path-mode"
              :class="{ 'path-mode--on': pathModeUI === 'beside' }"
              @click.prevent.stop="setOutputToMode('beside')"
            >{{ $t("outputToBeside") }}</button>
          </div>
        </el-form-item>
        <el-form-item>
          <el-input
            size="mini"
            readonly
            :value="pathPreviewUI"
            :title="pathPreviewUI"
            class="path-input"
          >
            <i
              slot="suffix"
              class="el-input__icon el-icon-folder-opened path-icon"
              title="选择自定义输出目录"
              @click.prevent.stop="pickOutputDir"
            ></i>
          </el-input>
        </el-form-item>
        <el-form-item :label="$t('outputToTemplate')">
          <el-input v-model="outputToTemplate" size="mini" :placeholder="'{srcPath}/output'"></el-input>
        </el-form-item>
      </el-form>
    </div>
    <div class="ui-border-b mod-sizelimit">
      <p>{{ $t("sizeLimit") }}</p>
      <el-form label-width="">
        <el-form-item class="mr-5">
          <el-checkbox v-model="sizeEnabled">{{ $t("sizeLimitEnable") }}</el-checkbox>
        </el-form-item>
        <el-form-item :label="$t('sizeLimitMax')">
          <el-input
            :value="sizeDraft !== null ? sizeDraft : sizeValueText"
            size="mini"
            type="text"
            inputmode="decimal"
            placeholder="1"
            @focus="onSizeFocus"
            @input="onSizeDraftInput"
            @blur="onSizeBlur"
          ></el-input>
          <el-select v-model="sizeUnit" size="mini" class="size-unit">
            <el-option label="MB" value="MB"></el-option>
            <el-option label="KB" value="KB"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item class="mr-5">
          <el-checkbox v-model="sizeAutoQuality">{{ $t("sizeLimitAutoQuality") }}</el-checkbox>
        </el-form-item>
        <el-form-item class="mr-5">
          <el-checkbox v-model="sizeAutoDelete">{{ $t("sizeLimitAutoDelete") }}</el-checkbox>
        </el-form-item>
        <el-form-item :label="$t('sizeLimitStep')" v-if="sizeAutoQuality">
          <el-input v-model.number="sizeStep" type="number" size="mini" min="1" max="100"></el-input>
          <i>(0-100)</i>
        </el-form-item>
        <el-form-item :label="$t('sizeLimitTries')" v-if="sizeAutoQuality">
          <el-input v-model.number="sizeMaxTries" type="number" size="mini" min="1" max="50"></el-input>
          <i>{{ $t('sizeLimitTriesTip') }}</i>
        </el-form-item>
      </el-form>
    </div>
    <el-button type="primary" v-on:click="start('')" :disabled="isStarted || !canStart">&emsp;{{ $t("start") }}&emsp;</el-button>
  </section>
  <section class="mod-toolbox">
    <i class="el-icon-setting" v-on:click="openGlobalSetting()"></i>
    <i class="el-icon-delete" v-on:click="onDeleteAll()"></i>
  </section>
</section>
</template>
<script>
import processor from '../../util/processor'
import { ipc } from '../../util/node-env'
import { resolveOutputPath, normalizeOutputTo } from '../../util/outputPath'
export default {
  data () {
    return {
      sizeDraft: null,
      // 本地 UI 状态，保证点选立即高亮
      pathModeUI: 'output',
      pathPreviewUI: ''
    }
  },
  watch: {
    selectedList: {
      immediate: true,
      handler () {
        this.syncPathUI()
      }
    },
    curtSetting: {
      deep: true,
      handler () {
        this.syncPathUI()
      }
    }
  },
  created () {
    // 回应输出到目录的操作
    ipc.on('change-multiItem-fold', (path) => {
      this.start(path[0])
    })
    this.syncPathUI()
  },
  computed: {
    selectedList () {
      var selectedList = this.$store.getters.getterSelected
      return selectedList
    },
    curtSetting () {
      if (this.selectedList.length == 0) {
        return false
      } else if (this.selectedList.length == 1) {
        // 单选
        var selectedData = this.selectedList[0].options
        // console.log(selectedData);
        return selectedData
      } else {
        // 多选
        return this.selectedList
      }
    },
    isStarted () {
      if (!this.selectedList.length) {
        return false
      }
      var schedule = this.selectedList[0].process.schedule
      if (schedule > 0 && schedule < 1) {
        return true
      } else {
        return false
      }
    },
    // 至少勾选一种输出格式才能开始
    canStart () {
      if (this.selectedList.length !== 1) {
        return true
      }
      var fmt = this.curtSetting && this.curtSetting.outputFormat
      return !!(fmt && fmt.length)
    },
    showFrame () {
      if (!this.selectedList.length) {
        return false
      }
      if (this.selectedList[0].basic.type == 'PNGs') {
        return true
      } else {
        return false
      }
    },
    formatStatic () {
      if (!this.selectedList.length) {
        return ['APNG', 'GIF', 'WEBP']
      }
      if (this.selectedList[0].basic.type == 'GIF') {
        return ['APNG', 'WEBP']
      } else {
        return ['APNG', 'GIF', 'WEBP']
      }
    },
    frameRate: {
      get () {
        // console.warn(this.curtSetting.length)
        return this.curtSetting.frameRate
      },
      set (value) {
        this.$store.dispatch('editMultiOptions', {
          frameRate: value
        })
      }
    },
    loop: {
      get () {
        // console.warn(this.curtSetting.frameRate)
        return this.curtSetting.loop
      },
      set (value) {
        this.$store.dispatch('editMultiOptions', {
          loop: value
        })
      }
    },
    outputName: {
      get () {
        // console.warn(this.curtSetting.frameRate)
        return this.curtSetting.outputName
      },
      set (value) {
        this.$store.dispatch('editOptions', {
          outputName: value
        })
      }
    },
    formatList: {
      get () {
        // console.warn(this.curtSetting.outputFormat)
        return (this.curtSetting && this.curtSetting.outputFormat) || []
      },
      set (value) {
        this.$store.dispatch('editOptions', {
          outputFormat: value
        })
      }
    },
    qualityCheck: {
      get () {
        return this.curtSetting.quality.checked
      },
      set (value) {
        this.$store.dispatch('editMultiOptions', {
          quality: {
            'checked': value,
            'value': this.quality
          }
        })
      }
    },
    quality: {
      get () {
        // console.warn(this.curtSetting.frameRate)
        return this.curtSetting.quality.value
      },
      set (value) {
        if(value > 100 || value < 0){
          return false;
        }
        this.$store.dispatch('editMultiOptions', {
          quality: {
            'checked': this.qualityCheck,
            'value': value
          }
        })
      }
    },
    sizeEnabled: {
      get () {
        return !!(this.curtSetting && this.curtSetting.sizeLimit && this.curtSetting.sizeLimit.enabled)
      },
      set (value) {
        this.pushSizeLimit({ enabled: !!value })
      }
    },
    sizeValueText: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        const bytes = this.sizeLimitBytes(s)
        const unit = (s && s.unit) || 'MB'
        if (unit === 'KB') {
          return String(Math.round((bytes / 1024) * 100) / 100)
        }
        return String(Math.round((bytes / (1024 * 1024)) * 1000) / 1000)
      },
      set () {
        // 由 onSizeValueInput 写入，避免 v-model.number 把 0.8 吃掉
      }
    },
    sizeUnit: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.unit) || 'MB'
      },
      set (value) {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        const bytes = this.sizeLimitBytes(s)
        this.pushSizeLimit({ unit: value, maxBytes: bytes, maxMB: bytes / (1024 * 1024) })
      }
    },
    sizeAutoQuality: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return !s || s.autoQuality !== false
      },
      set (value) {
        this.pushSizeLimit({ autoQuality: !!value })
      }
    },
    sizeAutoDelete: {
      get () {
        return !!(this.curtSetting && this.curtSetting.sizeLimit && this.curtSetting.sizeLimit.autoDelete)
      },
      set (value) {
        this.pushSizeLimit({ autoDelete: !!value })
      }
    },
    sizeStep: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.step) || 5
      },
      set (value) {
        this.pushSizeLimit({ step: Number(value) || 5 })
      }
    },
    sizeMaxTries: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.maxTries) || 10
      },
      set (value) {
        this.pushSizeLimit({ maxTries: Number(value) || 10 })
      }
    },
    outputToMode: {
      get () {
        const o = this.curtSetting && this.curtSetting.outputTo
        return normalizeOutputTo(o).mode
      },
      set (value) {
        this.pushOutputTo({ mode: value })
      }
    },
    outputToTemplate: {
      get () {
        const o = this.curtSetting && this.curtSetting.outputTo
        return (o && o.template) || ''
      },
      set (value) {
        this.pushOutputTo({ template: String(value || '') })
      }
    },
    outputPathPreview () {
      if (this.selectedList.length !== 1) { return '' }
      const item = this.selectedList[0]
      return resolveOutputPath(item, item.options)
    }

  },
  methods: {
    sizeLimitBytes (s) {
      if (s && isFinite(Number(s.maxBytes)) && Number(s.maxBytes) > 0) {
        return Number(s.maxBytes)
      }
      if (s && isFinite(Number(s.maxMB)) && Number(s.maxMB) > 0) {
        return Number(s.maxMB) * 1024 * 1024
      }
      return 1024 * 1024
    },
    onSizeFocus () {
      this.sizeDraft = this.sizeValueText
    },
    onSizeDraftInput (raw) {
      // 允许清空/半成品输入，不立刻回写 store
      this.sizeDraft = String(raw == null ? '' : raw)
    },
    onSizeBlur () {
      const raw = this.sizeDraft
      this.sizeDraft = null
      const n = parseFloat(String(raw == null ? '' : raw).replace(',', '.'))
      if (!isFinite(n) || n <= 0) {
        return
      }
      const unit = this.sizeUnit
      const bytes = unit === 'KB' ? n * 1024 : n * 1024 * 1024
      this.pushSizeLimit({
        maxBytes: bytes,
        maxMB: bytes / (1024 * 1024),
        unit: unit
      })
    },
    pushOutputTo (patch) {
      if (this.selectedList.length !== 1) { return }
      // 确保当前项为唯一选中
      const idx = this.selectedIndex
      if (idx >= 0) {
        this.$store.dispatch('singleSelect', idx)
      }
      const item = this.selectedList[0]
      const base = (item.options && item.options.outputTo) || {
        mode: 'output',
        customPath: '',
        template: ''
      }
      const next = Object.assign({}, base, patch)
      this.$store.dispatch('editOptions', { outputTo: next })
      const merged = Object.assign({}, item.options, { outputTo: next })
      const p = resolveOutputPath(item, merged)
      this.$store.dispatch('editBasic', { outputPath: p })
    },
    syncPathUI () {
      if (this.selectedList.length !== 1) {
        this.pathModeUI = 'output'
        this.pathPreviewUI = ''
        return
      }
      const o = normalizeOutputTo(this.curtSetting && this.curtSetting.outputTo)
      this.pathModeUI = o.mode
      this.pathPreviewUI = resolveOutputPath(this.selectedList[0], this.selectedList[0].options)
    },
    setOutputToMode (mode) {
      this.pathModeUI = mode
      this.pushOutputTo({ mode: mode })
      this.syncPathUI()
    },
    pickOutputDir () {
      if (this.selectedList.length !== 1) { return }
      const cur = (this.curtSetting && this.curtSetting.outputTo && this.curtSetting.outputTo.customPath) || ''
      ipc.invoke('dialog:openDirectory', {
        defaultPath: cur
      }).then((r) => {
        if (!r || r.canceled || !r.filePaths || !r.filePaths[0]) { return }
        this.pathModeUI = 'custom'
        this.pushOutputTo({ mode: 'custom', customPath: r.filePaths[0] })
        this.pathPreviewUI = r.filePaths[0]
        this.syncPathUI()
      }).catch(() => {})
    },
    pushSizeLimit (patch) {
      const base = (this.curtSetting && this.curtSetting.sizeLimit) || {
        enabled: false,
        maxMB: 1,
        maxBytes: 1048576,
        unit: 'MB',
        autoDelete: false,
        autoQuality: true,
        step: 5,
        maxTries: 10
      }
      this.$store.dispatch('editOptions', {
        sizeLimit: Object.assign({}, base, patch)
      })
    },
    floydBlur:function(self){
      self.srcElement.value = this.floyd;
    },
    qualityBlur:function(self){
      self.srcElement.value = this.quality;
    },
    changeOutput: function () {
      var outputPath = this.selectedList[0].basic.outputPath
      // console.log(outputPath)
      ipc.send('change-multiItem-fold', outputPath)
    },
    start: function (sameOutputPath) {
      // console.log(sameOutputPath)
      let locale = this.$i18n.messages[this.$i18n.locale]
      for (var i = 0; i < this.selectedList.length; i++) {
        this.$store.dispatch('editProcess', {
          index: i,
          text: '',
          schedule: 0
        })
      }
      setTimeout(() => {
        this.$store.dispatch('setLock', true)
        processor(this.$store, sameOutputPath, locale).catch((err) => {
          console.warn('convert error:', err)
          this.$store.dispatch('setLock', false)
        })
      }, 20)
    },
    onDeleteAll:function(){
      this.$store.dispatch('remove')
    },
    openGlobalSetting:function(){
      this.$root.eventBus.$emit('openGlobalSetting')
    }
  },
  watch: {

  }
}
</script>

<style lang="scss">
@import "./setting.scss";
</style>
