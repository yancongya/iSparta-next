<template>
  <section class="globalsetting">
    <is-dialog
      :visible.sync="dialogFormVisible"
      :title="$t('defaultSetting')"
      width="560px"
      :close-on-click-modal="false"
      @open="resetVarible"
    >
      <is-form v-if="setting">
        <is-form-item :label="$t('language')">
          <is-segmented v-model="setting.language" :options="languages" size="sm" />
        </is-form-item>

        <is-form-item :label="$t('appearance')">
          <is-segmented v-model="themeMode" :options="themeOptions" size="sm" @change="applyThemeMode" />
        </is-form-item>

        <div class="gs-split"></div>

        <is-form-item :label="$t('fps')">
          <is-input v-model="setting.options.frameRate" type="number" class="w-80" :max="100" :min="0" number />
          <em class="hint">0-100</em>
        </is-form-item>
        <is-form-item :label="$t('loop')">
          <is-input v-model="setting.options.loop" type="number" class="w-80" number />
          <span class="unit">{{ $t('times') }}</span>
          <em class="hint">{{ $t('loopTips') }}</em>
        </is-form-item>
        <is-form-item :label="$t('filenameSuffix')">
          <is-input v-model="setting.options.outputSuffix" class="is-input--fluid" :maxlength="10" />
        </is-form-item>
        <is-form-item label="Floyd">
          <is-input v-model="setting.options.floyd.value" type="number" class="w-80" :max="1" :min="0" step="0.05" number />
          <em class="hint">0-1</em>
        </is-form-item>
        <is-form-item label="Quality">
          <is-input v-model="setting.options.quality.value" type="number" class="w-80" :max="100" :min="0" number />
          <em class="hint">0-100</em>
        </is-form-item>

        <div class="gs-split"></div>

        <is-form-item :label="$t('outputTo')">
          <div class="gs-path">
            <!-- 与输出设置同一套：预设只填模板，变量路径可编辑，胶囊点击插入 -->
            <is-preset-bar
              :presets="presetItems"
              :active-id="gsPreset"
              :ctx="demoCtx"
              :current-template="setting.options.outputTo.template"
              @apply="onGsPresetApply"
              @save="onGsPresetSave"
              @reset="onGsPresetReset"
              @remove="onGsPresetRemove"
            />
            <path-vars
              v-model="setting.options.outputTo.template"
              :ctx="demoCtx"
              class="gs-path__vars"
            >
              <button
                slot="append"
                type="button"
                class="pv__bookmark"
                :class="{ 'is-on': bookmarkOpen }"
                v-tip="$t('presetSaveTip')"
                :aria-label="$t('presetSaveTip')"
                @click.stop="bookmarkOpen = !bookmarkOpen"
              ><is-icon name="bookmark" size="sm" /></button>
            </path-vars>
            <div v-if="bookmarkOpen" class="bookmark-row bookmark-row--gs">
              <is-input
                v-model="bookmarkLabel"
                class="bookmark-row__in"
                size="sm"
                :placeholder="$t('presetNamePh')"
                :maxlength="16"
                @keyup.enter.native="confirmGsBookmark"
                @keyup.esc.native="bookmarkOpen = false"
              />
              <button type="button" class="bookmark-row__ok" :aria-label="$t('confirm')" @click.stop="confirmGsBookmark">
                <is-icon name="check" size="xs" />
              </button>
              <button type="button" :aria-label="$t('cancel')" @click.stop="bookmarkOpen = false">
                <is-icon name="close" size="xs" />
              </button>
            </div>
          </div>
          <p class="gs-hint">{{ $t('outputToCustomHint') }}</p>
        </is-form-item>

        <div class="gs-split"></div>

        <is-form-item :label="$t('sizeLimit')">
          <is-switch v-model="setting.options.sizeLimit.enabled" />
        </is-form-item>
        <is-form-item :label="$t('sizeLimitMax')">
          <is-input
            class="w-80"
            :value="sizeDraft !== null ? sizeDraft : sizeValueText"
            inputmode="decimal"
            placeholder="1"
            @focus="onSizeFocus"
            @input="onSizeDraftInput"
            @blur="onSizeBlur"
          />
          <is-segmented v-model="sizeUnit" :options="['MB', 'KB']" size="sm" />
        </is-form-item>
        <is-form-item :label="$t('sizeLimitAutoQuality')">
          <is-switch v-model="setting.options.sizeLimit.autoQuality" />
        </is-form-item>
        <is-form-item :label="$t('sizeLimitAutoDelete')">
          <is-switch v-model="setting.options.sizeLimit.autoDelete" />
        </is-form-item>
        <is-form-item v-if="setting.options.sizeLimit.autoQuality" :label="$t('sizeLimitStep')">
          <is-input v-model="setting.options.sizeLimit.step" type="number" class="w-80" :max="100" :min="1" number />
        </is-form-item>
        <is-form-item v-if="setting.options.sizeLimit.autoQuality" :label="$t('sizeLimitTries')">
          <is-input v-model="setting.options.sizeLimit.maxTries" type="number" class="w-80" :max="50" :min="1" number />
          <em class="hint">{{ $t('sizeLimitTriesTip') }}</em>
        </is-form-item>
      </is-form>

      <template #footer>
        <is-button @click="dialogFormVisible = false">{{ $t('cancel') }}</is-button>
        <is-button type="primary" @click="changeVarible">{{ $t('confrim') }}</is-button>
      </template>
    </is-dialog>
  </section>
</template>

<script>
import { storage } from '../../util/node-env'
import ThemeManager from '../../ui-next/theme'
import PathVars from '../../ui-next/components/PathVars.vue'
import IsPresetBar from '../../ui-next/components/IsPresetBar.vue'
import {
  loadPresets,
  savePresets,
  presetList,
  activePresetIdOf,
  setBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
} from '../../util/outputPresets'

const DEFAULT_SIZE_LIMIT = {
  enabled: false,
  maxMB: 1,
  maxBytes: 1048576,
  unit: 'MB',
  autoDelete: false,
  autoQuality: true,
  step: 5,
  maxTries: 10
}

const DEFAULT_OUTPUT_TO = {
  mode: 'output',
  customPath: '',
  template: ''
}

export default {
  components: { PathVars, IsPresetBar },
  data () {
    return {
      setting: this.loadSetting(),
      dialogFormVisible: false,
      sizeDraft: null,
      themeMode: ThemeManager.getMode(),
      // 输出路径预设：与输出设置面板共享同一份 storage 键
      outputPresets: loadPresets(),
      bookmarkOpen: false,
      bookmarkLabel: ''
    }
  },
  computed: {
    languages () {
      return [
        { label: '简体', value: 'zh-cn' },
        { label: '繁體', value: 'zh-tw' },
        { label: 'EN', value: 'en-us' }
      ]
    },
    themeOptions () {
      return [
        { label: this.$t('themeLight'), value: 'light', icon: 'sun' },
        { label: this.$t('themeDark'), value: 'dark', icon: 'moon' },
        { label: this.$t('themeSystem'), value: 'system', icon: 'globe' }
      ]
    },
    // 预设条渲染数据：内置（含被改过的模板）+ 用户自定义
    presetItems () {
      return presetList(this.outputPresets)
    },
    // 与输出设置一致：高亮由模板反查得出（含用户预设）
    gsPreset () {
      const o = this.setting && this.setting.options && this.setting.options.outputTo
      return activePresetIdOf({ outputTo: o }, this.outputPresets)
    },
    // 默认设置没有具体项目，用说明性占位值让胶囊仍能表达每个变量的含义
    demoCtx () {
      const o = this.setting && this.setting.options
      const d = new Date()
      const date = d.getFullYear() +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getDate()).padStart(2, '0')
      return {
        srcPath: this.$t('demoSrcPath'),
        src: this.$t('demoSrc'),
        name: (o && o.outputName) || this.$t('demoName'),
        type: 'APNG',
        parent: this.$t('demoParent'),
        date: date
      }
    },
    sizeValueText () {
      const s = this.setting && this.setting.options && this.setting.options.sizeLimit
      const bytes = this.sizeLimitBytes(s)
      const unit = (s && s.unit) || 'MB'
      if (unit === 'KB') {
        return String(Math.round((bytes / 1024) * 100) / 100)
      }
      return String(Math.round((bytes / (1024 * 1024)) * 1000) / 1000)
    },
    sizeUnit: {
      get () {
        const s = this.setting && this.setting.options && this.setting.options.sizeLimit
        return (s && s.unit) || 'MB'
      },
      set (value) {
        if (!this.setting.options.sizeLimit) { return }
        const bytes = this.sizeLimitBytes(this.setting.options.sizeLimit)
        this.$set(this.setting.options.sizeLimit, 'unit', value)
        this.$set(this.setting.options.sizeLimit, 'maxBytes', bytes)
        this.$set(this.setting.options.sizeLimit, 'maxMB', bytes / (1024 * 1024))
      }
    }
  },
  mounted () {
    this.$root.eventBus.$on('openGlobalSetting', this.showDialog)
    this._unsubTheme = ThemeManager.onChange((d) => { this.themeMode = ThemeManager.getMode() })
  },
  beforeDestroy () {
    this.$root.eventBus.$off('openGlobalSetting', this.showDialog)
    if (this._unsubTheme) this._unsubTheme()
  },
  methods: {
    // ---------- 输出路径预设（与输出设置面板共享同一份存储） ----------
    applyGsTemplate (tpl, mode) {
      if (!this.setting || !this.setting.options) { return }
      const o = this.setting.options.outputTo
      this.$set(o, 'template', tpl)
      if (mode) { this.$set(o, 'mode', mode) }
    },
    onGsPresetApply (p) {
      this.applyGsTemplate(p.template, p.builtin ? p.id : 'custom')
    },
    onGsPresetSave (entry) {
      if (entry.builtin) {
        this.outputPresets = setBuiltinTemplate(this.outputPresets, entry.id, entry.template)
      } else {
        this.outputPresets = upsertCustomPreset(this.outputPresets, entry)
      }
      savePresets(this.outputPresets)
      if (entry.id === '' || this.gsPreset === entry.id) {
        this.applyGsTemplate(entry.template)
      }
    },
    onGsPresetReset (p) {
      this.outputPresets = resetBuiltinTemplate(this.outputPresets, p.id)
      savePresets(this.outputPresets)
    },
    onGsPresetRemove (p) {
      this.outputPresets = removeCustomPreset(this.outputPresets, p.id)
      savePresets(this.outputPresets)
    },
    // 书签：把当前默认模板收藏成预设
    confirmGsBookmark () {
      const cur = this.setting && this.setting.options && this.setting.options.outputTo
      const tpl = String((cur && cur.template) || '').trim()
      if (!tpl) {
        this.bookmarkOpen = false
        return
      }
      this.outputPresets = upsertCustomPreset(this.outputPresets, {
        label: this.bookmarkLabel || this.$t('presetUnnamed'),
        template: tpl
      })
      savePresets(this.outputPresets)
      this.bookmarkOpen = false
      this.bookmarkLabel = ''
    },
    // 读取并补齐历史配置缺字段
    loadSetting () {
      let setting = null
      try {
        setting = JSON.parse(storage.getItem('globalSetting'))
      } catch (e) {
        setting = null
      }
      if (setting && setting.options) {
        if (!setting.options.sizeLimit) {
          setting.options.sizeLimit = Object.assign({}, DEFAULT_SIZE_LIMIT)
        }
        if (!setting.options.outputTo) {
          setting.options.outputTo = Object.assign({}, DEFAULT_OUTPUT_TO)
        }
      }
      return setting
    },
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
      this.sizeDraft = String(raw == null ? '' : raw)
    },
    onSizeBlur () {
      const raw = this.sizeDraft
      this.sizeDraft = null
      const n = parseFloat(String(raw == null ? '' : raw).replace(',', '.'))
      if (!isFinite(n) || n <= 0) { return }
      if (!this.setting.options.sizeLimit) {
        this.$set(this.setting.options, 'sizeLimit', Object.assign({}, DEFAULT_SIZE_LIMIT))
      }
      const unit = this.setting.options.sizeLimit.unit || 'MB'
      const bytes = unit === 'KB' ? n * 1024 : n * 1024 * 1024
      this.$set(this.setting.options.sizeLimit, 'maxBytes', bytes)
      this.$set(this.setting.options.sizeLimit, 'maxMB', bytes / (1024 * 1024))
    },
    applyThemeMode (mode) {
      if (mode === 'system') ThemeManager.followSystem()
      else ThemeManager.set(mode)
    },
    showDialog () {
      if (this.$store.getters.getterLocked) {
        return false
      }
      this.dialogFormVisible = true
    },
    resetVarible () {
      this.setting = this.loadSetting()
      this.sizeDraft = null
      this.themeMode = ThemeManager.getMode()
      // 打开弹窗时记录基线，保存时据此判断帧率/循环是否被改动
      this._lastSaved = this.setting && this.setting.options
        ? JSON.parse(JSON.stringify(this.setting.options))
        : null
    },
    changeVarible () {
      const prev = this._lastSaved || null
      storage.setItem('globalSetting', JSON.stringify(this.setting))
      this._lastSaved = JSON.parse(JSON.stringify(this.setting.options))
      this.dialogFormVisible = false

      if (this.themeMode !== ThemeManager.getMode()) {
        this.applyThemeMode(this.themeMode)
      }

      if (this.$i18n.locale !== this.setting.language) {
        this.$i18n.locale = this.setting.language
      }

      // 帧率/循环是全局默认：变更后同步到所有项目，保持输出设置、列表摘要、
      // 延时预览三处一致。约定：单项目的帧率以全局默认为准，单独微调请用延时配置。
      const next = this.setting.options || {}
      if (prev && (prev.frameRate !== next.frameRate || prev.loop !== next.loop)) {
        this.$store.dispatch('editMultiOptions', {
          frameRate: next.frameRate,
          loop: next.loop
        })
      }
    }
  }
}
</script>

<style lang="scss">
@import "./globalSetting.scss";
</style>
