<template>
  <section
    class="mod-list"
    @click="onBlankClick"
    @dblclick="onBlankDblclick"
    @mousedown="onListMouseDown"
  >
    <!-- CEP/桌面任务列表过滤条：对齐合成树表头，列改为搜索 / 帧率 / 帧数 -->
    <!-- 任务列表工具条（非表头）：勾选占位 + 搜索 + 排序 chips；钉在滚动区顶部 -->
    <div v-if="showFilterBar" class="mod-list__filter">
      <span class="mod-list__fcol mod-list__fcol--cb">
        <is-checkbox
          :value="allChecked"
          :indeterminate="indeterminate"
          :disabled="isLocked"
          :aria-label="$t('selectAll')"
          @change="toggleAllChecked"
        />
      </span>
      <span class="mod-list__fcol mod-list__fcol--name">
        <input
          v-model="filterKeyword"
          type="search"
          class="mod-list__search"
          :placeholder="$t('search')"
          spellcheck="false"
        />
      </span>
      <button type="button" class="mod-list__chip" :class="{ 'is-on': sortKey === 'fps' }" @click="sortBy('fps')">
        {{ $t('compColFps') }}{{ sortMark('fps') }}
      </button>
      <button type="button" class="mod-list__chip" :class="{ 'is-on': sortKey === 'frames' }" @click="sortBy('frames')">
        {{ $t('compColFrames') }}{{ sortMark('frames') }}
      </button>
      <span class="mod-list__fcol mod-list__fcol--act"></span>
    </div>

    <!-- 注意：不加 appear —— Vue 2 transition-group 初始挂载时 enter-active 类
         不会挂上（enter-to 残留），实测动画不生效且留脏类；stagger 仅在
         「向已有列表追加」的常规 enter 路径上生效（已实测验证） -->
    <transition-group name="is-list" tag="div" class="mod-list__inner">
      <div
        v-for="(project, index) in projectList"
        :key="itemKey(project, index)"
        class="item"
        :class="itemClass(project)"
        :data-index="index"
        data-tip-owner
        v-tip="titleTipOf(project)"
        @contextmenu.prevent="itemRightClick($event, project, index)"
        @click="onItemClick(index)"
        @dblclick="onItemDblclick($event, project)"
      >
        <!-- 勾选：多选切换，阻止冒泡以免触发单选 -->
        <div class="check" @click.stop>
          <is-checkbox
            :value="!!project.isSelected"
            :disabled="isLocked"
            :aria-label="$t('selectAll')"
            @change="toggleSelect(index)"
          />
        </div>

        <!-- 缩略图：桌面悬停逐帧；CEP 合成无原生预览，不显示封面 -->
        <div
          v-if="showThumb(project)"
          class="thumb is-checker"
          :class="{ 'is-comparable': stateOf(project.process) === 'done' }"
          @click.stop="openCompare(project)"
        >
          <img
            v-if="thumbSrc(project, index)"
            :src="thumbSrc(project, index)"
            :alt="project.basic && project.basic.type"
            loading="lazy"
            @mouseenter="startHover(index)"
            @mouseleave="stopHover"
          />
          <is-icon v-else name="image" class="thumb__ph" />
          <span v-if="durationOf(project)" class="thumb__dur">{{ durationOf(project) }}</span>
          <!-- 序列仍显示帧数；单文件动图改显示当前输出格式，类型信息不再重复放胶囊 -->
          <span v-if="isAnimatedSingle(project)" class="thumb__badge thumb__badge--fmt">{{ primaryFormatOf(project) }}</span>
          <span v-else-if="frameCount(project) > 1" class="thumb__badge">{{ frameCount(project) }}F</span>
          <span v-if="stateOf(project.process) === 'done'" class="thumb__cmp-hint">
            <is-icon name="eye" size="xs" />
          </span>
        </div>

        <div class="info">
          <!-- 第一行：左侧原文件名（序列帧=序列标识），右侧输入路径；详情气泡挂整个任务条 -->
          <div class="input">
            <div class="item-names">
              <!-- 标题 + 路径合并为一行：标题优先收窄，路径占剩余宽度 -->
              <div class="item-headrow">
                <!-- 序列帧：类型标识做胶囊，与文件名纯文本明确区分；CEP 合成名仍走文本分支 -->
                <div class="item-title" :class="{ 'is-ellipsis': !(showOutPath && isSeqLike(project)) }">
                  <span v-if="showOutPath && isSeqLike(project)" class="seq-chip">{{ $t('seqFrameMark') }}</span>
                  <template v-else>{{ showOutPath ? sourceNameOf(project) : displayTitleOf(project, index) }}</template>
                </div>
                <!-- 桌面：路径显示输入源，点击仍是改输出目录；CEP：只读输出短路径（勿把 ae-comp/路径当名字） -->
                <button
                  v-if="showOutPath && isRealFsPath(outPathOf(project))"
                  type="button"
                  class="outpath is-ellipsis"
                  v-tip="$t('tipInputDir') + '：' + inputFullPathOf(project)"
                  @click.stop="changeFold(project.basic && project.basic.outputPath, index)"
                >
                  <is-icon name="folder" size="xs" />
                  <span class="is-ellipsis">{{ inputLabelOf(project) }}</span>
                </button>
                <span
                  v-else-if="!showOutPath && pathLabelOf(project)"
                  class="outpath outpath--static is-ellipsis"
                  v-tip="titleTipOf(project)"
                >
                  <is-icon name="folder" size="xs" />
                  <span class="is-ellipsis">{{ pathLabelOf(project) }}</span>
                </span>
              </div>
              <!-- 状态独立第二行且始终占位，四态切换不抖动；空态显示中性文案 -->
              <div
                class="item-proc is-ellipsis"
                :class="['is-' + stateOf(project.process), { 'is-empty': !project.process || !project.process.text }]"
              >{{ (project.process && project.process.text) || $t('statePending') }}</div>
            </div>
          </div>
          <!-- 第二行：默认参数摘要（帧频/循环/格式/阈值） -->
          <div class="summary">
            <span class="sum sum--fps" v-tip="tipOf('fps', fpsTip(project))">
              <is-icon name="zap" size="xs" /><span class="sum-v">{{ frameRateOf(project) }} f/s</span>
            </span>
            <span class="sum sum--loop" v-tip="tipOf('loop', loopTip(project))">
              <is-icon name="refresh" size="xs" /><span class="sum-v">{{ loopText(project) }}</span>
            </span>
            <span class="sum sum--fmt" v-tip="tipOf('outputFormat', formatText(project))">
              <is-icon name="layers" size="xs" /><span class="sum-v">{{ formatText(project) }}</span>
            </span>
            <span
              v-if="sizeLimitOf(project)"
              class="sum sum--limit"
              v-tip="tipOf('sizeLimit', sizeLimitTip(project))"
            >
              <is-icon name="box" size="xs" /><span class="sum-v">≤ {{ sizeLimitOf(project) }}</span>
            </span>
            <span
              v-if="stateOf(project.process) === 'done' && outputSizeOf(project)"
              class="sum sum--size"
              v-tip="outputSizeTip(project)"
            >
              <is-icon name="save" size="xs" /><span class="sum-v">{{ outputSizeOf(project) }}</span>
            </span>
          </div>
          <!-- 第三行：输出名 + 输出路径（仅桌面）。路径默认显示完整真实路径（行内截断，
               hover 气泡给全文），hover 时行内切换为 {srcPath} 变量写法 -->
          <div v-if="showOutPath" class="summary summary--out">
            <span class="sum sum--name is-ellipsis" v-tip="tipOf('outputName', outNameOf(project))">
              <is-icon name="save" size="xs" /><span class="is-ellipsis">{{ outNameOf(project) || '—' }}</span>
            </span>
            <span class="sum sum--tpl is-ellipsis" v-tip="$t('tipOutputDir') + '：' + outPathOf(project)">
              <is-icon name="sliders" size="xs" />
              <span class="tpl-real is-ellipsis">{{ outPathOf(project) || '—' }}</span>
              <span class="tpl-var is-ellipsis">{{ outTplOf(project) || '—' }}</span>
            </span>
          </div>
        </div>

        <!-- 右侧：完成态格式角标 + 输出设置（单选打开）+ 帧预览/延时（二者独立，勿合并） -->
        <!-- has-est：角标绝对定位到卡片右上角后脱离侧栏流，补一段顶部间距保持其余按钮原位 -->
        <div class="side" :class="{ 'has-est': !!estimateOf(project) }">
          <!-- 右上角常驻：按格式轮换的预估产物大小（≈xxK/M）。
               默认显示最坏格式（决定超限的那个），点击在勾选格式间轮换，hover 看全部分格式明细 -->
          <span
            v-if="estimateOf(project)"
            class="est-badge"
            :class="{
              'is-estimated': estimateOf(project).estimated,
              'is-over': estDisplayOf(index).over,
              'can-cycle': estimateOf(project).details.length > 1
            }"
            v-tip="estimateTipOf(project)"
            :aria-label="estimateOf(project).mode === 'colors'
              ? $t('estimateColorsHover', { size: estimateOf(project).text, c: estimateOf(project).colors })
              : $t('estimateHover', { size: estimateOf(project).text, q: estimateOf(project).quality })"
            @click.stop="cycleEstFormat(index)"
          >{{ estDisplayOf(index).letter }}&nbsp;≈{{ estDisplayOf(index).text }}</span>
          <!-- 每种输出格式一个角标（并排）：hover 看产物名与大小，点击复制该格式产物 -->
          <div v-if="outputBadges[index].length" class="side__badges">
            <button
              v-for="badge in outputBadges[index]"
              :key="badge.format"
              type="button"
              class="fmt-badge"
              :class="'is-' + badge.format.toLowerCase()"
              v-tip="badgeTipOf(badge)"
              :aria-label="$t('outputBadgeCopy', { format: badge.format })"
              @click.stop="copyFormatOutput(badge)"
            >
              <span class="fmt-badge__dot" aria-hidden="true"></span>
              <span class="fmt-badge__name">{{ badge.format }}</span>
            </button>
          </div>
          <div class="side__row">
            <!-- 状态点靠左；按钮组始终贴右，避免有无状态时左右跳动 -->
            <div v-if="showMeta(project)" class="meta">
              <span class="status" :class="'is-' + stateOf(project.process)">
                <is-pacman
                  v-if="stateOf(project.process) === 'running'"
                  size="xs"
                  :dot-count="2"
                  :label="$t('statRunning')"
                />
                <is-icon v-else :name="statusIcon(project.process)" size="sm" />
              </span>
            </div>
            <div class="side__btns">
              <button
                type="button"
                class="iconbtn ib-rail__btn--settings"
                :title="isCepHost && isMultiItems && project.isSelected ? $t('tipTaskSettingMulti', { n: selectedCount }) : $t('tipTaskSetting')"
                :disabled="isLocked"
                @click.stop="onTaskSetting(project, index)"
              ><is-icon name="settings" size="sm" /></button>
              <button
                v-if="canOpenFramePanel(project)"
                type="button"
                class="iconbtn"
                :title="framePanelTitle(project)"
                @click.stop="onDelaySetting(project)"
              ><is-icon name="eye" size="sm" /></button>
            </div>
          </div>
        </div>
        <div
          class="item-bar"
          :class="'is-' + stateOf(project.process)"
          aria-hidden="true"
        >
          <span
            class="item-bar__fill"
            :class="{ 'is-shimmer': stateOf(project.process) === 'running' }"
            :style="{ width: processPrecent(project.process && project.process.schedule) + '%' }"
          ></span>
        </div>
      </div>
    </transition-group>

    <div
      v-if="marquee.active && marquee.moved"
      class="mod-list__marquee"
      :style="marqueeStyle"
      aria-hidden="true"
    ></div>

    <dialay-dialog
      v-if="dialogFormVisible"
      :project="delayProject"
      @close="dialogFormVisible = false"
    ></dialay-dialog>

    <compare-dialog
      v-if="compareProject"
      :project="compareProject"
      @close="compareProject = null"
    ></compare-dialog>

    <button
      v-if="showOutPath"
      type="button"
      class="open-folder"
      :disabled="isLocked"
      @click="openFolder($event)"
    >
      <is-icon name="folder-plus" size="sm" />
      {{ $t('openFolderHint') }}
    </button>
  </section>
</template>
<script>
import { ipc } from '../../util/node-env'
import {
  stateOf, statusIcon, outputFilesOf, sizeBytesOfFiles, outputSizeOf, outputSizeTip,
  outputGroupsOf, sizeTextOfFiles
} from '../../util/task-output'
import { displayNameOf } from '../../util/outputName'
import { buildTitleTipBlocks, buildBadgeTipBlocks, buildOutputSizeTipBlocks } from '../../util/detailTipBlocks'
import rightMenu from './menu'
import DelayDialog from '../delayDialog/index.vue'
import CompareDialog from '../compareDialog/index.vue'
import IsPacman from '../../ui-next/components/IsPacman.vue'
import { f as fsOperate } from '../drag/file.js'
import { naturalSort } from '../../util/sort'
import notice from '../../ui-next/notice'
import hostAdapter, { getSourceAdapter } from '../../util/host-env'
import { fs } from '../../util/node-env'
import {
  estimateOutput, estimateSourceBytes, humanSizeCompact,
  formatLetter, pickEstDetail
} from '../../util/qualityEstimate'
import { buildEstimateTipBlocks } from '../../util/estimateTipBlocks'
import { createLazyEstimate } from '../../util/lazyEstimate'
import { readPngBitDepth, formatCanPreserveBitDepth } from '../../util/pngBitDepth'
import { isPreserveBitDepth } from '../../util/paletteConfig'

/**
 * 取任务源字节：桌面动图文件已落盘 → statSize 真实值；序列任务要**全帧求和**
 * ——fileList 是逐帧路径，只取 fileList[0] 会把 N 帧序列的源量级低估 N 倍，
 * 产物预估随之全线偏小（issue #2「预估一直不准」的主因）。
 * CEP 合成转换前 fileList 为空 → 按 compWidth×compHeight×frameCount 估算（标 estimated）。
 * @returns {{bytes:number, estimated:boolean}|null}
 */
function sourceOf (project) {
  const b = project && project.basic
  try {
    // 母版动图（GIF/APNG/WEBP）一个文件就是整个动画，优先单独取
    const f = b && b.sourceFile
    if (f) {
      const n = fs.statSize(f)
      if (n > 0) return { bytes: n, estimated: false }
    }
    // 序列（或合成渲染出的逐帧 PNG）：逐帧求和；单帧读不到跳过，其余照常计
    const list = (b && b.fileList) || []
    let sum = 0
    let hit = false
    for (let i = 0; i < list.length; i++) {
      try {
        const n = fs.statSize(list[i])
        if (n > 0) { sum += n; hit = true }
      } catch (e) { /* skip this frame */ }
    }
    if (hit && sum > 0) return { bytes: sum, estimated: false }
  } catch (e) { /* 落到合成估算 */ }
  if (b && (b.type === 'Comp' || b.compWidth)) {
    const bytes = estimateSourceBytes(
      b.compWidth || b.width, b.compHeight || b.height, b.frameCount || b.frames)
    if (bytes > 0) return { bytes: bytes, estimated: true }
  }
  return null
}

/** options 签名：源字节 / 目标 / 格式 / 质量 / 压缩路线任一变化都要重算预估 */
function estimateStamp (project) {
  const o = (project && project.options) || {}
  const s = o.sizeLimit || {}
  return [s.enabled, s.maxBytes, s.maxMB, s.unit,
    (o.outputFormat || []).join(','), o.quality && o.quality.value, o.quality && o.quality.checked,
    o.palette && o.palette.mode, o.palette && o.palette.colors, !!o.preserveBitDepth].join('|')
}

/* 封面播放的两个常量，放在组件外避免每次实例化都重建 */
const THUMB_PLAY_MAX = 48
// 帧率缺省 / 为 0 / 负数 / 非数时的兜底。setInterval 收到 NaN 或 0
// 会退化成近乎不停顿地触发，把渲染线程打满。
const THUMB_PLAY_FALLBACK_FPS = 12

export default {
  components: {
    'dialay-dialog': DelayDialog,
    'compare-dialog': CompareDialog,
    'is-pacman': IsPacman
  },
  data () {
    return {
      dialogFormVisible: false,
      delayProject: null,
      // 对比弹窗：仅 done 条目打开（有输出文件可比）
      compareProject: null,
      thumbCache: {},
      hoverIdx: -1,
      // 过滤条：搜索 + 帧率/帧数排序（对齐合成树）
      filterKeyword: '',
      sortKey: '',
      sortDir: 1,
      hoverFrame: 0,
      hoverTimer: null,
      // 封面持续播放：每行一条游标 + 定时器（见 THUMB_PLAY_* 注释）
      playRows: {},
      playTick: 0,
      // 空白处框选
      marquee: { active: false, moved: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 },
      suppressBlankClick: false,
      // 预估角标：异步算完后自增，触发模板重渲染读缓存
      estimateTick: 0,
      // 预估角标点击轮换：记录每条任务的当前显示格式下标（键为列表下标，
      // 与 outputBadges[index] 同一寻址口径；未点过回退最坏格式）
      estFmtIdxMap: {}
    }
  },

  created () {
    // 角标数据缓存：产物存在性/大小要走 fs，进度更新引起重渲染时不该反复打盘
    this._badgeCache = new Map()
    // 预估角标：源字节走 fs/IPC，交给惰性调度器在浏览器空闲时分批算，
    // 结果按 options 签名缓存；算完自增 estimateTick 触发重渲染。
    this._lazyEstimate = createLazyEstimate({
      batch: 3,
      compute: (key, project) => {
        const src = sourceOf(project)
        const value = src ? estimateOutput(project.options, src.bytes, src.estimated) : null
        // 位深（源首帧 IHDR）：与预估同批惰性算 + 缓存；读不到时首帧不显示该行
        if (value) {
          const b = project && project.basic
          const first = (b && b.sourceFile) || (b && b.fileList && b.fileList[0])
          const info = readPngBitDepth(first)
          if (info) {
            value.srcBits = info.bits
            value.srcIndexed = info.colorType === 3
            value.preserve = isPreserveBitDepth(project.options)
            // 保真时按所选格式区分能力：GIF 格式硬上限 256 色索引，保不住 32-bit
            value.limitedFormats = (value.details || [])
              .filter(function (d) { return !formatCanPreserveBitDepth(d.format) })
              .map(function (d) { return d.format })
          }
        }
        return { stamp: estimateStamp(project), value: value }
      },
      onFlush: () => { this.estimateTick++ }
    })
    // 回应修改输出目录的操作
    ipc.on('change-item-fold', (path, order) => {
      if (path[0]) {
        this.$store.dispatch('editBasic', {
          outputPath: path[0]
        })
      }
    })
  },
  watch: {
    // 增删任务、搜索过滤、排序都会改变 projectList 的长度与顺序。
    // 播放游标按**渲染下标**索引，行序一变就整体错位（换个合成放动画），
    // 所以列表一变就整体重启。
    projectList: {
      handler () {
        if (!this._isBeingDestroyed) { this.startThumbPlay() }
      },
      deep: false
    },
    // 逐帧延时/帧率被改后，各行播放节奏要跟着变
    storeItems () {
      if (!this._isBeingDestroyed) { this.startThumbPlay() }
    }
  },
  mounted () {
    // 封面持续播放：列表进入即播，不必先悬停
    this.$nextTick(function () { this.startThumbPlay() })
    this.bindHostBlankEvents()
  },
  beforeDestroy () {
    this.stopHover()
    // 定时器必须在这里清掉：组件销毁后 interval 仍会跑，row.frame 变化触发
    // 重渲染会报「访问已销毁实例」
    this.stopThumbPlay()
    this.unbindMarquee()
    this.unbindHostBlankEvents()
    if (this._badgeCache) this._badgeCache.clear()
    if (this._lazyEstimate) this._lazyEstimate.dispose()
  },
  computed: {
    /**
     * 每个完成任务的「格式角标」分组（与 projectList 同序，模板按渲染下标取用）。
     * 产物存在性与大小要打盘，按「任务对象 + schedule」缓存：动画/进度重渲染不重复读盘，
     * 重新转换（schedule 变化）后自动失效；已移出列表的条目从缓存里清掉。
     */
    outputBadges () {
      const cache = this._badgeCache
      const alive = new Set()
      const list = this.projectList.map((project) => {
        alive.add(project)
        if (this.stateOf(project.process) !== 'done') return []
        const stamp = project.process && project.process.schedule
        const hit = cache && cache.get(project)
        if (hit && hit.stamp === stamp) return hit.groups
        const groups = outputGroupsOf(project)
        if (cache) cache.set(project, { stamp: stamp, groups: groups })
        return groups
      })
      if (cache) {
        cache.forEach(function (v, key) {
          if (!alive.has(key)) cache.delete(key)
        })
      }
      return list
    },
    storeItems () {
      return this.$store.getters.getterItems || []
    },
    selectedList () {
      return this.$store.getters.getterSelected
    },
    isMultiItems () {
      return this.selectedList.length > 1
    },
    itemCount () {
      return (this.$store.getters.getterItems || []).length
    },
    selectedCount () {
      return this.selectedList.length
    },
    allChecked () {
      return this.itemCount > 0 && this.selectedCount === this.itemCount
    },
    indeterminate () {
      return this.selectedCount > 0 && this.selectedCount < this.itemCount
    },
    projectList () {
      var items = this.storeItems || []
      var isCompLike = hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep')
      // 搜索过滤：名称 / 输出名
      var kw = String(this.filterKeyword || '').trim().toLowerCase()
      if (kw) {
        items = items.filter(function (it) {
          var b = (it && it.basic) || {}
          var name = String(b.compName || b.name || b.outputName || '')
          return name.toLowerCase().indexOf(kw) > -1
        })
      }
      // CEP 合成：与合成树「默认可排序态」一致（sortKey 空 = index → 名称）
      if (!isCompLike) {
        return items
      }
      var sk = this.sortKey
      var sd = this.sortDir
      return items.slice().sort(function (a, b) {
        var ba = (a && a.basic) || {}
        var bb = (b && b.basic) || {}
        if (sk === 'fps' || sk === 'frames') {
          var va = sk === 'fps' ? (Number(ba.compFps) || 0) : (Number(ba.frameCount) || 0)
          var vb = sk === 'fps' ? (Number(bb.compFps) || 0) : (Number(bb.frameCount) || 0)
          if (va !== vb) { return (va - vb) * sd }
        }
        if (ba.type !== 'Comp' || bb.type !== 'Comp') return 0
        var ia = Number(ba.compIndex) || 0
        var ib = Number(bb.compIndex) || 0
        if (ia !== ib) return ia - ib
        return String(ba.compName || '').localeCompare(String(bb.compName || ''))
      })
    },
    showFilterBar () {
      // CEP / 合成任务列表显示过滤条；桌面文件任务保持原样
      return !!(hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep'))
    },
    // 仅 CEP 需要「行尾设置保留多选」；桌面右栏常驻、空间充足，维持历史单项语义
    isCepHost () {
      return !!(hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep'))
    },
    isLocked () {
      return this.$store.getters.getterLocked
    },
    // CEP：合成任务不展示输出路径/变量模板，只保留默认参数信息
    showOutPath () {
      return !(hostAdapter && (hostAdapter.supportsCompImport || hostAdapter.kind === 'cep'))
    },
    marqueeStyle () {
      return {
        left: this.marquee.x + 'px',
        top: this.marquee.y + 'px',
        width: this.marquee.w + 'px',
        height: this.marquee.h + 'px'
      }
    }
  },
  methods: {
    // CEP 合成无原生预览 API（须渲帧）；列表不显示封面
    showThumb () {
      return this.showOutPath
    },
    // 用输入路径做 key：删除中间项时其余项身份不变，FLIP 位移才正确
    itemKey (project, index) {
      var basic = project && project.basic
      if (basic && basic.inputPath) {
        return basic.inputPath + '|' + (basic.type || '')
      }
      return 'item-' + index
    },
    itemClass (project) {
      return {
        active: !!project.isSelected,
        'is-running': this.stateOf(project.process) === 'running',
        'is-no-thumb': !this.showThumb(),
        'is-fail': this.stateOf(project.process) === 'fail'
      }
    },
    canOpenFramePanel (project) {
      // CEP：合成 fps 由 AE 定，无逐帧延时面板
      if (hostAdapter && hostAdapter.supportsFrameDelay === false) return false
      if (!project || !project.basic) return false
      var files = project.basic.fileList
      // PNGs 序列 / 任意带多帧或可拆帧的任务都可打开预览面板
      return !!(files && files.length)
    },
    framePanelTitle () {
      // 两个键现在都是「播放设置」：原先 tipDelay=逐帧延时、framePanelTip=帧预览，
      // 按类型分流已无意义。保留键位只是不动 i18n 结构，实际统一取一个。
      return this.$t('framePanelTip')
    },
    // 帧数/帧率 = 时长（秒），左上角显示
    durationOf (project) {
      var fc = this.frameCount(project)
      var basic = project && project.basic
      var fps = basic && basic.type === 'Comp' && Number(basic.compFps) > 0
        ? Number(basic.compFps)
        : Number(project && project.options && project.options.frameRate)
      if (!fc || !isFinite(fps) || fps <= 0) return ''
      var sec = fc / fps
      return String(Math.round(sec * 10) / 10).replace(/\.0$/, '') + 's'
    },
    frameCount (project) {
      var list = project && project.basic && project.basic.fileList
      return list && list.length ? list.length : Number(project && project.basic && project.basic.frameCount) || 0
    },
    // 单文件动图（APNG/GIF/WEBP）用封面角标承载类型信息；序列/合成仍显示帧数
    isAnimatedSingle (project) {
      const basic = (project && project.basic) || {}
      const list = basic.fileList || []
      return list.length === 1 && String(basic.type || '').toUpperCase() !== 'PNGS' && String(basic.type || '').toUpperCase() !== 'COMP'
    },
    primaryFormatOf (project) {
      const formats = (project && project.options && project.options.outputFormat) || []
      const raw = formats.length ? formats[0] : ((project && project.basic && project.basic.type) || '')
      return String(raw || '').toUpperCase() || '—'
    },
    // ---------- 摘要项的完整说明气泡 ----------
    tipOf (labelKey, value) {
      return this.$t(labelKey) + '：' + (value || '—')
    },
    fpsTip (project) {
      var options = project && project.options
      const remap = options && options.frameRemap
      if (remap && remap.enabled) {
        var basic = project && project.basic
        var source = basic && basic.type === 'Comp' && Number(basic.compFps) > 0
          ? Number(basic.compFps)
          : Number(options.frameRate)
        return source + ' → ' + remap.targetFrameRate + ' ' + this.$t('fpsUnit')
      }
      var v = options && options.frameRate
      return v ? v + ' ' + this.$t('fpsUnit') : ''
    },
    loopTip (project) {
      var s = project && project.options && project.options.loop
      if (s === undefined || s === null || s === '') { return '' }
      // 0 次的语义要说清楚，否则行内那个 ∞ 看不懂
      return Number(s) === 0 ? this.$t('loopInfinite') : s + ' ' + this.$t('times')
    },
    sizeLimitTip (project) {
      var shown = this.sizeLimitOf(project)
      return shown || ''
    },
    /**
     * 右上角常驻角标的预估产物大小：无目标（sizeLimit 关闭）也显示，目标只是参照系。
     * 源字节走 fs.statSize（打盘/IPC），交给惰性调度器在空闲时算，命中缓存直接返回；
     * 首帧无缓存返回 null（角标暂不显示），空闲算完由 onFlush 触发重渲染。
     */
    estimateOf (project) {
      // 读一次 tick 建立模板依赖：调度器算完自增后触发本方法重估
      void this.estimateTick
      return this._lazyEstimate.get(project, project, estimateStamp(project))
    },
    /** 角标 hover：结构化富气泡（方案 B 仪表），与 compTree 共用单一构建源 */
    estimateTipOf (project) {
      const e = this.estimateOf(project)
      if (!e) return ''
      const t = (key, vars) => this.$t(key, vars)
      return { blocks: buildEstimateTipBlocks(e, t) }
    },
    /**
     * 角标当前显示的格式：默认最坏格式（决定超限），点击轮换后按 estFmtIdxMap 显示。
     * 紧凑字号 + 单字母前缀，宽度与旧版「≈254 KB」基本持平。
     */
    estDisplayOf (index) {
      const e = this.estimateOf(this.projectList[index])
      const detail = pickEstDetail(e && e.details, this.estFmtIdxMap[index])
      if (!detail) return { letter: '', text: '', over: false }
      return {
        letter: formatLetter(detail.format),
        text: humanSizeCompact(detail.bytes),
        over: !!detail.over
      }
    },
    /** 点击角标在勾选格式间轮换；仅一种格式时无动作（角标也就不可点） */
    cycleEstFormat (index) {
      const e = this.estimateOf(this.projectList[index])
      if (!e || !e.details || e.details.length < 2) return
      const n = e.details.length
      let worst = 0
      for (let i = 1; i < n; i++) {
        if (e.details[i].bytes > e.details[worst].bytes) worst = i
      }
      const cur = Number.isInteger(this.estFmtIdxMap[index]) ? this.estFmtIdxMap[index] : worst
      this.$set(this.estFmtIdxMap, index, (cur + 1) % n)
    },
    // ---------- 标题与路径 ----------
    // 主标题 = 合成名 / 输出名（禁止把 ae-comp 或 basePath(outputPath) 当名字）
    titleOf (project) {
      var b = (project && project.basic) || {}
      var o = (project && project.options) || {}
      var name = String(b.compName || o.outputName || '').trim()
      if (name) return name
      return this.baseNameOf(b.inputPath) || b.type || '—'
    },
    // 序列帧类任务（PNG 序列 / CEP 合成 / 多文件）：第一行左侧改显示胶囊标识而非文件名
    isSeqLike (project) {
      var b = (project && project.basic) || {}
      var type = String(b.type || '').toUpperCase()
      var list = b.fileList || []
      return type === 'PNGS' || type === 'COMP' || list.length > 1
    },
    // 第一行左侧文件名：单文件动图显示原文件名（含扩展名）。
    // 序列帧不再返回标识文案（改由模板的 seq-chip 胶囊渲染），合成名/输出名仍保留在整条 hover 详情气泡里。
    sourceNameOf (project) {
      var b = (project && project.basic) || {}
      var list = b.fileList || []
      var first = b.sourceFile || (list.length ? list[0] : '') || b.inputPath || ''
      return this.baseNameOf(first) || this.titleOf(project)
    },
    // 第一行右侧路径：桌面显示输入源短路径；CEP 沿用输出短路径（ae-comp 假路径不当输入展示）
    inputLabelOf (project) {
      if (!this.showOutPath) return this.pathLabelOf(project)
      var b = (project && project.basic) || {}
      var p = b.inputPath || (b.fileList && b.fileList[0]) || ''
      if (!this.isRealFsPath(p)) return this.pathLabelOf(project)
      return this.shortPathOf(p)
    },
    // 第一行路径 hover 全文：与 inputLabelOf 取值口径一致，返回未截断的输入源路径。
    // 之前这里误用「修改输出目录 + 输出路径」，与行内显示的输入路径对不上。
    inputFullPathOf (project) {
      var b = (project && project.basic) || {}
      return b.inputPath || (b.fileList && b.fileList[0]) || ''
    },
    // 同名多条时追加短路径区分（清单：多条同名可区分）
    displayTitleOf (project, index) {
      var title = this.titleOf(project)
      var same = 0
      for (var i = 0; i < this.projectList.length; i++) {
        if (this.titleOf(this.projectList[i]) === title) same++
      }
      if (same <= 1) return title
      // 同名合成：优先用工程文件夹路径区分
      var bSame = (project && project.basic) || {}
      var folder = String(bSame.folderPath || '').replace(/^\/+|\/+$/g, '')
      if (folder) return title + ' · ' + folder
      var extra = this.shortPathOf(this.outPathOf(project) ||
        ((project && project.basic && project.basic.inputPath) || ''))
      if (extra && extra !== title) return title + ' · ' + extra
      return title + ' · #' + (index + 1)
    },
    baseNameOf (p) {
      var segs = String(p || '').split(/[\\/]/).filter(Boolean)
      return segs.length ? segs[segs.length - 1] : ''
    },
    // 路径作次要信息：末两段，多条同名也可区分
    shortPathOf (p) {
      var segs = String(p || '').split(/[\\/]/).filter(Boolean)
      if (segs.length >= 2) return segs.slice(-2).join('/')
      return segs[0] || ''
    },
    // 只展示真实文件系统路径；ae-comp 假前缀 / 非绝对路径不显示
    isRealFsPath (p) {
      var s = String(p || '').trim()
      if (!s) return false
      // 任一段是 ae-comp 都视为假路径（兼容旧数据 / 大小写）
      if (/(^|[\\/])ae-comp([\\/]|$)/i.test(s)) return false
      return /^[a-zA-Z]:[\\/]/.test(s) || s.charAt(0) === '/' || s.charAt(0) === '\\'
    },
    pathLabelOf (project) {
      // CEP 只认输出目录：inputPath 是 AE 合成来源（工程目录/合成名），
      // 不是用户关心的落盘位置，回退到它会把「源」误显示成「输出」。
      var p = this.showOutPath
        ? (this.outPathOf(project) || (project.basic && project.basic.inputPath) || '')
        : this.outPathOf(project)
      if (!this.isRealFsPath(p)) return ''
      return this.shortPathOf(p)
    },
    titleTipOf (project) {
      var b = (project && project.basic) || {}
      var rows = []
      // 输入目录仅桌面显示：CEP 的输入是 AE 合成，展示它只会让人误以为
      // 「读取源目录」，而用户真正要确认的是输出落在哪、叫什么名字。
      if (this.showOutPath && b.inputPath && this.isRealFsPath(b.inputPath)) {
        rows.push({ label: this.$t('tipInputDir'), value: b.inputPath, mono: true, tone: 'cool' })
      }
      var out = this.outPathOf(project)
      if (out && this.isRealFsPath(out)) {
        rows.push({ label: this.$t('tipOutputDir'), value: out, mono: true, tone: 'accent' })
      }
      var name = this.outNameOf(project)
      if (name) rows.push({ label: this.$t('outputName'), value: name, mono: true, tone: 'ok' })
      // 标题用任务名（compName / outputName 回退），与卡片标题一致；不再因 compName 为空而丢头
      return { blocks: buildTitleTipBlocks({ name: this.titleOf(project), rows: rows }) }
    },
    // ---------- 第二/三行摘要取值 ----------
    outPathOf (project) {
      return (project && project.basic && project.basic.outputPath) || ''
    },
    outNameOf (project) {
      // 与设置面板输入框同一口径：基础名 +（开关启用且有源冲突时）冲突格式后缀。
      // 之前只读 options.outputName 基础名，导致输入框显示 cool_apng、任务条仍显示 cool。
      return displayNameOf(project)
    },
    // 变量路径：模板为空时回退为当前 mode 的语义写法，行内仍有信息量
    outTplOf (project) {
      var o = project && project.options && project.options.outputTo
      if (o && o.template && o.template.trim()) { return o.template.trim() }
      var mode = o && o.mode
      if (mode === 'beside') { return '{parent}' }
      return '{srcPath}/output'
    },
    // 大小阈值：未启用返回空，行内不显示（避免噪音）
    sizeLimitOf (project) {
      var s = project && project.options && project.options.sizeLimit
      if (!s || !s.enabled) { return '' }
      var bytes = Number(s.maxBytes)
      if (!isFinite(bytes) || bytes <= 0) {
        var mb = Number(s.maxMB)
        bytes = (isFinite(mb) && mb > 0) ? mb * 1024 * 1024 : 0
      }
      if (bytes <= 0) { return '' }
      var unit = s.unit || 'MB'
      var v = unit === 'KB' ? bytes / 1024 : bytes / (1024 * 1024)
      return (Math.round(v * 100) / 100) + unit
    },
    frameRateOf (project) {
      var options = project && project.options
      var remap = options && options.frameRemap
      var v = remap && remap.enabled ? remap.targetFrameRate : options && options.frameRate
      return v ? v : '—'
    },
    loopText (project) {
      var v = project && project.options && project.options.loop
      // 0 次代表无限循环
      if (v === undefined || v === null || v === '') return '—'
      return Number(v) === 0 ? '∞' : v + '×'
    },
    formatText (project) {
      var fmt = project && project.options && project.options.outputFormat
      if (!fmt || !fmt.length) return this.$t('noFormat')
      return fmt.join('+')
    },
    // 运行状态 / 产物路径 / 大小统一走 util/task-output：
    // 顶栏复制与合成树状态列复用同一份语义，不在组件里再写一套。
    stateOf,
    statusIcon,
    outputFilesOf,
    outputSizeBytesOf (project) { return sizeBytesOfFiles(this.outputFilesOf(project)) },
    outputSizeOf,
    // 产物大小 hover：逐文件完整路径 + 精确字节，改结构化气泡（util 的纯文本版仍保留供非 tip 场景）
    outputSizeTip (project) {
      const files = this.outputFilesOf(project) || []
      const rows = files.map((file) => {
        let n = -1
        try { const r = fs.statSize(file); n = typeof r === 'number' && r >= 0 ? r : -1 } catch (e) { /* 不可读 */ }
        return { name: file, size: n >= 0 ? n.toLocaleString() + ' B' : this.$t('unreadable') }
      })
      return { blocks: buildOutputSizeTipBlocks({ label: this.$t('outputSizeTipLabel'), files: rows }) }
    },
    /**
     * 角标 hover：格式 + 该格式总大小，逐文件列「产物名 — 大小」（重试版本也列出），
     * 末行说明点击行为。只显示 basename——要看全路径用 hover 卡片的产物大小。
     */
    badgeTipOf (badge) {
      const files = (badge && badge.files) || []
      const total = sizeTextOfFiles(files)
      const rows = files.map((file) => ({
        name: this.baseNameOf(file),
        size: sizeTextOfFiles([file]) || '—'
      }))
      return {
        blocks: buildBadgeTipBlocks({
          label: (badge && badge.format) || '',
          total: total,
          files: rows,
          copyText: this.$t('outputBadgeCopy', { format: (badge && badge.format) || '' })
        })
      }
    },
    /** 点击角标：只复制该格式（含阈值重试版本）的产物，与顶栏复制同一套接口与 toast */
    async copyFormatOutput (badge) {
      const files = (badge && badge.files) || []
      if (!files.length) return
      try {
        const copied = await hostAdapter.copyFilesToClipboard(files)
        if (copied) {
          notice.success(this.$t('outputBadgeCopied', {
            format: badge.format,
            count: files.length
          }))
        } else {
          notice.error(this.$t('copyOutputFailed'))
        }
      } catch (e) {
        // 与顶栏复制同样兜底：CEP 剪贴板桥可能同步抛错，不能让点击静默失败
        notice.error(this.$t('copyOutputFailed'), (e && e.message) || '')
      }
    },
    // 待处理且无文案时不占位，让列表安静下来
    showMeta (project) {
      var state = this.stateOf(project.process)
      return state !== 'pending' || !!(project.process && project.process.text)
    },
    thumbSrc (project, index) {
      var basic = project && project.basic
      // CEP 合成：只有一张首帧预览，无帧序列可播
      if (basic && basic.thumbPath) {
        return this.thumbFor(basic.thumbPath)
      }
      var list = basic && basic.fileList
      if (!list || !list.length) { return '' }
      // 悬停优先：指针所在行按悬停节奏走，其余行按各自的持续播放游标走
      var frame = 0
      if (this.hoverIdx === index) {
        frame = this.hoverFrame
      } else {
        var row = this.playRows[index]
        if (row) { frame = row.frame }
      }
      return this.thumbFor(list[frame % Math.min(list.length, THUMB_PLAY_MAX)])
    },
    /**
     * 该行是否值得起播放定时器。
     * CEP 合成（只有 thumbPath 单帧）不播；单帧任务播了也看不出变化。
     */
    canPlayThumb (project) {
      var basic = project && project.basic
      if (!basic || basic.thumbPath) { return false }
      var list = basic.fileList
      return !!(list && list.length > 1)
    },
    /**
     * 帧间隔（毫秒）：取 options.frameRate。
     * 之前 hover 播放写死 120ms，与导出结果的实际播放速度对不上 ——
     * 用户看到的节奏和最终产物不是一回事。
     */
    frameIntervalOf (project) {
      var raw = project && project.options && project.options.frameRate
      var fps = Number(raw)
      if (!isFinite(fps) || fps <= 0) { fps = THUMB_PLAY_FALLBACK_FPS }
      return Math.max(16, Math.round(1000 / fps))
    },
    /**
     * 启动整份列表的封面播放。
     * 一行一个定时器而不是全局一个：各行帧率可能不同，逐帧延时设置也能
     * 按行改，共用一个节拍就没法各播各的。
     */
    startThumbPlay () {
      var self = this
      this.stopThumbPlay()
      var list = this.projectList
      for (var i = 0; i < list.length; i++) {
        if (!this.canPlayThumb(list[i])) { continue }
        this.startRowPlay(i, list[i])
      }
      // 行数/帧率变化后要重启，否则新增行不会播、改过帧率的行速度不对
      this.playTick = (this.playTick || 0) + 1
      void self
    },
    startRowPlay (index, project) {
      var self = this
      var row = this.playRows[index] || { frame: 0, timer: null }
      if (row.timer) { clearInterval(row.timer) }
      row.frame = 0
      row.timer = setInterval(function () {
        var n = (project.basic.fileList || []).length
        if (!n) { return }
        row.frame = (row.frame + 1) % Math.min(n, THUMB_PLAY_MAX)
        // 改 src 触发的重渲染由 Vue 批处理；这里直接赋值即可
        void self
      }, this.frameIntervalOf(project))
      this.$set(this.playRows, index, row)
    },
    stopThumbPlay () {
      var rows = this.playRows || {}
      for (var k in rows) {
        if (Object.prototype.hasOwnProperty.call(rows, k) && rows[k] && rows[k].timer) {
          clearInterval(rows[k].timer)
        }
      }
      this.playRows = {}
    },
    startHover (index) {
      this.stopHover()
      this.hoverIdx = index
      this.hoverFrame = 0
      var project = this.projectList[index]
      var list = project && project.basic && project.basic.fileList
      if (!list || list.length < 2) { return }
      var self = this
      this.hoverTimer = setInterval(function () {
        self.hoverFrame += 1
      }, 120)
    },
    stopHover () {
      if (this.hoverTimer) {
        clearInterval(this.hoverTimer)
        this.hoverTimer = null
      }
      this.hoverIdx = -1
      this.hoverFrame = 0
    },
    // 生成降采样缩略图，避免长列表直接加载全尺寸原图导致的内存占用
    thumbFor (filePath) {
      if (!filePath) { return '' }
      var cached = this.thumbCache[filePath]
      if (cached !== undefined) { return cached }
      try {
        var api = window.ispartaAPI && window.ispartaAPI.fs
        if (api && api.readDataUrl) {
          var r = api.readDataUrl(filePath)
          if (r && r.ok && r.dataUrl) {
            this.$set(this.thumbCache, filePath, r.dataUrl)
            return r.dataUrl
          }
        }
      } catch (e) { /* fallthrough */ }
      this.$set(this.thumbCache, filePath, '')
      return ''
    },
    // 映射标签色板
    tagTone (label) {
      var toneMap = {
        PNGs: 'accent',
        APNG: 'ok',
        GIF: 'warn',
        WEBP: 'cool'
      }
      return toneMap[label] || 'plain'
    },
    processPrecent (schedule) {
      if (schedule === undefined || schedule === null || isNaN(schedule)) {
        return 0
      }
      switch (schedule) {
        case -1:
          return 100
        default:
          return schedule * 100
      }
    },
    // 显示序可能与 store 序不同（CEP 按树默认序）：用对象回查 store 下标
    storeIndexOf (project) {
      var items = this.$store.getters.getterItems || []
      for (var i = 0; i < items.length; i++) {
        if (items[i] === project) return i
      }
      return -1
    },
    // 点击条目空白处 = 单选（勾选框负责多选）
    /** 双击任务条：在 AE 中定位/打开对应合成 */
    onItemDblclick (ev, project) {
      if (ev && ev.target && ev.target.closest) {
        // 勾选/缩略图/设置等子控件有自己的双击语义
        if (ev.target.closest('.check, .thumb, .iconbtn, button, input, a')) return
      }
      var basic = (project && project.basic) || {}
      if (basic.type !== 'Comp' && basic.compIndex == null && !basic.compName) return
      try {
        var src = getSourceAdapter()
        if (src && typeof src.openSource === 'function') {
          src.openSource({ basic: basic })
        }
      } catch (e) { /* 定位失败不打断 */ }
    },
    onItemClick (index) {
      if (this.suppressBlankClick) {
        this.suppressBlankClick = false
        clearTimeout(this._suppressBlankClickTimer)
        this._suppressBlankClickTimer = null
        return
      }
      if (this.isLocked) return
      var project = this.projectList[index]
      if (!project) return
      // 已是唯一选中则不动；多选里点某条 → 只留该条（与树单勾一致）
      var selected = this.selectedList
      if (selected.length === 1 && project.isSelected) return
      var si = this.storeIndexOf(project)
      if (si >= 0) this.$store.dispatch('singleSelect', si)
    },
    // 单击列表空白处 = 取消全部选中
    onBlankClick (e) {
      if (this.suppressBlankClick) {
        this.suppressBlankClick = false
        clearTimeout(this._suppressBlankClickTimer)
        this._suppressBlankClickTimer = null
        return
      }
      if (this.isLocked || !this.projectList.length) return
      var t = e.target
      if (!t || !t.closest) return
      // 只排除真实交互控件；工具条上的空白也应能取消/全选。
      if (t.closest('.item, .open-folder, input, button, .check, .is-check')) return
      this.$store.dispatch('noneSelect')
    },
    // 双击列表空白处 = 全选（dblclick 前会有两次 click，最终状态以全选为准）
    onBlankDblclick (e) {
      if (this.isLocked || !this.projectList.length) return
      var t = e.target
      if (!t || !t.closest) return
      if (t.closest('.item, .open-folder, input, button, .check, .is-check')) return
      this.$store.dispatch('allSelect')
    },
    /**
     * 短列表时「打开目录」按钮下方的空白可能仍落在外层滚动容器上
     * （壳层样式覆盖、窗口尺寸变化都会让 min-height:100% 失效），
     * 只绑在 .mod-list 上的 @click/@dblclick 收不到那里的事件。
     * 这里在外层兜一层：组件外的空白同样走取消 / 全选；组件内的事件
     * 由自身监听处理，outOfList 判断避免重复触发。
     */
    bindHostBlankEvents () {
      var host = this.$el && this.$el.parentElement
      if (!host || host === this.$el) return
      this._blankHost = host
      var self = this
      var outOfList = function (e) {
        var t = e.target
        return !!(t && t.closest && !t.closest('.mod-list'))
      }
      this._onHostBlankClick = function (e) {
        if (outOfList(e)) self.onBlankClick(e)
      }
      this._onHostBlankDblclick = function (e) {
        if (outOfList(e)) self.onBlankDblclick(e)
      }
      host.addEventListener('click', this._onHostBlankClick)
      host.addEventListener('dblclick', this._onHostBlankDblclick)
    },
    unbindHostBlankEvents () {
      var host = this._blankHost
      if (!host) return
      if (this._onHostBlankClick) host.removeEventListener('click', this._onHostBlankClick)
      if (this._onHostBlankDblclick) host.removeEventListener('dblclick', this._onHostBlankDblclick)
      this._onHostBlankClick = null
      this._onHostBlankDblclick = null
      this._blankHost = null
    },
    // 空白处按下 → 拖拽框选
    onListMouseDown (e) {
      if (this.isLocked || !this.projectList.length) return
      if (e.button !== 0) return
      var t = e.target
      if (!t || !t.closest) return
      // 卡片文字区也可作为框选起点；保留复选框、缩略图、按钮和输入框自己的交互。
      if (t.closest('.check, .thumb, button, input, a, .open-folder, .mod-list__marquee, .is-check')) return
      // 仅在确认拖动后抑制原生选区；mousedown 阶段 preventDefault 会让部分
      // Chromium/CEP 不派发 click，导致空白单击/双击取消与全选失效。
      var rect = this.$el.getBoundingClientRect()
      this.marquee = {
        active: true,
        moved: false,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        w: 0,
        h: 0,
        startX: e.clientX,
        startY: e.clientY
      }
      this._onMarqueeMove = (ev) => this.onMarqueeMove(ev)
      this._onMarqueeUp = (ev) => this.onMarqueeUp(ev)
      window.addEventListener('mousemove', this._onMarqueeMove)
      window.addEventListener('mouseup', this._onMarqueeUp)
    },
    onMarqueeMove (e) {
      if (!this.marquee.active) return
      var host = this.$el
      var rect = host.getBoundingClientRect()
      var sx = this.marquee.startX - rect.left
      var sy = this.marquee.startY - rect.top
      var ex = e.clientX - rect.left
      var ey = e.clientY - rect.top
      if (Math.abs(e.clientX - this.marquee.startX) > 4 ||
          Math.abs(e.clientY - this.marquee.startY) > 4) {
        this.marquee.moved = true
      }
      // CSS user-select:none 提供拖动初期保护；越过阈值后再取消默认，保留 click。
      if (this.marquee.moved && e.preventDefault) e.preventDefault()
      this.marquee.x = Math.min(sx, ex)
      this.marquee.y = Math.min(sy, ey)
      this.marquee.w = Math.abs(ex - sx)
      this.marquee.h = Math.abs(ey - sy)
      if (this.marquee.moved) this.applyMarqueeSelect()
    },
    applyMarqueeSelect () {
      var host = this.$el
      var listRect = host.getBoundingClientRect()
      var boxL = this.marquee.x
      var boxT = this.marquee.y
      var boxR = boxL + this.marquee.w
      var boxB = boxT + this.marquee.h
      var indexes = []
      var nodes = host.querySelectorAll('.mod-list__inner > .item')
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i]
        var r = el.getBoundingClientRect()
        var l = r.left - listRect.left
        var t = r.top - listRect.top
        var rr = l + r.width
        var bb = t + r.height
        if (rr >= boxL && l <= boxR && bb >= boxT && t <= boxB) {
          var idx = Number(el.getAttribute('data-index'))
          // data-index 是过滤/排序后的渲染序；store 选择器使用原始任务序。
          // 必须按行对象回查，不能直接把渲染序传给 setMultiSelected。
          if (isFinite(idx) && this.projectList[idx]) {
            var storeIndex = this.storeIndexOf(this.projectList[idx])
            if (storeIndex >= 0) indexes.push(storeIndex)
          }
        }
      }
      this.$store.dispatch('setMultiSelected', indexes)
    },
    onMarqueeUp () {
      this.unbindMarquee()
      if (!this.marquee.active) return
      var moved = this.marquee.moved
      this.marquee = { active: false, moved: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 }
      if (moved) {
        this.suppressBlankClick = true
        // 只抑制框选结束后浏览器可能补发的同一轮 click；若没有 click，
        // 下一事件循环立即清除，避免吞掉后续空白/任务点击。
        clearTimeout(this._suppressBlankClickTimer)
        this._suppressBlankClickTimer = setTimeout(() => {
          this.suppressBlankClick = false
          this._suppressBlankClickTimer = null
        }, 0)
      }
    },
    unbindMarquee () {
      if (this._suppressBlankClickTimer) {
        clearTimeout(this._suppressBlankClickTimer)
        this._suppressBlankClickTimer = null
      }
      if (this._onMarqueeMove) {
        window.removeEventListener('mousemove', this._onMarqueeMove)
        this._onMarqueeMove = null
      }
      if (this._onMarqueeUp) {
        window.removeEventListener('mouseup', this._onMarqueeUp)
        this._onMarqueeUp = null
      }
    },
    sortMark (key) {
      if (this.sortKey !== key) return ''
      return this.sortDir > 0 ? ' ↑' : ' ↓'
    },
    sortBy (key) {
      if (this.sortKey === key) {
        this.sortDir = -this.sortDir
      } else {
        this.sortKey = key
        this.sortDir = 1
      }
    },
    toggleSelect (index) {
      if (this.isLocked) {
        return false
      }
      var project = this.projectList[index]
      var si = this.storeIndexOf(project)
      if (si >= 0) this.$store.dispatch('multiSelect', si)
    },
    toggleAllChecked () {
      if (this.isLocked) return
      if (this.allChecked) {
        this.$store.dispatch('noneSelect')
      } else {
        this.$store.dispatch('allSelect')
      }
    },
    itemRightClick (ev, project, index) {
      // 右键只出菜单，不改选中（避免被当成「选中合成作为任务」）
      if (ev) {
        if (ev.preventDefault) ev.preventDefault()
        if (typeof window !== 'undefined') {
          window.__ispartaCtxX = ev.clientX
          window.__ispartaCtxY = ev.clientY
        }
      }
      var locale = this.$i18n.messages[this.$i18n.locale]
      var procState = this.stateOf(project && project.process)
      var isRunning = procState === 'running'
      var basic = (project && project.basic) || {}
      // projectList 会被排序/过滤，渲染下标 ≠ store 下标；终止任务按 store 下标定位
      var storeIndex = this.$store.getters.getterItems.indexOf(project)
      rightMenu.init(
        this.$store,
        Object.assign({}, basic, { isRunning: isRunning, index: index, storeIndex: storeIndex }),
        index,
        this.isMultiItems,
        locale
      )
    },
    changeFold (outputPath, index) {
      if (this.isLocked || !this.showOutPath) {
        return false
      }
      ipc.send('change-item-fold', outputPath, index)
    },
    // 打开前后对比：仅已完成（有输出文件）的条目有意义
    openCompare (project) {
      if (this.stateOf(project.process) !== 'done') return
      this.compareProject = project
    },
    openFolder (e) {
      if (this.isLocked || !this.showOutPath) return
      // 默认点击 = 选目录（沿用旧版行为）；Ctrl/⌘ + 点击 = 选文件。
      // 与空态面板同一套交互，跨平台一致，且绕开 Win/Linux 上两属性同传静默降级的问题。
      const pickFile = !!(e && (e.ctrlKey || e.metaKey))
      ipc.invoke('dialog:openFiles', {
        properties: pickFile ? ['openFile', 'multiSelections'] : ['openDirectory'],
        filters: pickFile ? [{ name: this.$t('importImageFilter'), extensions: ['png', 'gif', 'webp'] }] : undefined
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return false }
        return this.importPaths(result.filePaths)
      }).catch((e) => {
        console.error(e)
        notice.error(this.$t('noticeOpenFailed'), e && e.message)
      })
    },
    importPaths (list) {
      if (!this.showOutPath) return Promise.resolve()
      return fsOperate.readerFiles(list).then((ars) => {
        for (var i in ars) {
          ars[i].basic.fileList.sort(naturalSort)
          this.$store.dispatch('add', {
            basic: ars[i].basic,
            options: ars[i].options
          })
        }
      })
    },
    onDelaySetting (project) {
      if (hostAdapter && hostAdapter.supportsFrameDelay === false) return
      this.delayProject = project
      this.dialogFormVisible = true
    },
    /**
     * 输出设置入口：
     * - 桌面：右栏常驻、空间充足，始终 singleSelect 只编辑本任务（历史行为，不改）
     * - CEP：覆盖层默认关闭，多选时需要能进共享设置。与 menu.js 的 stopItem / delItem
     *   同一约定 —— 只有该行未选中才 singleSelect，原本是多选时给一条提示
     * 桌面右栏由选中态驱动展示；CEP 覆盖层靠 open-task-setting（Home 监听）。
     */
    onTaskSetting (project, index) {
      if (this.isLocked) return
      var si = this.storeIndexOf(project)
      var multi = this.isCepHost && this.isMultiItems
      if (si >= 0 && !(multi && project.isSelected)) {
        this.$store.dispatch('selectOnlyAt', si)
        if (multi) notice.info(this.$t('taskSettingSingleHint'))
      }
      if (this.$root && this.$root.eventBus) {
        this.$root.eventBus.$emit('open-task-setting')
      }
    }
  }
}
</script>

<style lang="scss">
@import "./projectList.scss";
</style>
