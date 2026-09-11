<template>
<section class="globalsetting">
  <el-dialog :title="$t('defaultSetting')" :visible.sync="dialogFormVisible" v-on:open="resetVarible" :modal="true" :modal-append-to-body="true" :append-to-body="true" width="540px" :close-on-click-modal="false">
    <el-form>
      <el-form-item :label="$t('language')" label-width="formLabelWidth">
        <el-select v-model="setting.language">
          <el-option label="简体中文" value="zh-cn"></el-option>
          <el-option label="繁體中文" value="zh-tw"></el-option>
          <el-option label="English" value="en-us"></el-option>
        </el-select>
      </el-form-item>
      <el-form-item :label="$t('fps')" label-width="formLabelWidth">
        <el-input type="number" v-model="setting.options.frameRate" max="100" min="0" size="mini" auto-complete="off"></el-input>
      </el-form-item>
      <el-form-item :label="$t('loop')" label-width="formLabelWidth">
        <el-input type="number" v-model="setting.options.loop" size="mini" auto-complete="off"></el-input>{{ $t('times') }}
        <i>({{ $t('loopTips')}})</i>
      </el-form-item>
      <el-form-item :label="$t('filenameSuffix')" class="suffix" label-width="formLabelWidth">
        <el-input size="mini" v-model="setting.options.outputSuffix" :maxlength="10" auto-complete="off"></el-input>
      </el-form-item>
      <el-form-item label="Floyd">
        <el-input type="number" v-model="setting.options.floyd.value" max="1" min="0" size="mini" @blur="floydBlur"></el-input>
        <i>(0-1)</i>
      </el-form-item>
      <el-form-item label="Quality">
        <el-input type="number" v-model="setting.options.quality.value" max="100" min="0" size="mini" value="100" @blur="qualityBlur"></el-input>
        <i>(0-100)</i>
      </el-form-item>
      <el-form-item :label="$t('sizeLimit')">
        <el-checkbox v-model="setting.options.sizeLimit.enabled">{{ $t("sizeLimitEnable") }}</el-checkbox>
      </el-form-item>
      <el-form-item :label="$t('sizeLimitMax')">
        <el-input type="number" v-model.number="setting.options.sizeLimit.maxMB" min="0" step="0.1" size="mini"></el-input>
        <i>MB</i>
      </el-form-item>
      <el-form-item :label="$t('sizeLimitAutoQuality')">
        <el-checkbox v-model="setting.options.sizeLimit.autoQuality"></el-checkbox>
      </el-form-item>
      <el-form-item :label="$t('sizeLimitAutoDelete')">
        <el-checkbox v-model="setting.options.sizeLimit.autoDelete"></el-checkbox>
      </el-form-item>
      <el-form-item :label="$t('sizeLimitStep')" v-if="setting.options.sizeLimit.autoQuality">
        <el-input type="number" v-model.number="setting.options.sizeLimit.step" min="1" max="100" size="mini"></el-input>
      </el-form-item>
      <el-form-item :label="$t('sizeLimitTries')" v-if="setting.options.sizeLimit.autoQuality">
        <el-input type="number" v-model.number="setting.options.sizeLimit.maxTries" min="1" max="50" size="mini"></el-input>
        <i>{{ $t('sizeLimitTriesTip') }}</i>
      </el-form-item>
    </el-form>
    <div slot="footer" class="dialog-footer">
      <el-button @click="dialogFormVisible = false">{{ $t('cancel')}}</el-button>
      <el-button type="primary" @click="changeVarible">{{ $t('confrim')}}</el-button>
    </div>
  </el-dialog>
</section>
</template>

<script>
export default {
  data() {
    return {
      setting: JSON.parse(window.storage.getItem('globalSetting')),
      dialogFormVisible: false,
      formLabelWidth: '120px'
    }
  },
  mounted(){
    this.$root.eventBus.$on('openGlobalSetting', () => {
      this.showDialog()
    })
  },
  methods: {
    floydBlur(){

    },
    qualityBlur(){

    },
    showDialog(){
      let locked = this.$store.getters.getterLocked;
      if(locked){
        return false;
      }
      this.dialogFormVisible = true
    },
    resetVarible(){
      this.setting = JSON.parse(window.storage.getItem('globalSetting'))
      if (!this.setting.options.sizeLimit) {
        this.$set(this.setting.options, 'sizeLimit', {
          enabled: false,
          maxMB: 1,
          autoDelete: false,
          autoQuality: true,
          step: 5,
          maxTries: 10
        })
      }
    },
    changeVarible() {
      //save to localStorage
      
      window.storage.setItem('globalSetting', JSON.stringify(this.setting))
      this.$data.dialogFormVisible = false
      //change language
      switch (this.setting.language) {
        case 'zh-cn':
          this.$i18n.locale = 'zh-cn'
          break;
        case 'zh-tw':
          this.$i18n.locale = 'zh-tw'
          break;
        case 'en-us':
          this.$i18n.locale = 'en-us'
          break;
        default:
          break;
      }
    }
  }
}
</script>

<style lang="scss">
@import "./globalSetting.scss";
</style>
