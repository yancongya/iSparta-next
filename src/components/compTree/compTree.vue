<!--
  合成列表（CEP 特化）— 复用 PAG 列表式：表头全选/搜索 + 尺寸/帧率排序
  无展开折叠；名称与搜索框同列；末列是任务运行状态（完成态带产物大小，点击复制产物）
  列溢出省略、hover 显示全文
-->
<template>
  <section
    class="mod-ct"
    role="region"
    :aria-label="$t('compTree')"
    @click="onBlankClick"
    @dblclick="onBlankDblclick"
    @mousedown="onTreeMouseDown"
    @contextmenu.prevent
  >
    <div class="mod-ct__head">
      <span class="mod-ct__c mod-ct__c--cb">
        <span class="mod-ct__cb" @click.stop="toggleAll">
          <is-checkbox :value="allSelected" :readonly="true" />
        </span>
      </span>
      <span class="mod-ct__c mod-ct__c--name" :title="$t('compColPinnedHint')">
        <input
          v-model="keyword"
          type="search"
          class="mod-ct__search"
          :placeholder="$t('compTree') + ' / ' + $t('search')"
          spellcheck="false"
        />
        <!-- 与行内三个格式子列等宽的占位，保证表头与数据列对齐 -->
        <span class="mod-ct__fmts mod-ct__fmts--head" aria-hidden="true">
          <span v-for="f in formats" :key="f.key" class="mod-ct__fmt-slot"></span>
        </span>
      </span>
      <!-- 可配置列：顺序与宽度由 util/compTreeColumns 统一驱动，表头/行共用同一份 -->
      <div
        v-for="col in columns"
        :key="col.key"
        class="mod-ct__c mod-ct__c--h"
        :class="[
          'mod-ct__c--h--' + col.key,
          {
            'is-resizing': resizingCol === col.key,
            'is-dragging': dragCol === col.key,
            'is-drop-before': dropTarget && dropTarget.key === col.key && dropTarget.side === 'before',
            'is-drop-after': dropTarget && dropTarget.key === col.key && dropTarget.side === 'after'
          }
        ]"
        :style="colStyle(col)"
        :data-col="col.key"
        :title="$t('compColOrderHint')"
        @mousedown="onHeadMouseDown($event, col)"
      >
        <button
          v-if="col.sortKey"
          type="button"
          class="mod-ct__h-btn"
          @click="onHeadClick(col)"
        >{{ $t(col.labelKey) }}{{ sortMark(col.sortKey) }}</button>
        <span v-else class="mod-ct__h-label">
          <span class="mod-ct__state-ico" aria-hidden="true"></span>
          <span class="mod-ct__state-txt">{{ $t(col.labelKey) }}</span>
        </span>
        <!-- 右缘分隔条：拖动改列宽，双击恢复默认；stop 防止触发表头长按重排 -->
        <span
          class="mod-ct__resizer"
          :title="$t('compColResizeHint')"
          @mousedown.stop.prevent="startColumnResize($event, col)"
          @dblclick.stop.prevent="resetColumnWidth(col)"
        ></span>
      </div>
      <span class="mod-ct__c mod-ct__c--act"></span>
    </div>

    <div v-if="!rows.length" class="mod-ct__empty">
      {{ busy ? $t('compTreeLoading') : $t('compTreeEmpty') }}
    </div>
    <ul v-else class="mod-ct__list" role="listbox" multiple>
      <li
        v-for="node in rows"
        :key="node.id"
        class="mod-ct__row"
        :class="{ 'is-on': !!selectedMap[node.id] }"
        :data-id="node.id"
        draggable="true"
        @contextmenu.prevent="onRowContext($event, node)"
        @dblclick="onRowDblclick($event, node)"
        @dragstart="onRowDrag($event, node)"
      >
        <span class="mod-ct__c mod-ct__c--cb">
          <span class="mod-ct__cb" @click.stop="toggleSelect(node)">
            <is-checkbox :value="!!selectedMap[node.id]" :readonly="true" />
          </span>
        </span>
        <span class="mod-ct__c mod-ct__c--name" :title="titleOf(node)">
          <img class="mod-ct__ico" :src="compIcon" alt="" width="16" height="16" />
          <span class="mod-ct__txt">{{ displayNameOf(node) }}</span>
          <!-- 名字列右对齐的三个输出格式子列：固定宽度、不可压缩，名字先让位省略 -->
          <span class="mod-ct__fmts">
            <button
              v-for="f in formats"
              :key="f.key"
              type="button"
              class="mod-ct__fmt"
              :class="{ 'is-on': isFormatOn(node, f.key) }"
              :title="$t('compFormatToggle', { fmt: f.key })"
              :aria-pressed="isFormatOn(node, f.key) ? 'true' : 'false'"
              @click.stop="toggleFormat(node, f.key)"
            >{{ f.label }}</button>
          </span>
        </span>
        <template v-for="col in columns">
          <span
            v-if="col.key === 'size'"
            :key="col.key"
            class="mod-ct__c mod-ct__c--num"
            :style="colStyle(col)"
            :title="sizeText(node)"
          >{{ sizeText(node) }}</span>
          <span
            v-if="col.key === 'fps'"
            :key="col.key"
            class="mod-ct__c mod-ct__c--num"
            :style="colStyle(col)"
            :title="String(node.fps)"
          >{{ node.fps | fps }}</span>
          <button
            v-if="col.key === 'state'"
            :key="col.key"
            type="button"
            class="mod-ct__c mod-ct__c--state"
            :class="'is-' + stateOf(node)"
            :style="colStyle(col)"
            v-tip="stateTipOf(node)"
            :aria-label="stateTextOf(node)"
            @click.stop="onStateClick(node)"
          >
            <is-icon class="mod-ct__state-ico" :name="stateIconOf(node)" size="xs" />
            <span class="mod-ct__state-txt">{{ stateLabelOf(node) }}</span>
            <span class="mod-ct__state-size">{{ stateSizeOf(node) }}</span>
          </button>
        </template>
        <span class="mod-ct__c mod-ct__c--act">
          <button type="button" class="iconbtn" :title="$t('outputConfig')" @click.stop="$emit('configure', node)">
            <is-icon name="settings" size="sm" />
          </button>
        </span>
      </li>
    </ul>
    <div
      v-if="marquee.active && marquee.moved"
      class="mod-ct__marquee"
      :style="marqueeStyle"
      aria-hidden="true"
    ></div>
  </section>
</template>

<script>
import sourceAdapter, { normalizeCompNode } from '../../cep/comp-source'
import IsCheckbox from '../../ui-next/components/ui/IsCheckbox.vue'
import rightMenu from '../projectList/menu'
import {
  stateOf as taskStateOf, iconOfState, existingOutputFilesOf,
  sizeTextOfFiles, sizeTipOfFiles
} from '../../util/task-output'
import notice from '../../ui-next/notice'
import hostAdapter from '../../util/host-env'
import { OUTPUT_FORMATS, defaultOutputFormats } from '../../util/outputFormats'
import {
  columnOf, clampColumnWidth, loadColumnLayout, saveColumnLayout, moveColumn
} from '../../util/compTreeColumns'

/** 表头长按进入列重排的阈值（ms） */
const LONG_PRESS_MS = 320

/** 渲染后合成的三种动图格式，顺序与 store 默认 outputFormat 一致 */
const FORMATS = [
  { key: 'APNG', label: 'A' },
  { key: 'GIF', label: 'G' },
  { key: 'WEBP', label: 'W' }
]
/** mockup 模式的运行状态演示初值：完成 / 进行中 / 失败 / 待处理混排 */
const MOCK_STATES = ['done', 'running', 'done', 'pending', 'fail', 'done']
/** 完成态演示产物大小，与 MOCK_STATES 同索引；非完成态不显示 */
const MOCK_SIZES = ['1.24 MB', '', '386.5 KB', '', '', '2.10 MB']
/** mockup 模式的演示初值：混排激活/未激活，便于一眼看出两态差异 */
const MOCK_FORMATS = [
  ['APNG', 'GIF', 'WEBP'],
  ['APNG'],
  ['APNG', 'WEBP'],
  ['GIF'],
  [],
  ['APNG', 'GIF']
]

export default {
  name: 'CompTree',
  components: { IsCheckbox },
  filters: {
    fps (v) {
      const n = Number(v)
      return isFinite(n) ? String(Math.round(n * 100) / 100) : String(v)
    }
  },
  data () {
    const http = typeof location !== 'undefined' &&
      (location.protocol === 'http:' || location.protocol === 'https:')
    const layout = loadColumnLayout()
    return {
      busy: false,
      nodes: [],
      selectedMap: {},
      keyword: '',
      sortKey: '',
      sortDir: 1,
      /** 可配置列的顺序与宽度（名字+格式 / 勾选 / 齿轮是固定列，不入此表） */
      columnOrder: layout.order,
      columnWidths: layout.widths,
      resizingCol: '',
      /** 长按拖拽中的列与落点（表头与行都按 columnOrder 渲染，重排即时生效） */
      dragCol: '',
      dropTarget: null,
      marquee: { active: false, moved: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 },
      suppressBlankClick: false,
      formats: FORMATS,
      /** 未加入任务（或用户刚切换）的格式状态，键为 node.id */
      formatMap: {},
      compIcon: (http ? '/icons/' : './icons/') + 'pag-comp.png',
    }
  },
  computed: {
    /** 表头与每一行共用同一份列模型，保证顺序与宽度永远一致 */
    columns () {
      return this.columnOrder.map(columnOf).filter(Boolean)
    },
    marqueeStyle () {
      return {
        left: this.marquee.x + 'px',
        top: this.marquee.y + 'px',
        width: this.marquee.w + 'px',
        height: this.marquee.h + 'px'
      }
    },
    rows () {
      const kw = String(this.keyword || '').toLowerCase()
      let list = this.nodes.filter(function (n) {
        return !kw || String(n.name || '').toLowerCase().indexOf(kw) >= 0
      })
      const k = this.sortKey
      if (k) {
        const dir = this.sortDir
        list = list.slice().sort(function (a, b) {
          const av = k === 'width' ? (a.width * a.height) : Number(a[k]) || 0
          const bv = k === 'width' ? (b.width * b.height) : Number(b[k]) || 0
          return (av - bv) * dir
        })
      } else {
        // 默认可排序态：index → 名称（与任务列表 projectList 同一比较器）
        list = list.slice().sort(function (a, b) {
          const ia = Number(a.index) || 0
          const ib = Number(b.index) || 0
          if (ia !== ib) return ia - ib
          return String(a.name || '').localeCompare(String(b.name || ''))
        })
      }
      return list
    },
    allSelected () {
      const rows = this.rows
      return rows.length > 0 && rows.every((n) => this.selectedMap[n.id])
    },
    selectedNodes () {
      return this.nodes.filter((n) => this.selectedMap[n.id])
    },
    /** store 里 Comp 任务的 isSelected → '{index}:{name}' 集合（禁止只用 index，可能全为 0） */
    storeSelectedByIndex () {
      const map = {}
      const items = this.storeItems()
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it || !it.basic || it.basic.type !== 'Comp' || !it.isSelected) continue
        const key = Number(it.basic.compIndex) + ':' + String(it.basic.compName || '')
        map[key] = true
      }
      return map
    },
    /** 任一 Comp 的勾选/增减都变；驱动树勾选镜像 store */
    storeSelectSignature () {
      const items = this.storeItems()
      let sig = ''
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const b = it && it.basic
        if (!b || b.type !== 'Comp') continue
        sig += Number(b.compIndex) + ':' + String(b.compName || '') + (it.isSelected ? '+;' : '-;')
      }
      return sig
    }
  },
  watch: {
    storeSelectSignature () {
      this.pullSelectionFromStore()
    }
  },
  created () {
    this.refresh()
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.cancelHeadPress)
    }
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$on('comp-tree-refresh', this.refresh)
      this.$root.eventBus.$on('comp-tree-add-selected', this.emitAdd)
      this.$root.eventBus.$on('comp-tree-select-all', this.selectAll)
      this.$root.eventBus.$on('comp-tree-clear', this.clearSelection)
      this.$root.eventBus.$on('default-formats-changed', this.onDefaultFormatsChanged)
    }
  },
  beforeDestroy () {
    this.unbindMarquee()
    this.stopColumnResize()
    this.cancelHeadPress()
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.cancelHeadPress)
    }
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$off('comp-tree-refresh', this.refresh)
      this.$root.eventBus.$off('comp-tree-add-selected', this.emitAdd)
      this.$root.eventBus.$off('comp-tree-select-all', this.selectAll)
      this.$root.eventBus.$off('comp-tree-clear', this.clearSelection)
      this.$root.eventBus.$off('default-formats-changed', this.onDefaultFormatsChanged)
    }
  },
  methods: {
    /** 默认设置保存后，未加入任务的合成格式图标初值跟着新默认刷新 */
    onDefaultFormatsChanged () {
      this.$forceUpdate()
    },
    storeItems () {
      try {
        return (this.$store && this.$store.getters && this.$store.getters.getterItems) || []
      } catch (e) {
        return []
      }
    },
    /**
     * 合成节点 ↔ store 任务的匹配键。
     * 只用 index 不行：AE 里多个合成的 index 可能同为 0，必须带名字（与勾选镜像同一约定）。
     */
    compTaskKey (node) {
      return Number(node && node.index) + ':' + String((node && node.name) || '')
    },
    /** 该合成在 store 里的任务下标；尚未加入任务返回 -1（列表顺序即任务下标） */
    taskIndexOf (node) {
      if (!node) { return -1 }
      const key = this.compTaskKey(node)
      const items = this.storeItems()
      for (let i = 0; i < items.length; i++) {
        const b = items[i] && items[i].basic
        if (!b || b.type !== 'Comp') { continue }
        if (Number(b.compIndex) + ':' + String(b.compName || '') === key) { return i }
      }
      return -1
    },
    /**
     * 该行是否可「终止任务」：与任务列表同判据（schedule ∈ (0,1) 即进行中）。
     * 批处理锁定中且该任务已选中时也放行 —— 终止是整批 cancelAll，
     * 与任务列表右键选中行的语义一致。
     */
    taskStoppable (node) {
      const i = this.taskIndexOf(node)
      if (i < 0) { return false }
      const it = this.storeItems()[i]
      const s = it && it.process && it.process.schedule
      if (typeof s === 'number' && s > 0 && s < 1) { return true }
      try {
        return !!(this.$store.getters.getterLocked && it && it.isSelected)
      } catch (e) {
        return false
      }
    },
    /** store 已有 Comp 任务时，勾选以 isSelected 为准；空态树仍是「待添加」本地选择 */
    storeHasCompTasks () {
      const items = this.storeItems()
      for (let i = 0; i < items.length; i++) {
        const b = items[i] && items[i].basic
        if (b && b.type === 'Comp') return true
      }
      return false
    },
    pullSelectionFromStore () {
      if (!this.storeHasCompTasks()) return
      const set = this.storeSelectedByIndex
      const next = {}
      this.nodes.forEach((n) => {
        const key = Number(n.index) + ':' + String(n.name || '')
        if (set[key]) next[n.id] = true
      })
      const prev = this.selectedMap || {}
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      if (prevKeys.length === nextKeys.length && nextKeys.every((k) => !!prev[k] === !!next[k])) {
        return
      }
      this.selectedMap = next
    },
    emitSelection () {
      this.$emit('select', this.selectedNodes)
    },
    selectAll () {
      const next = {}
      this.rows.forEach((n) => { next[n.id] = true })
      this.selectedMap = next
      this.emitSelection()
    },
    clearSelection () {
      this.selectedMap = {}
      this.emitSelection()
    },
    onBlankClick (ev) {
      if (this.suppressBlankClick) {
        this.suppressBlankClick = false
        return
      }
      if (ev.target && ev.target.closest && ev.target.closest('.mod-ct__head, .mod-ct__row, input, button, .mod-ct__cb')) return
      // 点击空白 = 取消选择（对齐桌面）
      this.clearSelection()
    },
    onBlankDblclick (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.mod-ct__head, .mod-ct__row, input, button, .mod-ct__cb')) return
      // 双击空白 = 全选（对齐桌面）
      this.selectAll()
    },
    onTreeMouseDown (e) {
      if (e.button !== 0 || !this.rows.length) return
      const t = e.target
      if (!t || !t.closest || t.closest('.mod-ct__head, .mod-ct__row, input, button, .mod-ct__cb, .mod-ct__marquee')) return
      e.preventDefault()
      const rect = this.$el.getBoundingClientRect()
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
      this._onMarqueeUp = () => this.onMarqueeUp()
      window.addEventListener('mousemove', this._onMarqueeMove)
      window.addEventListener('mouseup', this._onMarqueeUp)
    },
    onMarqueeMove (e) {
      if (!this.marquee.active) return
      if (e.preventDefault) e.preventDefault()
      const rect = this.$el.getBoundingClientRect()
      const sx = this.marquee.startX - rect.left
      const sy = this.marquee.startY - rect.top
      const ex = e.clientX - rect.left
      const ey = e.clientY - rect.top
      if (Math.abs(e.clientX - this.marquee.startX) > 4 || Math.abs(e.clientY - this.marquee.startY) > 4) {
        this.marquee.moved = true
      }
      this.marquee.x = Math.min(sx, ex)
      this.marquee.y = Math.min(sy, ey)
      this.marquee.w = Math.abs(ex - sx)
      this.marquee.h = Math.abs(ey - sy)
      if (!this.marquee.moved) return

      const boxL = this.marquee.x
      const boxT = this.marquee.y
      const boxR = boxL + this.marquee.w
      const boxB = boxT + this.marquee.h
      const hostRect = this.$el.getBoundingClientRect()
      const next = {}
      const rows = this.$el.querySelectorAll('.mod-ct__row')
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect()
        const l = r.left - hostRect.left
        const top = r.top - hostRect.top
        if (l + r.width >= boxL && l <= boxR && top + r.height >= boxT && top <= boxB) {
          const id = rows[i].getAttribute('data-id')
          if (id) next[id] = true
        }
      }
      this.selectedMap = next
      this.emitSelection()
    },
    onMarqueeUp () {
      const moved = this.marquee.moved
      this.unbindMarquee()
      this.marquee = { active: false, moved: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 }
      if (moved) this.suppressBlankClick = true
    },
    unbindMarquee () {
      if (this._onMarqueeMove) {
        window.removeEventListener('mousemove', this._onMarqueeMove)
        this._onMarqueeMove = null
      }
      if (this._onMarqueeUp) {
        window.removeEventListener('mouseup', this._onMarqueeUp)
        this._onMarqueeUp = null
      }
    },
    /** 该合成对应的 store 任务；未加入任务返回 null */
    taskOf (node) {
      const i = this.taskIndexOf(node)
      return i >= 0 ? this.storeItems()[i] : null
    },
    /**
     * 运行状态：真实面板一律读 store 任务的 process.schedule（与任务列表同一判据），
     * 未加入任务即待处理；仅 dev mockup 给确定性演示态，便于脱离 AE 看四种状态。
     */
    stateOf (node) {
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        const at = Math.abs(Number(node && node.index) || 0) % MOCK_STATES.length
        return MOCK_STATES[at]
      }
      const task = this.taskOf(node)
      return task ? taskStateOf(task.process) : 'pending'
    },
    stateIconOf (node) {
      return iconOfState(this.stateOf(node))
    },
    stateSizeOf (node) {
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        const at = Math.abs(Number(node && node.index) || 0) % MOCK_SIZES.length
        return MOCK_SIZES[at]
      }
      const task = this.taskOf(node)
      return task ? sizeTextOfFiles(existingOutputFilesOf(task)) : ''
    },
    /** 状态文案（不含产物大小）：列内文本与 hover 标题共用这一份 */
    stateLabelOf (node) {
      const s = this.stateOf(node)
      if (s === 'done') return this.$t('statDone')
      if (s === 'fail') return this.$t('statFail')
      if (s === 'running') return this.$t('statRunning')
      return this.$t('compStatePending')
    },
    /** 列内短文本：状态 + 完成态产物大小；过长由 CSS 省略，hover 看完整信息 */
    stateTextOf (node) {
      const label = this.stateLabelOf(node)
      if (this.stateOf(node) !== 'done') return label
      const size = this.stateSizeOf(node)
      return size ? label + ' · ' + size : label
    },
    /** hover 完整信息：不省略的状态 + 进度文案 + 逐文件产物路径与精确字节数 + 复制提示 */
    stateTipOf (node) {
      const lines = [this.stateTextOf(node)]
      const task = this.taskOf(node)
      if (task && task.process && task.process.text) lines.push(String(task.process.text))
      if (this.stateOf(node) === 'done') {
        if (typeof window !== 'undefined' && window.__ispartaMockup) {
          lines.push('/mock/output/' + String((node && node.name) || 'comp') + ' — ' + this.stateSizeOf(node))
        } else {
          const tip = task ? sizeTipOfFiles(existingOutputFilesOf(task)) : ''
          if (tip) lines.push(tip)
        }
      }
      lines.push(this.$t('compStateCopy'))
      return lines.join('\n')
    },
    /** 点击状态列复制产物：复用顶栏同一套宿主桥与通知文案 */
    async onStateClick (node) {
      if (this.stateOf(node) !== 'done') {
        notice.info(this.$t('compStateNoOutput'))
        return
      }
      // dev mockup 没有真实产物文件，只回放成功反馈以验证交互与文案
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        notice.success(this.$t('copyOutputSuccess', { count: 1 }))
        return
      }
      const task = this.taskOf(node)
      const files = task ? existingOutputFilesOf(task) : []
      if (!files.length) {
        notice.warning(this.$t('copyOutputFailed'), this.$t('noCompletedOutputFiles'))
        return
      }
      let copied = false
      try {
        copied = await hostAdapter.copyFilesToClipboard(files)
      } catch (e) { copied = false }
      if (copied) notice.success(this.$t('copyOutputSuccess', { count: files.length }))
      else notice.error(this.$t('copyOutputFailed'))
    },
    sizeText (n) {
      return (n.width || 0) + '×' + (n.height || 0)
    },
    /** 同名才追加工程文件夹路径（与任务列表 displayTitleOf 同一策略） */
    displayNameOf (node) {
      var name = String((node && node.name) || '')
      var same = 0
      var list = this.rows
      for (var i = 0; i < list.length; i++) {
        if (String(list[i].name || '') === name) same++
      }
      if (same <= 1) return name
      var folder = String((node && node.folderPath) || '').replace(/^\/+|\/+$/g, '')
      if (folder) return name + ' · ' + folder
      return name + ' · #' + (Number(node && node.index) + 1)
    },
    /** tooltip 始终给全信息：名称 / 文件夹 / index */
    titleOf (node) {
      var lines = [String((node && node.name) || '')]
      var folder = String((node && node.folderPath) || '').replace(/^\/+|\/+$/g, '')
      if (folder) lines.push(folder)
      lines.push('#' + (Number(node && node.index) + 1))
      return lines.join('\n')
    },
    /** 列宽 inline style：width 与 flex-basis 同步，表头和行取同一个值 */
    colStyle (col) {
      const w = clampColumnWidth(col.key, this.columnWidths[col.key])
      return { width: w + 'px', flex: '0 1 ' + w + 'px', minWidth: col.min + 'px' }
    },
    /** 表头点击仍走原有的数据排序；长按重排时抑制这次 click */
    onHeadClick (col) {
      if (this._suppressHeadClick) return
      if (col && col.sortKey) this.sortBy(col.sortKey)
    },
    /**
     * 表头右缘拖宽：与 Home.vue 面板分隔条同一范式（document 监听 + body class），
     * 拖动只改内存宽度，松手才持久化，避免每帧写 storage。
     */
    startColumnResize (e, col) {
      if (e.button !== 0) return
      const startX = e.clientX
      const startW = clampColumnWidth(col.key, this.columnWidths[col.key])
      this.resizingCol = col.key
      document.body.classList.add('is-column-resizing')
      const onMove = (ev) => {
        this.$set(this.columnWidths, col.key, clampColumnWidth(col.key, startW + ev.clientX - startX))
      }
      this._colResizeCleanup = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', this.stopColumnResize)
        document.body.classList.remove('is-column-resizing')
        this.resizingCol = ''
        saveColumnLayout({ order: this.columnOrder, widths: this.columnWidths })
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', this.stopColumnResize)
    },
    stopColumnResize () {
      const cleanup = this._colResizeCleanup
      this._colResizeCleanup = null
      if (cleanup) cleanup()
    },
    /** 双击分隔条：恢复该列出厂宽度 */
    resetColumnWidth (col) {
      const def = columnOf(col.key)
      if (!def) return
      this.$set(this.columnWidths, col.key, def.width)
      saveColumnLayout({ order: this.columnOrder, widths: this.columnWidths })
    },
    /** 表头长按 ~320ms 进入列重排；短点击仍由 onHeadClick 走数据排序 */
    onHeadMouseDown (e, col) {
      if (e.button !== 0 || this._headPress) return
      const press = { col: col, x: e.clientX, y: e.clientY, active: false, moved: false, timer: null }
      press.timer = window.setTimeout(() => {
        press.active = true
        this.dragCol = col.key
        document.body.classList.add('is-ct-col-dragging')
      }, LONG_PRESS_MS)
      this._headPress = press
      window.addEventListener('mousemove', this.onHeadMouseMove)
      window.addEventListener('mouseup', this.onHeadMouseUp)
    },
    onHeadMouseMove (e) {
      const p = this._headPress
      if (!p) return
      const dx = Math.abs(e.clientX - p.x)
      const dy = Math.abs(e.clientY - p.y)
      if (!p.active) {
        // 未到长按阈值就移动：普通拖动，取消长按，避免与列宽手柄/框选抢事件
        if (dx > 4 || dy > 4) this.cancelHeadPress()
        return
      }
      if (dx > 4 || dy > 4) p.moved = true
      if (e.preventDefault) e.preventDefault()
      this.dropTarget = this.findDropTarget(e.clientX)
    },
    onHeadMouseUp () {
      const p = this._headPress
      if (!p) return
      const reorder = !!(p.active && p.moved)
      const from = p.col.key
      const target = this.dropTarget
      if (reorder) {
        // mouseup 之后浏览器补发 click；抑制掉，别把一次重排变成数据排序
        this._suppressHeadClick = true
        window.setTimeout(() => { this._suppressHeadClick = false }, 0)
      }
      this.cancelHeadPress()
      if (reorder && target && target.key !== from) {
        this.columnOrder = moveColumn(this.columnOrder, from, target.key, target.side)
        saveColumnLayout({ order: this.columnOrder, widths: this.columnWidths })
      }
    },
    cancelHeadPress () {
      const p = this._headPress
      this._headPress = null
      if (p && p.timer) window.clearTimeout(p.timer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('mousemove', this.onHeadMouseMove)
        window.removeEventListener('mouseup', this.onHeadMouseUp)
      }
      this.dragCol = ''
      this.dropTarget = null
      if (typeof document !== 'undefined') document.body.classList.remove('is-ct-col-dragging')
    },
    /** 光标所在可配置列：左半边插到前面、右半边插到后面；名字列区域归到首列前 */
    findDropTarget (clientX) {
      const heads = this.$el.querySelectorAll('.mod-ct__c--h[data-col]')
      if (!heads.length) return null
      for (let i = 0; i < heads.length; i++) {
        const r = heads[i].getBoundingClientRect()
        if (clientX <= r.right) {
          return {
            key: heads[i].getAttribute('data-col'),
            side: clientX < r.left + r.width / 2 ? 'before' : 'after'
          }
        }
      }
      return { key: heads[heads.length - 1].getAttribute('data-col'), side: 'after' }
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
    refresh (refreshedList) {
      if (this.busy) {
        this._refreshPending = Array.isArray(refreshedList) ? refreshedList : true
        return
      }
      this.busy = true
      const prev = this.selectedNodes.map((n) => ({ name: n.name, index: n.index }))
      const listPromise = Array.isArray(refreshedList)
        ? Promise.resolve(refreshedList)
        : sourceAdapter.list()
      listPromise
        .then((list) => {
          this.nodes = (list || []).map(normalizeCompNode)
          if (this.storeHasCompTasks()) {
            // 任务列表模式：勾选跟 store.isSelected（列表勾选/全选/框选写入的同一真相）
            this.pullSelectionFromStore()
          } else {
            // 空态树：本地勾选按 name+index 迁移（尚未写入 store）
            const next = {}
            this.nodes.forEach((n) => {
              const hit = prev.some((p) => p.index === n.index && p.name === n.name)
              if (hit) { next[n.id] = true }
            })
            this.selectedMap = next
          }
          this.$emit('loaded', this.nodes.length)
        })
        .catch((e) => {
          this.$emit('error', e)
          try {
            var noticeMod = require('../../ui-next/notice')
            var n = noticeMod.default || noticeMod
            if (n && n.warning) {
              n.warning('合成列表刷新失败: ' + ((e && e.message) || e))
            }
          } catch (e2) { /* ignore */ }
        })
        .then(() => {
          this.busy = false
          if (this._refreshPending) {
            const pending = this._refreshPending
            this._refreshPending = null
            this.refresh(Array.isArray(pending) ? pending : undefined)
          }
        })
    },
    toggleAll () {
      const rows = this.rows
      const next = Object.assign({}, this.selectedMap)
      const on = !this.allSelected
      rows.forEach((n) => { next[n.id] = on })
      this.selectedMap = next
      this.emitSelection()
    },
    toggleSelect (node) {
      this.$set(this.selectedMap, node.id, !this.selectedMap[node.id])
      this.emitSelection()
    },
    /**
     * 该合成渲染后要输出的动图格式。
     * 优先级：树内切换过的本地状态 > 已加入任务的 options.outputFormat > 全局默认勾选。
     * 默认值走 util/outputFormats 的同一份 globalSetting 接口，与默认设置面板联动。
     * 与右键菜单共用 taskIndexOf 的「index:name」匹配键，不另写一套判定。
     */
    formatsOf (node) {
      if (!node) { return defaultOutputFormats() }
      const local = this.formatMap[node.id]
      if (local) { return local }
      // mockup 模式给一组确定性演示初值（含全关/单选/多选），真实面板不走这里
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        return MOCK_FORMATS[Math.abs(Number(node.index) || 0) % MOCK_FORMATS.length]
      }
      const i = this.taskIndexOf(node)
      if (i >= 0) {
        const it = this.storeItems()[i]
        const fmt = it && it.options && it.options.outputFormat
        if (Array.isArray(fmt)) { return fmt }
      }
      return defaultOutputFormats()
    },
    isFormatOn (node, key) {
      return this.formatsOf(node).indexOf(key) >= 0
    },
    /** 点击小图标切换该格式的激活态；已加入任务时同步写回 store */
    toggleFormat (node, key) {
      try {
        if (this.$store && this.$store.getters && this.$store.getters.getterLocked) { return }
      } catch (e) { /* 无 store 时只维护本地状态 */ }
      const cur = this.formatsOf(node).slice()
      const at = cur.indexOf(key)
      if (at >= 0) { cur.splice(at, 1) } else { cur.push(key) }
      // 固定 APNG → GIF → WEBP 顺序，不按点击先后乱排
      const next = OUTPUT_FORMATS.filter(function (k) { return cur.indexOf(k) >= 0 })
      this.$set(this.formatMap, node.id, next)
      const i = this.taskIndexOf(node)
      if (i >= 0 && this.$store && this.$store.dispatch) {
        this.$store.dispatch('editOptionsAt', { index: i, patch: { outputFormat: next.slice() } })
      }
      this.$emit('format-change', { node: node, formats: next.slice() })
    },
    emitAdd () {
      const nodes = this.selectedNodes
      const items = sourceAdapter.toItems(nodes)
      // 树里切换过的格式要带进任务，避免加入后被全局默认覆盖
      for (let i = 0; i < items.length; i++) {
        if (!items[i].options) { items[i].options = {} }
        items[i].options.outputFormat = this.formatsOf(nodes[i]).slice()
      }
      this.$emit('add', items)
    },
    /** 双击合成行：在 AE 中定位/打开该合成 */
    onRowDblclick (ev, node) {
      if (ev && ev.target && ev.target.closest) {
        if (ev.target.closest('.mod-ct__cb, .iconbtn, button, input, a')) return
      }
      try {
        sourceAdapter.openSource({
          basic: {
            type: 'Comp',
            compIndex: node.index,
            compName: node.name
          }
        })
      } catch (e) { /* 定位失败不打断 */ }
    },
    onRowContext (ev, node) {
      if (ev && ev.preventDefault) ev.preventDefault()
      if (typeof window !== 'undefined') {
        window.__ispartaCtxX = ev && ev.clientX
        window.__ispartaCtxY = ev && ev.clientY
      }
      var locale = this.$i18n && this.$i18n.messages && this.$i18n.messages[this.$i18n.locale]
      // 该合成若已加入任务，就带上它的真实下标与运行态：
      // 否则「终止任务」永远不出现（原先写死 false / -1），长转换在合成树视图下无法中止
      var taskIndex = this.taskIndexOf(node)
      // 右键「打开输出目录」必须拿到与任务列表相同的解析结果；未加入任务时
      // 通过共享 sourceAdapter 构造临时任务，沿用当前默认 outputTo，不猜工程目录。
      var task = taskIndex >= 0 ? this.storeItems()[taskIndex] : null
      var outputPath = task && task.basic && task.basic.outputPath
      if (!outputPath && sourceAdapter && typeof sourceAdapter.createItem === 'function') {
        var previewItem = sourceAdapter.createItem(node)
        outputPath = previewItem && previewItem.basic && previewItem.basic.outputPath
      }
      rightMenu.init(
        this.$store,
        {
          type: 'Comp',
          compIndex: node.index,
          compName: node.name,
          projectPath: node.projectPath,
          inputPath: node.projectPath,
          outputPath: outputPath,
          isRunning: this.taskStoppable(node),
          index: taskIndex,
          storeIndex: taskIndex
        },
        taskIndex,
        false,
        locale
      )
    },
    onRowDrag (ev, node) {
      if (!ev.dataTransfer) return
      ev.dataTransfer.setData(sourceAdapter.COMP_MIME, JSON.stringify({ index: node.index, name: node.name }))
      ev.dataTransfer.setData('text/plain', node.name)
      ev.dataTransfer.effectAllowed = 'copy'
    }
  }
}
</script>

<style lang="scss" scoped>
.mod-ct {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  font-size: 12px;
  user-select: none;
  -webkit-user-select: none;
}
.mod-ct__head,
.mod-ct__row {
  display: flex;
  align-items: center;
  min-height: 28px;
  padding: 0 2px 0 4px;
  gap: 0;
  overflow: hidden;
}
.mod-ct__head {
  position: sticky;
  top: 0;
  z-index: 2;
  border-bottom: 1px solid var(--is-line, rgba(128, 128, 128, 0.25));
  background: var(--is-bg, #0c0f0e);
  font-weight: 600;
  opacity: 0.85;
}
.mod-ct__row:hover {
  background: rgba(128, 128, 128, 0.1);
}
.mod-ct__row.is-on {
  background: var(--is-accent-soft, rgba(200, 245, 66, 0.15));
}
.mod-ct__c {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mod-ct__c--cb {
  width: 28px;
  flex: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mod-ct__c--name {
  /* 必须 1 1 0：auto 基准会让长名撑破行，ellipsis 失效 */
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 8px;
}
.mod-ct__c--num {
  padding-right: 8px;
  text-align: right;
}
/* 表头可配置列：宽度由 colStyle 注入，表头与行共用；右缘留给列宽分隔条 */
.mod-ct__c--h {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-weight: 600;
}
.mod-ct__c--h--state { justify-content: flex-start; }
.mod-ct__h-btn {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: inherit;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
}
.mod-ct__h-btn:hover {
  opacity: 0.8;
  text-decoration: underline;
}
.mod-ct__h-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  cursor: default;
}
/* 列宽分隔条：默认隐形，hover / 拖拽中显示品牌色竖线 */
.mod-ct__resizer {
  position: absolute;
  z-index: 3;
  top: 0;
  right: 0;
  bottom: 0;
  width: 7px;
  cursor: col-resize;
}
.mod-ct__resizer::after {
  content: '';
  position: absolute;
  top: 4px;
  bottom: 4px;
  right: 2px;
  width: 2px;
  border-radius: 1px;
  background: var(--is-accent, #c8f542);
  opacity: 0;
}
.mod-ct__c--h:hover .mod-ct__resizer::after,
.mod-ct__c--h.is-resizing .mod-ct__resizer::after {
  opacity: 0.75;
}
/* 长按重排：源列淡化，落点列显示插入竖线 */
.mod-ct__c--h.is-dragging { opacity: 0.45; }
.mod-ct__c--h.is-drop-before::before,
.mod-ct__c--h.is-drop-after::after {
  content: '';
  position: absolute;
  z-index: 4;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--is-accent, #c8f542);
}
.mod-ct__c--h.is-drop-before::before { left: 0; }
.mod-ct__c--h.is-drop-after::after { right: 0; }
/* 运行状态列（替代原帧数列）：完成态显示产物大小，整格可点击复制
 * 三段固定对齐：图标定宽靠左、状态文本左对齐、产物大小贴右并 tabular-nums，
 * 保证每行图标/文案/尺寸三个起点都是一条竖线（原先是整串右对齐，图标随文字宽度浮动）。 */
.mod-ct__c--state {
  padding-right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  text-align: left;
  background: transparent;
  border: 0;
  color: var(--is-text-2, #8a8f8c);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.mod-ct__state-ico {
  flex: 0 0 12px;
  width: 12px;
  height: 12px;
  display: block;
}
.mod-ct__c--state > :first-child { flex: 0 0 auto; }
.mod-ct__c--state:hover {
  color: var(--is-accent, #c8f542);
}
.mod-ct__c--state:focus-visible {
  outline: 1px solid var(--is-accent, #c8f542);
  outline-offset: -2px;
}
.mod-ct__c--state.is-done { color: var(--is-ok, #3ddc97); }
.mod-ct__c--state.is-running { color: var(--is-warn, #ffc857); }
.mod-ct__c--state.is-fail { color: var(--is-bad, #ff5c5c); }
.mod-ct__state-txt {
  flex: 0 0 auto;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* 产物大小贴右：与只读数字列同一套等宽数字，行行对齐 */
.mod-ct__state-size {
  flex: 0 1 auto;
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  opacity: 0.85;
}
.mod-ct__txt {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mod-ct__ico {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  display: block;
}
/* 名字列右侧的三个输出格式子列：固定宽度、右对齐、名字再长也不挤占 */
.mod-ct__fmts {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding-left: 6px;
}
.mod-ct__fmt,
.mod-ct__fmt-slot {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
.mod-ct__fmt-slot {
  display: block;
}
.mod-ct__fmt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--is-line, rgba(128, 128, 128, 0.35));
  background: transparent;
  color: var(--is-text-2, #8a8f8c);
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  opacity: 0.42;
  cursor: pointer;
  user-select: none;
}
.mod-ct__fmt:hover {
  opacity: 0.85;
  border-color: var(--is-border-hi, rgba(128, 128, 128, 0.6));
}
.mod-ct__fmt:focus-visible {
  outline: 1px solid var(--is-accent, #c8f542);
  outline-offset: 1px;
}
.mod-ct__fmt.is-on {
  opacity: 1;
  border-color: var(--is-accent, #c8f542);
  background: var(--is-accent-soft, rgba(200, 245, 66, 0.15));
  color: var(--is-accent, #c8f542);
}
/* 操作列固定不压缩，overflow:visible 防止齿轮被行裁掉 */
.mod-ct__c--act {
  width: 32px;
  flex: 0 0 32px;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}
/* 与 projectList / ib-iconbtn 同一套设置钮 */
.iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--is-border);
  border-radius: var(--is-r-xs, 6px);
  background: var(--is-card);
  color: var(--is-text-2);
  cursor: pointer;
}
.iconbtn:hover {
  border-color: var(--is-border-hi);
  background: var(--is-accent-soft, var(--is-accent-dim));
  color: var(--is-accent);
}
.mod-ct__search {
  /* 表头右侧也有等宽的格式占位，搜索框必须可收缩 */
  flex: 1 1 0;
  width: auto;
  min-width: 0;
  height: 22px;
  border: 1px solid var(--is-line, rgba(128, 128, 128, 0.35));
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.15);
  color: inherit;
  padding: 0 8px;
  font: inherit;
  outline: none;
  user-select: text;
  -webkit-user-select: text;
}
.mod-ct__cb {
  display: inline-flex;
  cursor: pointer;
}
.mod-ct__marquee {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  border: 1px solid var(--is-accent, #c8f542);
  background: rgba(var(--is-accent-rgb, 200, 245, 66), 0.16);
}
.mod-ct__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: auto;
  flex: 1;
  min-height: 0;
}
.mod-ct__empty {
  padding: 16px;
  text-align: center;
  opacity: 0.55;
}
</style>
