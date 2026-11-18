<template>
  <section class="mod-setting">
    <div v-if="!hideTitle" class="mod-setting__title">
      <span>{{ $t("outputConfig") }}</span>
      <button
        type="button"
        class="mod-setting__layout"
        :class="{ 'is-active': allInOne }"
        :title="allInOne ? $t('toTabbed') : $t('toAllInOne')"
        :aria-label="allInOne ? $t('toTabbed') : $t('toAllInOne')"
        @click="$emit('toggle-all-in-one')"
      >
        <is-icon :name="allInOne ? 'grid' : 'list'" size="sm" />
      </button>
    </div>

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

    <!-- 多选横幅：共用同一套输出设置 -->
    <div v-if="isArraySetting" class="mod-multi-banner">
      <is-icon name="layers" size="sm" />
      <span>{{ $t('multiBanner', { n: selectedList.length }) }}</span>
    </div>

    <!-- 顶部固定分类：CEP 窄面板自动切成纯图标（样式见 setting.scss）；
         全部设置模式（早期面板）不显示分类，四组内容纵向排在同一个滚动区 -->
    <nav v-if="curtSetting && !allInOne" class="mod-tabs-bar" :aria-label="$t('outputConfig')">
      <is-segmented
        v-model="activeTab"
        class="mod-tabs"
        size="sm"
        :options="tabOptions"
      />
    </nav>

    <!-- 完整输出配置：单选/多选共用；多选时写入所有选中项 -->
    <section v-if="curtSetting" class="mod-form" :class="{ 'is-all-in-one': allInOne }">
      <!-- 基础分类 -->
      <div v-show="allInOne || activeTab === 'basic'" class="mod-pane">
      <!-- 输出名：单选整段拆词；多选每项同样支持拆词与漏斗 -->
      <div class="mod-form__group">
        <p class="mod-form__caption">
          {{ $t('outputName') }}
          <span v-if="isArraySetting" class="mod-form__cap-extra">{{ $t('multiNameHint') }}</span>
        </p>

        <div v-if="isArraySetting" class="multi-names">
          <div
            v-for="(item, i) in selectedList"
            :key="'mn-' + itemKeyOf(item, i)"
            class="multi-names__row"
          >
            <span class="multi-names__meta is-ellipsis" :title="srcLabelOf(item)">
              {{ srcLabelOf(item) }}
            </span>
            <div class="name-row">
              <is-input
                class="is-input--fluid"
                :value="item.options.outputName"
                placeholder="output"
                @input="onMultiNameInput(i, $event)"
              />
              <button
                v-if="tokensOf(i).length"
                type="button"
                class="name-row__filter"
                :class="{ 'is-on': multiWordsOnly(i) }"
                v-tip="multiWordsOnly(i) ? $t('restoreAll') : $t('keepWordsOnly')"
                @click.stop="toggleMultiWordsOnly(i)"
              ><is-icon name="filter" size="sm" /></button>
            </div>
            <div v-if="tokensOf(i).length" class="name-tokens">
              <button
                v-for="(t, ti) in tokensOf(i)"
                :key="'mtok-' + ti"
                type="button"
                class="tok"
                :class="tokClass(t, ti)"
                v-tip="tokTip(t)"
                @click.stop="toggleMultiNameToken(i, ti)"
              >{{ tokText(t) }}</button>
            </div>
          </div>
        </div>

        <div v-else>
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
      </div>

      <!-- 输出格式：三等分；色深路线下 WEBP 置灰（WebP 无色数概念，保持 quality 编码） -->
      <div class="mod-form__group">
        <p class="mod-form__caption">{{ $t('outputFormat') }}</p>
        <is-checkbox-group v-model="formatList" class="fmt-grid">
          <is-checkbox
            v-for="format in formatStatic"
            :key="format"
            :label="format"
            :disabled="isColorsMode && format === 'WEBP'"
            v-tip="isColorsMode && format === 'WEBP' ? $t('webpNoColorsTip') : ''"
          />
        </is-checkbox-group>
      </div>
      </div><!-- /基础 -->

      <!-- 路径分类 -->
      <div v-show="allInOne || activeTab === 'output'" class="mod-pane">

      <!-- 序列帧目录（仅 CEP 合成）：与输出路径完全相同的三段式自制结构，
           独立预设 → 真实路径 → 展开变量路径；只决定中间帧渲染位置，与产物路径解耦。 -->
      <div v-if="!showPathUI" class="mod-form__group seq-dir-group">
        <div class="mod-form__capline">
          <p class="mod-form__caption mod-form__caption--flush">{{ $t('seqDirTitle') }}</p>
          <span class="capline-act path-vars-toggle">
            <span>{{ $t('pathVar') }}</span>
            <is-switch v-model="seqVariablesExpanded" />
          </span>
        </div>
        <!-- 第一段：预设选择与创建 -->
        <is-preset-bar
          :presets="seqPresetItems"
          :active-id="seqPresetActiveId"
          :ctx="seqPathContext"
          :current-template="seqDirTemplate"
          :disabled="projectCount === 0"
          @apply="onSeqPresetApply"
          @save="onSeqPresetSave"
          @reset="onSeqPresetReset"
          @remove="onSeqPresetRemove"
        />
        <div class="path-rows">
          <!-- 第二段：真实路径（只读预览）+ 右侧选目录按钮 -->
          <div class="path-row">
            <span class="path-row__label">{{ $t('seqDirTitle') }}</span>
            <is-input
              class="path-row__in"
              :value="seqDirPreviewUI"
              readonly
              :placeholder="$t('seqDirPlaceholder')"
            />
            <button
              type="button"
              class="path-row__pick"
              v-tip="$t('pickSeqDir')"
              @click.stop="pickSeqDir"
            ><is-icon name="folder" size="sm" /></button>
          </div>
          <p class="mod-form__hint">{{ $t('seqDirHint') }}</p>
          <!-- 第三段：展开后可编辑变量路径 + 变量选择 -->
          <transition name="is-collapse">
            <div v-if="seqVariablesExpanded" class="path-variables-panel">
              <path-vars
                v-model="seqDirTemplate"
                :ctx="seqPathContext"
                :placeholder="$t('seqDirTemplatePh')"
                var-scope="seq"
                @insert="insertSeqVariable"
              >
                <button
                  slot="append"
                  type="button"
                  class="pv__bookmark"
                  :class="{ 'is-on': seqBookmarkOpen }"
                  v-tip="$t('presetSaveTip')"
                  :aria-label="$t('presetSaveTip')"
                  @click.stop="seqBookmarkOpen = !seqBookmarkOpen"
                ><is-icon name="bookmark" size="sm" /></button>
              </path-vars>
              <transition name="is-collapse">
                <div v-if="seqBookmarkOpen" class="bookmark-row">
                  <is-input
                    v-model="seqBookmarkLabel"
                    class="bookmark-row__in"
                    size="sm"
                    :placeholder="$t('presetNamePh')"
                    :maxlength="16"
                    @keyup.enter.native="confirmSeqBookmark"
                    @keyup.esc.native="seqBookmarkOpen = false"
                  />
                  <button type="button" class="bookmark-row__ok" :aria-label="$t('confirm')" @click.stop="confirmSeqBookmark">
                    <is-icon name="check" size="xs" />
                  </button>
                  <button type="button" :aria-label="$t('cancel')" @click.stop="seqBookmarkOpen = false">
                    <is-icon name="close" size="xs" />
                  </button>
                </div>
              </transition>
            </div>
          </transition>
        </div>
      </div>

      <!-- 输出路径：展示真实路径；CEP 无「选目录/输出到目录」（固定为项目旁合成子目录） -->
      <div class="mod-form__group">
        <div class="mod-form__capline">
          <p class="mod-form__caption mod-form__caption--flush">{{ $t("outputTo") }}</p>
          <span class="capline-act path-vars-toggle">
            <span>{{ $t('pathVar') }}</span>
            <is-switch v-model="variablesExpanded" />
          </span>
        </div>
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
              v-if="canPickDir"
              type="button"
              class="path-row__pick"
              v-tip="$t('pickOutputDir')"
              @click.stop="pickOutputDir"
            ><is-icon name="folder" size="sm" /></button>
          </div>

          <p v-if="isArraySetting" class="mod-form__hint">{{ $t('multiPathHint') }}</p>

          <transition name="is-collapse">
            <div v-if="variablesExpanded" class="path-variables-panel">
              <!-- 变量路径与胶囊按需展开；append 插槽用于收藏模板 -->
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
          </transition>
        </div>
      </div>
      </div><!-- /路径 -->

      <!-- 动画分类 -->
      <div v-show="allInOne || activeTab === 'animation'" class="mod-pane">
      <!-- 动画参数：帧率与循环次数 -->
      <div v-if="showFrame || canRemapFrames" class="mod-form__group animation-settings">
        <p class="mod-form__caption">{{ $t('animationSettings') }}</p>
        <div class="animation-settings__row">
          <div v-if="showFrame" class="mod-form__row">
            <span class="row-label">{{ $t('fps') }}</span>
            <is-input v-model="frameRate" type="number" class="num" :max="100" :min="0" number placeholder="25" />
            <button type="button" class="is-info" v-tip="$t('fpsUnit')">
              <is-icon name="info" size="sm" />
            </button>
          </div>
          <div class="mod-form__row">
            <span class="row-label">{{ $t('loop') }}</span>
            <is-input v-model="loop" type="number" class="num" number placeholder="0" />
            <span class="unit">{{ $t('times') }}</span>
            <button type="button" class="is-info" v-tip="$t('loopTips')">
              <is-icon name="info" size="sm" />
            </button>
          </div>
        </div>
      </div>
      </div><!-- /动画 -->

      <!-- 压缩分类 -->
      <div v-show="allInOne || activeTab === 'compression'" class="mod-pane">
      <!-- 压缩设置：质量与抽帧并排，阈值设置放在下方 -->
      <div class="mod-form__group compression-settings">
        <p class="mod-form__caption">{{ $t('compressionSettings') }}</p>
        <!-- 压缩设置固定一行：左=模式 tab（左对齐），右=开启压缩开关＋对应控件（右对齐）。
             两模式共用同一个总开关，色深模式也有开关（消掉旧版只有质量模式有「启用」的不一致）。
             关压缩=保真（保留源 32-bit，仅 apngopt 无损）。 -->
        <div class="compression-settings__row" :class="{ 'is-compression-off': !compressionEnabled }">
          <div class="compression-settings__mode">
            <is-segmented
              v-model="paletteMode"
              :options="paletteModeOptions"
              size="sm"
              :disabled="!compressionEnabled"
            />
            <button type="button" class="is-info" :aria-label="$t('paletteMode')" v-tip="$t('paletteModeTip')">
              <is-icon name="info" size="sm" />
            </button>
          </div>
          <div class="compression-settings__value">
            <is-checkbox v-model="compressionEnabled">{{ $t('compressionEnable') }}</is-checkbox>
            <is-input
              v-if="!isColorsMode"
              v-model="quality"
              type="number"
              class="num"
              :disabled="!compressionEnabled"
              :max="100"
              :min="0"
              number
              placeholder="100"
            />
            <is-select
              v-else
              v-model="paletteColors"
              :options="paletteColorOptions"
              class="num"
              :aria-label="$t('paletteColors')"
              :disabled="!compressionEnabled"
            />
            <button v-if="isColorsMode" type="button" class="is-info" :aria-label="$t('paletteColors')" v-tip="$t('colorsTip')">
              <is-icon name="info" size="sm" />
            </button>
            <button v-else type="button" class="is-info" :aria-label="$t('compressionQuality')" v-tip="$t('qualityTip')">
              <is-icon name="info" size="sm" />
            </button>
          </div>
        </div>
        <p v-if="!compressionEnabled" class="compression-settings__preserve-note">
          <is-icon name="info" size="sm" /> {{ $t('preserveBitDepthNote') }}
        </p>
        <div v-if="canRemapFrames" class="mod-form__row mod-form__row--remap">
          <is-checkbox v-model="frameRemapEnabled">{{ $t('frameRemapEnable') }}</is-checkbox>
          <span class="row-label row-label--remap">{{ $t('frameRemapTarget') }}</span>
          <is-input v-model="frameRemapTargetRate" type="number" class="num" :disabled="!frameRemapEnabled" :max="remapSourceRate" :min="0.01" :step="0.01" number />
          <button type="button" class="is-info" :aria-label="$t('frameRemapTarget')" v-tip="$t('frameRemapTip')">
            <is-icon name="info" size="sm" />
          </button>
        </div>
        <div class="compression-settings__threshold" :class="{ 'is-compression-off': !compressionEnabled }">
          <div class="mod-form__capline">
            <p class="mod-form__caption mod-form__caption--flush">{{ $t("sizeLimit") }}</p>
            <span class="capline-act">
              <is-switch v-model="sizeEnabled" :disabled="!compressionEnabled" />
              <button type="button" class="is-info" :aria-label="$t('sizeLimitEnable')" v-tip="$t('sizeLimitEnableTip')">
                <is-icon name="info" size="sm" />
              </button>
            </span>
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
              <button type="button" class="is-info" :aria-label="$t('sizeLimitMax')" v-tip="$t('sizeLimitMaxTip')">
                <is-icon name="info" size="sm" />
              </button>
            </div>
            <quality-retry-sliders
              v-if="!isColorsMode"
              :start-quality="minimumSelectedQuality"
              :tries="sizeMaxTries"
              @tries-change="sizeMaxTries = $event"
            />
            <p v-else class="size-limit__colors-note">
              {{ $t('colorsRetryNote') }}
            </p>
          </div>
        </div>
      </div>
      </div><!-- /压缩 -->
    </section>

    <!-- 固定底部：跨分类提示常驻，切到任一 tab 都看得见 -->
    <div v-if="curtSetting" class="mod-form__footer">
      <p v-if="hasUnsupportedRemapItems" class="frame-remap-note">
        <is-icon name="info" size="sm" /> {{ $t('frameRemapUnsupported') }}
      </p>
      <p v-if="!canStart" class="mod-form__warn">
        <is-icon name="alert" size="sm" /> {{ $t('needOneFormat') }}
      </p>

      <is-button
        type="primary"
        size="lg"
        block
        :icon="isArraySetting ? 'layers' : 'play'"
        :disabled="isStarted || !canStart"
        :loading="isStarted"
        @click="start('')"
      >{{ isArraySetting ? $t("batchStart") : $t("start") }}</is-button>

      <is-button
        v-if="isArraySetting && showPathUI"
        block
        icon="folder"
        :disabled="isStarted"
        @click="changeOutput"
      >{{ $t("outputTofolder") }}</is-button>
    </div>

    <!-- 底部工具条已迁至中栏（设置/删除所选），避免双入口 -->
  </section>
</template>
<script>
import processor from '../../util/processor'
import { ipc } from '../../util/node-env'
import hostAdapter from '../../util/host-env'
import { resolveOutputPath, normalizeOutputTo, outputContext, seqDirContext, resolveSeqDir, SEQ_DIR_DEFAULT_TEMPLATE } from '../../util/outputPath'
import {
  SEQ_DIR_PRESETS_KEY,
  loadPresets,
  savePresets,
  presetList,
  seqPresetList,
  activePresetIdOf,
  activeSeqDirPresetIdOf,
  activePresetOf,
  setBuiltinTemplate,
  setSeqDirBuiltinTemplate,
  resetBuiltinTemplate,
  upsertCustomPreset,
  removeCustomPreset
} from '../../util/outputPresets'
import { tokenizeName, joinTokens } from '../../util/tokenizeName'
import { PALETTE_COLOR_PRESETS, normalizePalette, isPreserveBitDepth } from '../../util/paletteConfig'
import PathVars from '../../ui-next/components/PathVars.vue'
import IsPresetBar from '../../ui-next/components/IsPresetBar.vue'
import notice from '../../ui-next/notice'
import { automaticRetryCount, effectiveQualityStart } from '../../util/sizeLimitConfig'
import { OUTPUT_FORMATS } from '../../util/outputFormats'
import QualityRetrySliders from '../../ui-next/components/QualityRetrySliders.vue'

export default {
  props: {
    hideTitle: { type: Boolean, default: false },
    // true = 最早那版：不分类 Tab，基础/路径/动画/压缩全部纵向排在一页
    allInOne: { type: Boolean, default: false }
  },
  components: { PathVars, IsPresetBar, QualityRetrySliders },
  data () {
    return {
      // 顶部固定分类；任务切换时不重置（不写进 selectedList 的 watcher）
      activeTab: 'basic',
      sizeDraft: null,
      // 「真实路径」行的展开结果
      pathPreviewUI: '',
      pressed: '',
      // 输出名的拆词胶囊：[{ text, sep, on }]
      nameTokens: [],
      // 多选：每项独立拆词，key = inputPath|type
      nameTokenMap: {},
      // 输出路径预设（内置覆盖 + 用户自定义），独立 storage 键持久化
      outputPresets: loadPresets(),
      // 「将当前路径存为预设」的内联命名框
      bookmarkOpen: false,
      bookmarkLabel: '',
      variablesExpanded: false,
      // 序列帧目录（CEP 上游）：独立预设 + 变量面板展开态
      seqVariablesExpanded: false,
      seqDirPresets: loadPresets(SEQ_DIR_PRESETS_KEY),
      seqBookmarkOpen: false,
      seqBookmarkLabel: ''
    }
  },
  computed: {
    // 顶部固定分类：CEP 窄面板只显示图标，标签仍用于无障碍与桌面 tooltip
    tabOptions () {
      return [
        { value: 'basic', label: this.$t('settingTabBasic'), icon: 'edit' },
        { value: 'output', label: this.$t('settingTabOutput'), icon: 'folder' },
        { value: 'animation', label: this.$t('settingTabAnimation'), icon: 'film' },
        { value: 'compression', label: this.$t('settingTabCompression'), icon: 'sliders' }
      ]
    },
    selectedList () {
      return this.$store.getters.getterSelected
    },
    minimumSelectedQuality () {
      if (!this.selectedList.length) return 100
      return this.selectedList.reduce(function (minimum, item) {
        const quality = item && item.options && item.options.quality
        const value = effectiveQualityStart(quality && quality.value, quality && quality.checked)
        return isFinite(value) ? Math.min(minimum, value) : minimum
      }, 100)
    },
    projectCount () {
      return this.$store.getters.getterItems.length
    },
    isLocked () {
      return this.$store.getters.getterLocked
    },
    // 多选时仍用「第一项」作为表单基值；setter 统一写到所有选中项
    isArraySetting () {
      return this.selectedList.length > 1
    },
    // CEP：可显示路径，但不提供「批量输出到目录 / 删除全部」（合成列表由 AE 托管）
    showPathUI () {
      return !(hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep'))
    },
    // 选目录按钮：桌面与 CEP 都提供。CEP 下序列帧路径固定，但变量路径指向的是
    // 最终产物输出目录，用户仍需能图形化选择；pickFolder 内部按宿主分派通道。
    canPickDir () {
      return !!(hostAdapter && typeof hostAdapter.pickFolder === 'function')
    },
    curtSetting () {
      if (this.selectedList.length === 0) {
        return false
      }
      return this.selectedList[0].options
    },
    selectedIndex () {
      return this.$store.getters.getterSelectedIndex
    },
    isStarted () {
      if (!this.selectedList.length) {
        return false
      }
      var anyRunning = this.selectedList.some(function (it) {
        var s = it.process && it.process.schedule
        return s > 0 && s < 1
      })
      return anyRunning
    },
    // 至少勾选一种输出格式才能开始（多选时要求每一项都有格式）
    canStart () {
      if (!this.selectedList.length) return false
      return this.selectedList.every(function (it) {
        var fmt = it.options && it.options.outputFormat
        return !!(fmt && fmt.length)
      })
    },
    showFrame () {
      if (!this.selectedList.length) {
        return false
      }
      // 多选时只要有一项是 PNGs/Comp 就展示帧频（写入所有选中项）
      // Comp 转换前渲序列，输出 APNG 的 fps 仍走 frameRate
      return this.selectedList.some(function (it) {
        return it.basic && (it.basic.type === 'PNGs' || it.basic.type === 'Comp')
      })
    },
    canRemapFrames () {
      return this.selectedList.length > 0 && this.selectedList.every(function (item) {
        const type = item && item.basic && item.basic.type
        return type === 'PNGs' || type === 'Comp' || type === 'APNG'
      })
    },
    hasUnsupportedRemapItems () {
      return this.selectedList.some(function (item) {
        const type = item && item.basic && item.basic.type
        return type !== 'PNGs' && type !== 'Comp' && type !== 'APNG'
      })
    },
    remapSourceRate () {
      if (!this.selectedList.length) return 1
      return this.selectedList.reduce(function (minimum, item) {
        const basic = (item && item.basic) || {}
        const rate = basic.type === 'APNG'
          ? 100
          : basic.type === 'Comp' && Number(basic.compFps) > 0
            ? Number(basic.compFps)
            : Number(item && item.options && item.options.frameRate)
        return isFinite(rate) && rate > 0 ? Math.min(minimum, rate) : minimum
      }, 100)
    },
    formatStatic () {
      if (!this.selectedList.length) {
        return OUTPUT_FORMATS.slice()
      }
      // 源全是 GIF 时不提供 GIF 输出；混合类型保留完整选项
      var allGif = this.selectedList.every(function (it) {
        return it.basic && it.basic.type === 'GIF'
      })
      if (allGif) {
        return OUTPUT_FORMATS.filter(function (f) { return f !== 'GIF' })
      }
      return OUTPUT_FORMATS.slice()
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
      if (!this.selectedList.length) { return null }
      // 多选：以第一项作示例展开；各任务仍按自己的 src/name 解析
      return outputContext(this.selectedList[0])
    },
    varChips () {
      const ctx = this.pathContext
      if (!ctx) { return [] }
      return [
        { key: 'srcPath', value: ctx.srcPath },
        { key: 'src', value: ctx.src },
        { key: 'srcName', value: ctx.srcName },
        { key: 'name', value: ctx.name },
        { key: 'type', value: ctx.type },
        { key: 'parent', value: ctx.parent },
        { key: 'date', value: ctx.date }
      ]
    },
    frameRate: {
      get () { return this.curtSetting.frameRate },
      set (value) {
        this.writeOptions({ frameRate: value })
      }
    },
    frameRemapEnabled: {
      get () { return !!(this.curtSetting && this.curtSetting.frameRemap && this.curtSetting.frameRemap.enabled) },
      set (value) {
        const current = (this.curtSetting && this.curtSetting.frameRemap) || {}
        let targetFrameRate = Number(current.targetFrameRate)
        if (!isFinite(targetFrameRate) || targetFrameRate <= 0 || targetFrameRate >= this.remapSourceRate) {
          targetFrameRate = Math.max(0.01, Math.floor(this.remapSourceRate * 0.8 * 100) / 100)
        }
        this.writeOptions({ frameRemap: { enabled: !!value, targetFrameRate: targetFrameRate } })
      }
    },
    frameRemapTargetRate: {
      get () {
        const remap = this.curtSetting && this.curtSetting.frameRemap
        const value = Number(remap && remap.targetFrameRate)
        const fallback = Math.max(0.01, Math.floor(this.remapSourceRate * 0.8 * 100) / 100)
        return Math.min(this.remapSourceRate, isFinite(value) && value > 0 ? value : fallback)
      },
      set (value) {
        const numeric = Number(value)
        if (!isFinite(numeric) || numeric <= 0) return
        const current = (this.curtSetting && this.curtSetting.frameRemap) || {}
        this.writeOptions({ frameRemap: { enabled: !!current.enabled, targetFrameRate: Math.min(this.remapSourceRate, numeric) } })
      }
    },
    loop: {
      get () { return this.curtSetting.loop },
      set (value) {
        this.writeOptions({ loop: value })
      }
    },
    outputName: {
      get () { return (this.curtSetting && this.curtSetting.outputName) || '' },
      set (value) {
        this.writeOptions({ outputName: value })
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
        this.writeOptions({ outputFormat: value })
      }
    },
    // 压缩总开关（compressionEnabled = !preserveBitDepth）：
    // 关压缩=保真输出，仅 apngopt 无损，体积闸失效；开压缩=现状两路线。
    // 开启时同步把质量路线的 checked 打开（旧的独立「启用」勾选已移除，避免真开压缩却走无损）。
    compressionEnabled: {
      get () { return !isPreserveBitDepth(this.curtSetting) },
      set (value) {
        this.writeOptions({
          preserveBitDepth: !value,
          quality: { checked: value ? true : this.curtSetting.quality.checked, value: this.quality }
        })
      }
    },
    qualityCheck: {
      get () { return this.curtSetting.quality.checked },
      set (value) { this.writeOptions({ quality: { checked: value, value: this.quality } }) }
    },
    quality: {
      get () { return this.curtSetting.quality.value },
      set (value) {
        if (!isFinite(Number(value)) || value > 100 || value < 0) return false
        this.writeOptions({ quality: { checked: this.qualityCheck, value: value } })
      }
    },
    // 压缩路线切换：quality / colors 二选一（互斥）。旧数据无 palette 字段时
    // normalizePalette 兜底为 quality，UI 与转换链路共用同一解读
    paletteModeOptions () {
      return [
        { label: this.$t('paletteModeQuality'), value: 'quality' },
        { label: this.$t('paletteModeColors'), value: 'colors' }
      ]
    },
    paletteColorOptions () {
      return PALETTE_COLOR_PRESETS.map((n) => ({ label: String(n), value: n }))
    },
    isColorsMode () {
      return normalizePalette(this.curtSetting).mode === 'colors'
    },
    paletteMode: {
      get () { return normalizePalette(this.curtSetting).mode },
      set (value) {
        this.writeOptions({ palette: { mode: value, colors: this.paletteColors } })
      }
    },
    paletteColors: {
      get () { return normalizePalette(this.curtSetting).colors },
      set (value) {
        this.writeOptions({ palette: { mode: 'colors', colors: value } })
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
    sizeMaxTries: {
      get () {
        const s = this.curtSetting && this.curtSetting.sizeLimit
        return automaticRetryCount(this.minimumSelectedQuality, s && s.maxTries)
      },
      set (value) { this.pushSizeLimit({ maxTries: Number(value) }) }
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
    },
    // 序列帧目录模板（每任务独立，与 outputTo 对称存在 options 上）。
    // 空值 = 用默认「工程旁合成名目录」，由 comp-source 回退。
    seqDirTemplate: {
      get () {
        const t = this.curtSetting && this.curtSetting.seqDirTemplate
        // 老任务没有该字段 / 用户清空输入：都按出厂默认「工程旁合成名目录」展示
        return typeof t === 'string' && t.trim() ? t.trim() : SEQ_DIR_DEFAULT_TEMPLATE
      },
      set (value) { this.writeOptions({ seqDirTemplate: String(value || '') }) }
    },
    // 序列帧输入框展示值：有自定义显示模板，否则显示默认展开路径（工程旁合成名）
    seqDirPreviewUI () {
      if (!this.selectedList.length) { return '' }
      const resolved = resolveSeqDir(this.selectedList[0])
      if (resolved) { return resolved }
      const b = this.selectedList[0].basic || {}
      return b.outputBasePath || ''
    },
    // 变量面板 ctx：序列帧自己的基准（工程目录 + 合成名），与产物 ctx 分开
    seqPathContext () {
      if (!this.selectedList.length) { return null }
      return seqDirContext(this.selectedList[0])
    },
    // 序列帧预设：内置（工程旁合成名 / 工程目录 / 上级目录）+ 用户自定义
    seqPresetItems () {
      return seqPresetList(this.seqDirPresets)
    },
    seqPresetActiveId () {
      return activeSeqDirPresetIdOf(this.seqDirTemplate, this.seqDirPresets)
    }
  },
  // 注意：原实现在对象末尾多写了一个空的 watch，
  // 按「后者覆盖前者」的规则把这里的 selectedList / curtSetting 监听整块吃掉了，
  // 导致切换选中项后路径预览停留在上一个项目。
  watch: {
    // 切换分类后把表单滚动区带回顶部，避免沿用上一分类的滚动位置
    activeTab () {
      this.$nextTick(() => {
        const el = this.$el && this.$el.querySelector && this.$el.querySelector('.mod-form')
        if (el) { el.scrollTop = 0 }
      })
    },
    variablesExpanded (expanded) {
      if (!expanded) { this.bookmarkOpen = false }
    },
    seqVariablesExpanded (expanded) {
      if (!expanded) { this.seqBookmarkOpen = false }
    },
    selectedList () {
      this.syncPathUI()
      this.syncMultiNameTokens()
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
    this.syncMultiNameTokens()
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
    canRemapType (item) {
      const type = item && item.basic && item.basic.type
      return type === 'PNGs' || type === 'Comp' || type === 'APNG'
    },
    /**
     * 写入选中项的 options：
     * - 单选（含设置按钮进入的单项）只写该 item，禁止串到全部
     * - 多选才批量写所有选中项（横幅语义）
     */
    writeOptions (patch) {
      if (!patch || !this.selectedList.length) { return }
      if (this.selectedList.length === 1) {
        var all = this.$store.getters.getterItems
        var index = all.indexOf(this.selectedList[0])
        if (index < 0) { return }
        this.$store.dispatch('editOptionsAt', { index: index, patch: patch })
        return
      }
      this.$store.dispatch('editMultiOptions', patch)
    },
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
      this.commitSizeDraft()
    },
    commitSizeDraft () {
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
      if (!this.selectedList.length) { return }
      const base = normalizeOutputTo(this.curtSetting)
      const next = Object.assign({}, base, patch)
      this.$store.dispatch('applyOutputTemplate', { outputTo: next })
      this.syncPathUI()
    },
    syncPathUI () {
      if (!this.selectedList.length) {
        this.pathPreviewUI = ''
        return
      }
      // 多选显示首项示例路径；生成时各任务各自解析模板
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
    // ---------- 序列帧目录预设（独立 storage，与产物预设隔离）----------
    onSeqPresetApply (p) {
      this.seqDirTemplate = p.template
    },
    onSeqPresetSave (entry) {
      if (entry.builtin) {
        this.seqDirPresets = setSeqDirBuiltinTemplate(this.seqDirPresets, entry.id, entry.template)
      } else {
        this.seqDirPresets = upsertCustomPreset(this.seqDirPresets, entry)
      }
      savePresets(this.seqDirPresets, SEQ_DIR_PRESETS_KEY)
      if (this.seqPresetActiveId === entry.id || entry.id === '') {
        this.seqDirTemplate = entry.template
      }
    },
    onSeqPresetReset (p) {
      this.seqDirPresets = resetBuiltinTemplate(this.seqDirPresets, p.id)
      savePresets(this.seqDirPresets, SEQ_DIR_PRESETS_KEY)
      notice.success(this.$t('presetResetDone'), this.$t('presetResetDoneTip'))
    },
    onSeqPresetRemove (p) {
      this.seqDirPresets = removeCustomPreset(this.seqDirPresets, p.id)
      savePresets(this.seqDirPresets, SEQ_DIR_PRESETS_KEY)
    },
    confirmSeqBookmark () {
      const tpl = String(this.seqDirTemplate || '').trim()
      if (!tpl) {
        notice.warning(this.$t('presetSaveEmpty'), this.$t('presetSaveEmptyTip'))
        this.seqBookmarkOpen = false
        return
      }
      this.seqDirPresets = upsertCustomPreset(this.seqDirPresets, {
        label: this.seqBookmarkLabel || this.$t('presetUnnamed'),
        template: tpl
      })
      savePresets(this.seqDirPresets, SEQ_DIR_PRESETS_KEY)
      this.seqBookmarkOpen = false
      this.seqBookmarkLabel = ''
      notice.success(this.$t('presetSaved'), this.$t('presetSavedTip'))
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
      if (!this.selectedList.length) { return }
      const cur = this.pathPreviewUI || ''
      // 统一走 hostAdapter：桌面 dialog:openDirectory / CEP ispartaPickOutputFolder /
      // 浏览器 mock，返回绝对路径字符串或 null（取消/失败）
      Promise.resolve(hostAdapter.pickFolder(cur)).then((picked) => {
        if (!picked) { return }
        // 绝对路径本身就是合法模板（无变量时原样返回），直接写入统一字段
        this.pushOutputTo({ template: picked, mode: 'custom' })
        this.syncPathUI()
      }).catch(() => {})
    },
    // 序列帧目录：与 outputTo 一样存在 options，逐项写入（每任务独立）
    pickSeqDir () {
      if (!this.selectedList.length) { return }
      const cur = this.seqDirPreviewUI || ''
      Promise.resolve(hostAdapter.pickFolder(cur)).then((picked) => {
        if (picked) { this.writeOptions({ seqDirTemplate: String(picked) }) }
      }).catch(() => {})
    },
    // 点击变量标签把 {key} 追加到模板末尾（产物路径）
    insertVariable (key) {
      const token = '{' + key + '}'
      const cur = this.outputToTemplate || ''
      this.outputToTemplate = cur ? cur + token : token
    },
    // 序列帧变量胶囊：写入自己的模板，不碰产物 outputTo（两组路径保持解耦）
    insertSeqVariable (key) {
      const token = '{' + key + '}'
      const cur = this.seqDirTemplate || ''
      this.seqDirTemplate = cur ? cur + token : token
    },
    pushSizeLimit (patch) {
      const base = (this.curtSetting && this.curtSetting.sizeLimit) || {
        enabled: false,
        maxMB: 1,
        maxBytes: 1048576,
        unit: 'MB',
        autoDelete: true,
        autoQuality: true,
        step: 5,
        maxTries: 10
      }
      this.writeOptions({
        sizeLimit: Object.assign({}, base, patch)
      })
    },
    // ---------- 多选输出名 ----------
    itemKeyOf (item, i) {
      var basic = item && item.basic
      if (basic && basic.inputPath) {
        return basic.inputPath + '|' + (basic.type || '') + '|' + i
      }
      return 'i-' + i
    },
    srcLabelOf (item) {
      var basic = item && item.basic
      var type = (basic && basic.type) || ''
      var path = (basic && (basic.inputPath || '')) || ''
      var name = path.split(/[\\/]/).filter(Boolean).pop() || '—'
      return type ? type + ' · ' + name : name
    },
    onMultiNameInput (selectedIdx, value) {
      var item = this.selectedList[selectedIdx]
      if (!item) { return }
      var all = this.$store.getters.getterItems
      var index = all.indexOf(item)
      if (index < 0) { return }
      this.$store.dispatch('editOutputNameAt', { index: index, name: value })
      // 输入后按新名字重建该项拆词
      var k = this.itemKeyOf(item, selectedIdx)
      this.$set(this.nameTokenMap, k, this.buildTokens(value))
    },
    tokensOf (selectedIdx) {
      var item = this.selectedList[selectedIdx]
      if (!item) return []
      var k = this.itemKeyOf(item, selectedIdx)
      return this.nameTokenMap[k] || []
    },
    multiWordsOnly (selectedIdx) {
      var tokens = this.tokensOf(selectedIdx)
      if (!tokens.length) return false
      var sepOff = 0
      for (var i = 0; i < tokens.length; i++) {
        if (!tokens[i].sep && !tokens[i].on) return false
        if (tokens[i].sep && !tokens[i].on) sepOff++
      }
      return sepOff > 0
    },
    buildTokens (name) {
      return tokenizeName(name || '').map(function (t) {
        return { text: t.text, sep: t.sep, on: true }
      })
    },
    syncMultiNameTokens () {
      var map = {}
      var self = this
      this.selectedList.forEach(function (item, i) {
        var k = self.itemKeyOf(item, i)
        var prev = self.nameTokenMap[k]
        var name = (item.options && item.options.outputName) || ''
        // 词形未变时保留用户点选状态
        if (prev && prev.length && joinTokens(prev) === name) {
          map[k] = prev
        } else {
          map[k] = self.buildTokens(name)
        }
      })
      this.nameTokenMap = map
    },
    toggleMultiNameToken (selectedIdx, ti) {
      var item = this.selectedList[selectedIdx]
      if (!item) return
      var k = this.itemKeyOf(item, selectedIdx)
      var tokens = (this.nameTokenMap[k] || []).slice()
      var t = tokens[ti]
      if (!t) return
      tokens.splice(ti, 1, { text: t.text, sep: t.sep, on: !t.on })
      this.$set(this.nameTokenMap, k, tokens)
      var all = this.$store.getters.getterItems
      var index = all.indexOf(item)
      if (index < 0) return
      this.$store.dispatch('editOutputNameAt', { index: index, name: joinTokens(tokens) })
    },
    toggleMultiWordsOnly (selectedIdx) {
      var item = this.selectedList[selectedIdx]
      if (!item) return
      var k = this.itemKeyOf(item, selectedIdx)
      var toWordsOnly = !this.multiWordsOnly(selectedIdx)
      var tokens = (this.nameTokenMap[k] || []).map(function (t) {
        return { text: t.text, sep: t.sep, on: toWordsOnly ? !t.sep : true }
      })
      this.$set(this.nameTokenMap, k, tokens)
      var all = this.$store.getters.getterItems
      var index = all.indexOf(item)
      if (index < 0) return
      this.$store.dispatch('editOutputNameAt', { index: index, name: joinTokens(tokens) })
    },
    changeOutput () {
      var outputPath = this.selectedList[0].basic.outputPath
      ipc.send('change-multiItem-fold', outputPath)
    },
    start (sameOutputPath) {
      // 开始转换前再次提交输入草稿，避免点击按钮与宿主 blur 顺序差异导致沿用旧阈值。
      this.commitSizeDraft()
      let locale = this.$i18n.messages[this.$i18n.locale]
      for (var i = 0; i < this.selectedList.length; i++) {
        this.$store.dispatch('editProcess', {
          index: i,
          text: '',
          schedule: 0
        })
      }
      // 点开始即回到主面板，转换在后台跑
      try {
        if (this.$root && this.$root.eventBus) {
          this.$root.eventBus.$emit('task-setting-started')
        }
      } catch (eBus) { /* ignore */ }
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
      // CEP：任务=合成列表，删除会清空且无法从 AE 恢复勾选语义
      if (!this.showPathUI) return
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
