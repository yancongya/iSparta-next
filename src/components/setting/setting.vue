<template>
  <section class="mod-setting">
    <h3 class="mod-setting__title">{{ $t("outputConfig") }}</h3>

    <!-- 未选中任何项目 -->
    <section v-if="!curtSetting" class="mod-empty">
      <is-icon name="pointer" size="xl" />
      <p>{{ $t("selectAtLeastOne") }}</p>
      <div class="is-kbd-group">
        <span class="is-kbd" :class="{ 'is-pressed': pressed === 'Control' }">Ctrl</span>
        <span>+</span>
        <span class="is-kbd" :class="{ 'is-pressed': pressed === 'a' }">A</span>
        <span>{{ $t("shortcutSelectAll") }}</span>
      </div>
    </section>

    <!-- 多选：各自配置，批量输出 -->
    <section v-else-if="isArraySetting" class="mod-multi">
      <p>{{ $t("multiText") }}</p>
      <is-button type="primary" block :disabled="isStarted" icon="play" @click="start('')">
        {{ $t("batchStart") }}
      </is-button>
      <is-button block :disabled="isStarted" icon="folder" @click="changeOutput">
        {{ $t("outputTofolder") }}
      </is-button>
    </section>

    <!-- 单选：完整输出配置 -->
    <section v-else class="mod-form">
      <!-- 帧频 + 循环：同一行；循环说明改为 info 图标 hover，不再占一整行 -->
      <div v-if="showFrame" class="mod-form__group">
        <div class="mod-form__row">
          <span class="row-label">{{ $t('fps') }}</span>
          <is-input v-model="frameRate" type="number" class="num" :max="100" :min="0" number placeholder="25" />
          <span class="row-label row-label--gap">{{ $t('loop') }}</span>
          <is-input v-model="loop" type="number" class="num" number placeholder="0" />
          <span class="unit">{{ $t('times') }}</span>
          <button type="button" class="is-info" v-tip="$t('loopTips')">
            <is-icon name="info" size="sm" />
          </button>
        </div>
      </div>

      <!-- 压缩质量：与帧频/循环同一套排版，数值框同宽 -->
      <div class="mod-form__group">
        <div class="mod-form__row">
          <span class="row-label">{{ $t('compressionQuality') }}</span>
          <is-checkbox v-model="qualityCheck">{{ $t('enable') }}</is-checkbox>
          <is-input
            v-model="quality"
            type="number"
            class="num"
            :disabled="!qualityCheck"
            :max="100"
            :min="0"
            number
            placeholder="100"
          />
          <button type="button" class="is-info" v-tip="'0-100'">
            <is-icon name="info" size="sm" />
          </button>
        </div>
      </div>

      <!-- 输出名字：标题在上、输入框在下；右侧漏斗=只留文字切换，下方是可点选取消的拆词胶囊 -->
      <div class="mod-form__group">
        <p class="mod-form__caption">{{ $t('outputName') }}</p>
        <div class="name-row">
          <is-input v-model="outputName" class="is-input--fluid" placeholder="output" />
          <button
            v-if="nameTokens.length"
            type="button"
            class="name-row__filter"
            :class="{ 'is-on': wordsOnly }"
            v-tip="wordsOnly ? $t('restoreAll') : $t('keepWordsOnly')"
            @click.stop="toggleWordsOnly"
          ><is-icon name="filter" size="sm" /></button>
        </div>
        <div v-if="nameTokens.length" class="name-tokens">
          <button
            v-for="(t, i) in nameTokens"
            :key="'tok-' + i"
            type="button"
            class="tok"
            :class="tokClass(t, i)"
            v-tip="tokTip(t)"
            @click.stop="toggleNameToken(i)"
          >{{ tokText(t) }}</button>
        </div>
      </div>

      <!-- 输出格式：三等分 -->
      <div class="mod-form__group">
        <p class="mod-form__caption">{{ $t('outputFormat') }}</p>
        <is-checkbox-group v-model="formatList" class="fmt-grid">
          <is-checkbox
            v-for="format in formatStatic"
            :key="format"
            :label="format"
          />
        </is-checkbox-group>
      </div>

      <!-- 输出路径：预设只往变量路径填模板，真实路径实时展开 -->
      <div class="mod-form__group">
        <p class="mod-form__caption">{{ $t("outputTo") }}</p>
        <is-preset-bar
          :presets="presetItems"
          :active-id="presetActiveId"
          :ctx="pathContext"
          :current-template="outputToTemplate"
          :disabled="projectCount === 0"
          @apply="onPresetApply"
          @save="onPresetSave"
          @reset="onPresetReset"
          @remove="onPresetRemove"
        />

        <div class="path-rows">
          <!-- 真实路径：与变量路径同样用输入框呈现，选目录的图标挂在这一行右侧 -->
          <div class="path-row">
            <span class="path-row__label">{{ $t('pathReal') }}</span>
            <is-input class="path-row__in" :value="pathPreviewUI" readonly :placeholder="'—'" />
            <button
              type="button"
              class="path-row__pick"
              v-tip="$t('pickOutputDir')"
              @click.stop="pickOutputDir"
            ><is-icon name="folder" size="sm" /></button>
          </div>

          <!-- 变量路径 + 彩色变量胶囊：与默认设置共用同一组件。
               append 插槽挂「存为预设」书签：调好路径一键收藏，无需进编辑器 -->
          <path-vars v-model="outputToTemplate" :ctx="pathContext" @insert="insertVariable">
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

          <!-- 书签命名行：确认后新胶囊从右侧弹入 -->
          <transition name="is-collapse">
            <div v-if="bookmarkOpen" class="bookmark-row">
              <is-input
                ref="bookmarkIn"
                v-model="bookmarkLabel"
                class="bookmark-row__in"
                size="sm"
                :placeholder="$t('presetNamePh')"
                :maxlength="16"
                @keyup.enter.native="confirmBookmark"
                @keyup.esc.native="bookmarkOpen = false"
              />
              <button type="button" class="bookmark-row__ok" :aria-label="$t('confirm')" @click.stop="confirmBookmark">
                <is-icon name="check" size="xs" />
              </button>
              <button type="button" :aria-label="$t('cancel')" @click.stop="bookmarkOpen = false">
                <is-icon name="close" size="xs" />
              </button>
            </div>
          </transition>
        </div>
      </div>

      <!-- 输出大小阈值：开关移到标题右侧 -->
      <div class="mod-form__group">
        <div class="mod-form__capline">
          <p class="mod-form__caption mod-form__caption--flush">{{ $t("sizeLimit") }}</p>
          <is-switch v-model="sizeEnabled" v-tip="$t('sizeLimitEnable')" />
        </div>

        <div v-show="sizeEnabled" class="size-limit">
          <div class="size-limit__row">
            <span class="size-limit__label">{{ $t('sizeLimitMax') }}</span>
            <is-input
              class="num"
              :value="sizeDraft !== null ? sizeDraft : sizeValueText"
              inputmode="decimal"
              placeholder="1"
              @focus="onSizeFocus"
              @input="onSizeDraftInput"
              @blur="onSizeBlur"
            />
            <is-segmented v-model="sizeUnit" :options="['MB', 'KB']" size="sm" />
          </div>
          <!-- 两个复选框并为一行 -->
          <div class="size-limit__row size-limit__row--checks">
            <is-checkbox v-model="sizeAutoQuality" class="size-limit__check">
              {{ $t("sizeLimitAutoQuality") }}
            </is-checkbox>
            <is-checkbox v-model="sizeAutoDelete" class="size-limit__check">
              {{ $t("sizeLimitAutoDelete") }}
            </is-checkbox>
          </div>

          <template v-if="sizeAutoQuality">
            <div class="size-limit__row">
              <span class="size-limit__label">{{ $t('sizeLimitStep') }}</span>
              <is-input v-model="sizeStep" type="number" class="num" :max="100" :min="1" number />
              <button type="button" class="is-info" v-tip="'0-100'">
                <is-icon name="info" size="sm" />
              </button>
            </div>
            <div class="size-limit__row">
              <span class="size-limit__label">{{ $t('sizeLimitTries') }}</span>
              <is-input v-model="sizeMaxTries" type="number" class="num" :max="50" :min="1" number />
              <button type="button" class="is-info" v-tip="$t('sizeLimitTriesTip')">
                <is-icon name="info" size="sm" />
              </button>
            </div>
          </template>
        </div>
      </div>

      <is-button
        type="primary"
        size="lg"
        block
        icon="play"
        :disabled="isStarted || !canStart"
        :loading="isStarted"
        @click="start('')"
      >{{ $t("start") }}</is-button>

      <p v-if="!canStart" class="mod-form__warn">
        <is-icon name="alert" size="sm" /> {{ $t('needOneFormat') }}
      </p>
    </section>

    <section class="mod-toolbox">
      <button type="button" class="mod-toolbox__btn" :title="$t('defaultSetting')" @click="openGlobalSetting">
        <is-icon name="settings" />
      </button>
      <button
        type="button"
        class="mod-toolbox__btn mod-toolbox__btn--danger"
        :title="$t('clearAll')"
        :disabled="isLocked || !projectCount"
        @click="onDeleteAll"
      >
        <is-icon name="trash" />
      </button>
    </section>
  </section>
</template>
<script>
import processor from '../../util/processor'
import { ipc } from '../../util/node-env'
import { resolveOutputPath, normalizeOutputTo, outputContext } from '../../util/outputPath'
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
import { tokenizeName, joinTokens } from '../../util/tokenizeName'
import PathVars from '../../ui-next/components/PathVars.vue'
import IsPresetBar from '../../ui-next/components/IsPresetBar.vue'
import notice from '../../ui-next/notice'

export default {
  components: { PathVars, IsPresetBar },
  data () {
    return {
      sizeDraft: null,
      // 「真实路径」行的展开结果
      pathPreviewUI: '',
      pressed: '',
      // 输出名的拆词胶囊：[{ text, sep, on }]
      nameTokens: [],
      // 输出路径预设（内置覆盖 + 用户自定义），独立 storage 键持久化
      outputPresets: loadPresets(),
      // 「将当前路径存为预设」的内联命名框
      bookmarkOpen: false,
      bookmarkLabel: ''
    }
  },
  computed: {
    selectedList () {
      return this.$store.getters.getterSelected
    },
    projectCount () {
      return this.$store.getters.getterItems.length
    },
    isLocked () {
      return this.$store.getters.getterLocked
    },
    // 多选时 curtSetting 返回数组，用它区分两种形态
    isArraySetting () {
      return Array.isArray(this.curtSetting)
    },
    curtSetting () {
      if (this.selectedList.length === 0) {
        return false
      } else if (this.selectedList.length === 1) {
        return this.selectedList[0].options
      }
      return this.selectedList
    },
    selectedIndex () {
      return this.$store.getters.getterSelectedIndex
    },
    isStarted () {
      if (!this.selectedList.length) {
        return false
      }
      var schedule = this.selectedList[0].process.schedule
      return schedule > 0 && schedule < 1
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
      return this.selectedList[0].basic.type === 'PNGs'
    },
    formatStatic () {
      if (!this.selectedList.length) {
        return ['APNG', 'GIF', 'WEBP']
      }
      if (this.selectedList[0].basic.type === 'GIF') {
        return ['APNG', 'WEBP']
      }
      return ['APNG', 'GIF', 'WEBP']
    },
    // ---------- 输出路径：模板是唯一真相源 ----------
    // 预设条渲染数据：内置（含被改过的模板）+ 用户自定义
    presetItems () {
      return presetList(this.outputPresets)
    },
    // 当前模板命中哪个预设；'' 表示未收藏的自定义路径（无胶囊高亮）
    presetActiveId () {
      return activePresetIdOf(this.curtSetting, this.outputPresets)
    },
    // ---------- 变量标签的当前取值 ----------
    pathContext () {
      if (this.selectedList.length !== 1) { return null }
      return outputContext(this.selectedList[0])
    },
    varChips () {
      const ctx = this.pathContext
      if (!ctx) { return [] }
      return [
        { key: 'srcPath', value: ctx.srcPath },
        { key: 'src', value: ctx.src },
        { key: 'name', value: ctx.name },
        { key: 'type', value: ctx.type },
        { key: 'parent', value: ctx.parent },
        { key: 'date', value: ctx.date }
      ]
    },
    frameRate: {
      get () { return this.curtSetting.frameRate },
      set (value) {
        this.$store.dispatch('editMultiOptions', { frameRate: value })
      }
    },
    loop: {
      get () { return this.curtSetting.loop },
      set (value) {
        this.$store.dispatch('editMultiOptions', { loop: value })
      }
    },
    outputName: {
      get () { return (this.curtSetting && this.curtSetting.outputName) || '' },
      set (value) {
        this.$store.dispatch('editOptions', { outputName: value })
      }
    },
    // 「只留文字」态：文字全选且至少一个分隔符被取消
    wordsOnly () {
      const tokens = this.nameTokens
      if (!tokens.length) { return false }
      let sepOff = 0
      for (let i = 0; i < tokens.length; i++) {
        if (!tokens[i].sep && !tokens[i].on) { return false }
        if (tokens[i].sep && !tokens[i].on) { sepOff++ }
      }
      return sepOff > 0
    },
    formatList: {
      get () {
        return (this.curtSetting && this.curtSetting.outputFormat) || []
      },
      set (value) {
        this.$store.dispatch('editOptions', { outputFormat: value })
      }
    },
    qualityCheck: {
      get () { return this.curtSetting.quality.checked },
      set (value) {
        this.$store.dispatch('editMultiOptions', {
          quality: { checked: value, value: this.quality }
        })
      }
    },
    quality: {
      get () { return this.curtSetting.quality.value },
      set (value) {
        if (value > 100 || value < 0) {
          return false
        }
        this.$store.dispatch('editMultiOptions', {
          quality: { checked: this.qualityCheck, value: value }
        })
      }
    },
    sizeEnabled: {
      get () { return !!(this.curtSetting && this.curtSetting.sizeLimit && this.curtSetting.sizeLimit.enabled) },
      set (value) { this.pushSizeLimit({ enabled: !!value }) }
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
      set (value) { this.pushSizeLimit({ autoQuality: !!value }) }
    },
    sizeAutoDelete: {
      get () { return !!(this.curtSetting && this.curtSetting.sizeLimit && this.curtSetting.sizeLimit.autoDelete) },
      set (value) { this.pushSizeLimit({ autoDelete: !!value }) }
    },
    sizeStep: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.step) || 5
      },
      set (value) { this.pushSizeLimit({ step: Number(value) || 5 }) }
    },
    sizeMaxTries: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return (s && s.maxTries) || 10
      },
      set (value) { this.pushSizeLimit({ maxTries: Number(value) || 10 }) }
    },
    outputToTemplate: {
      get () {
        const o = this.curtSetting && this.curtSetting.outputTo
        return (o && o.template) || ''
      },
      set (value) {
        const template = String(value || '')
        // mode 只是模板的反查结果，保持旧字段自洽即可
        const mode = activePresetOf({ outputTo: { template: template } }) || 'custom'
        this.pushOutputTo({ template: template, mode: mode })
      }
    }
  },
  // 注意：原实现在对象末尾多写了一个空的 watch，
  // 按「后者覆盖前者」的规则把这里的 selectedList / curtSetting 监听整块吃掉了，
  // 导致切换选中项后路径预览停留在上一个项目。
  watch: {
    selectedList () {
      this.syncPathUI()
    },
    // 书签命名行展开即聚焦，少一次点击
    bookmarkOpen (v) {
      if (!v) { return }
      this.$nextTick(() => {
        const el = this.$refs.bookmarkIn
        const input = el && el.$el ? el.$el.querySelector('input') : null
        if (input) { input.focus() }
      })
    },
    curtSetting: {
      deep: true,
      handler () {
        this.syncPathUI()
      }
    },
    // 名字变化时重建胶囊；immediate 保证首次进入也有胶囊
    outputName: {
      immediate: true,
      handler (v) {
        this.syncNameTokens(v)
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
  mounted () {
    this._onKey = (e) => { this.pressed = e.key }
    this._onKeyUp = () => { this.pressed = '' }
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('keyup', this._onKeyUp)
  },
  beforeDestroy () {
    window.removeEventListener('keydown', this._onKey)
    window.removeEventListener('keyup', this._onKeyUp)
  },
  methods: {
    // ---------- 输出名拆词胶囊 ----------
    syncNameTokens (v) {
      // 由点选胶囊自己改出来的名字不重建，否则取消状态会被立刻冲掉
      if (this.nameTokens.length && joinTokens(this.nameTokens) === v) { return }
      this.nameTokens = tokenizeName(v).map(function (t) {
        return { text: t.text, sep: t.sep, on: true }
      })
    },
    toggleNameToken (i) {
      const t = this.nameTokens[i]
      if (!t) return
      this.$set(this.nameTokens, i, { text: t.text, sep: t.sep, on: !t.on })
      this.outputName = joinTokens(this.nameTokens)
    },
    // 漏斗按钮：进入/退出「只留文字」
    toggleWordsOnly () {
      const toWordsOnly = !this.wordsOnly
      this.nameTokens = this.nameTokens.map(function (t) {
        return { text: t.text, sep: t.sep, on: toWordsOnly ? !t.sep : true }
      })
      this.outputName = joinTokens(this.nameTokens)
    },
    // 空格本身看不见，用可见符号代替
    tokText (t) {
      if (!t.sep) { return t.text }
      return t.text === ' ' ? '␣' : t.text
    },
    // 文字 token 按序取六色（与路径变量同一组令牌），符号固定中性色
    tokClass (t, i) {
      const cls = {
        'is-off': !t.on,
        'is-sep': t.sep
      }
      if (!t.sep) {
        cls['tok--c' + ((i % 6) + 1)] = true
      }
      return cls
    },
    tokTip (t) {
      if (!t.sep) { return t.text }
      const names = { ' ': this.$t('sepSpace'), '-': this.$t('sepDash'), '_': this.$t('sepUnderline') }
      return names[t.text] || (this.$t('sepOther') + ' ' + t.text)
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
      const base = normalizeOutputTo(item.options)
      const next = Object.assign({}, base, patch)
      this.$store.dispatch('editOptions', { outputTo: next })
      const merged = Object.assign({}, item.options, { outputTo: next })
      this.$store.dispatch('editBasic', { outputPath: resolveOutputPath(item, merged) })
    },
    syncPathUI () {
      if (this.selectedList.length !== 1) {
        this.pathPreviewUI = ''
        return
      }
      // 「真实路径」行：模板展开结果
      this.pathPreviewUI = resolveOutputPath(this.selectedList[0], this.selectedList[0].options)
    },
    // ---------- 输出路径预设 ----------
    // 点胶囊：把模板写进「变量路径」（唯一真相源）
    onPresetApply (p) {
      this.pushOutputTo({ template: p.template, mode: p.builtin ? p.id : 'custom' })
      this.syncPathUI()
    },
    // 新增或改名/改模板；内置项走 override，用户项走 custom 列表
    onPresetSave (entry) {
      if (entry.builtin) {
        this.outputPresets = setBuiltinTemplate(this.outputPresets, entry.id, entry.template)
      } else {
        this.outputPresets = upsertCustomPreset(this.outputPresets, entry)
      }
      savePresets(this.outputPresets)
      // 改的正是当前选中的预设时，让任务模板跟着更新
      if (this.presetActiveId === entry.id || entry.id === '') {
        this.pushOutputTo({ template: entry.template })
        this.syncPathUI()
      }
    },
    onPresetReset (p) {
      this.outputPresets = resetBuiltinTemplate(this.outputPresets, p.id)
      savePresets(this.outputPresets)
      notice.success(this.$t('presetResetDone'), this.$t('presetResetDoneTip'))
    },
    onPresetRemove (p) {
      this.outputPresets = removeCustomPreset(this.outputPresets, p.id)
      savePresets(this.outputPresets)
    },
    // 书签：把当前「变量路径」一键收藏成预设
    confirmBookmark () {
      const tpl = String(this.outputToTemplate || '').trim()
      if (!tpl) {
        notice.warning(this.$t('presetSaveEmpty'), this.$t('presetSaveEmptyTip'))
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
      notice.success(this.$t('presetSaved'), this.$t('presetSavedTip'))
    },
    pickOutputDir () {
      if (this.selectedList.length !== 1) { return }
      const cur = this.pathPreviewUI || ''
      ipc.invoke('dialog:openDirectory', {
        defaultPath: cur
      }).then((r) => {
        if (!r || r.canceled || !r.filePaths || !r.filePaths[0]) { return }
        // 绝对路径本身就是合法模板（无变量时原样返回），直接写入统一字段
        this.pushOutputTo({ template: r.filePaths[0], mode: 'custom' })
        this.syncPathUI()
      }).catch(() => {})
    },
    // 点击变量标签把 {key} 追加到模板末尾
    insertVariable (key) {
      const token = '{' + key + '}'
      const cur = this.outputToTemplate || ''
      this.outputToTemplate = cur ? cur + token : token
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
    changeOutput () {
      var outputPath = this.selectedList[0].basic.outputPath
      ipc.send('change-multiItem-fold', outputPath)
    },
    start (sameOutputPath) {
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
        processor(this.$store, sameOutputPath, locale)
          .then(() => {
            this.$store.dispatch('setLock', false)
            this.reportResult()
          })
          .catch((err) => {
            console.warn('convert error:', err)
            this.$store.dispatch('setLock', false)
            notice.error(this.$t('noticeConvertAborted'), err && err.message)
          })
      }, 20)
    },
    // 汇总本次结果，替代「只有列表角标一行小字」的反馈
    reportResult () {
      const items = this.$store.getters.getterItems
      let ok = 0
      let fail = 0
      items.forEach(function (it) {
        const s = it.process && it.process.schedule
        if (s === 1) ok++
        else if (s === -1) fail++
      })
      if (fail) {
        notice.warning(this.$t('noticeDone'), this.$t('resultSummary', { ok: ok, fail: fail }))
      } else if (ok) {
        notice.success(this.$t('noticeAllDone'), this.$t('resultSummary', { ok: ok, fail: 0 }))
      }
    },
    onDeleteAll () {
      this.$store.dispatch('remove')
    },
    openGlobalSetting () {
      this.$root.eventBus.$emit('openGlobalSetting')
    }
  }
}
</script>

<style lang="scss">
@import "./setting.scss";
</style>
