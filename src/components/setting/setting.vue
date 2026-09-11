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
    <div class="ui-border-b mod-sizelimit">
      <p>{{ $t("sizeLimit") }}</p>
      <el-form label-width="">
        <el-form-item class="mr-5">
          <el-checkbox v-model="sizeEnabled">{{ $t("sizeLimitEnable") }}</el-checkbox>
        </el-form-item>
        <el-form-item :label="$t('sizeLimitMax')">
          <el-input v-model.number="sizeMaxMB" type="number" size="mini" min="0" step="0.1"></el-input>
          <i>MB</i>
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
export default {
  data () {
    return {
      // formatStatic: ['APNG', 'GIF', 'WEBP']
    }
  },
  created () {
    // 回应输出到目录的操作
    ipc.on('change-multiItem-fold', (path) => {
      // console.log(this.$store,path[0]);
      this.start(path[0])
      // processor().then(() => {})
    })
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
    sizeMaxMB: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.maxMB != null) ? s.maxMB : 1
      },
      set (value) {
        this.pushSizeLimit({ maxMB: Number(value) || 1 })
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
    }

  },
  methods: {
    pushSizeLimit (patch) {
      const base = (this.curtSetting && this.curtSetting.sizeLimit) || {
        enabled: false,
        maxMB: 1,
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
