<!--
  合成列表（CEP 特化）— 复用 PAG 列表式：表头全选/搜索 + 尺寸/帧率排序
  无展开折叠；名称与搜索框同列；末列是任务运行状态：列内只显示最新一条
  （失败/中止给原因、进行中给进度），完成态直接留给产物大小；hover 看全文，点击复制产物
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
      <!-- 名字 + 输出格式：一只撑满整列的搜索框，宽度永远自适应剩余空间（不可拖） -->
      <span
        class="mod-ct__c mod-ct__c--name mod-ct__c--name-h"
        :title="$t('compColPinnedHint')"
      >
        <input
          v-model="keyword"
          type="search"
          class="mod-ct__search"
          :placeholder="$t('compTree') + ' / ' + $t('search')"
          spellcheck="false"
        />
      </span>
      <!-- 可配置列：顺序与宽度由 util/compTreeColumns 统一驱动，表头/行共用同一份。
           表头只做两件事：点击排序、拖右缘改宽；列顺序走右键菜单 -->
      <div
        v-for="col in columns"
        :key="col.key"
        class="mod-ct__c mod-ct__c--h"
        :class="[
          'mod-ct__c--h--' + col.key,
          {
            'is-resizing': resizingCol === col.key,
            'is-at-limit': resizingCol === col.key && !!colLimit
          }
        ]"
        :style="colStyle(col)"
        :data-col="col.key"
        :title="$t('compColResizeHint')"
        @contextmenu.prevent.stop="onHeadContext($event, col)"
      >
        <button
          v-if="col.sortKey"
          type="button"
          class="mod-ct__h-btn"
          @click="onHeadClick(col)"
        >{{ $t(col.labelKey) }}{{ sortMark(col.sortKey) }}</button>
        <span v-else class="mod-ct__h-label">
          <span class="mod-ct__state-txt">{{ $t(col.labelKey) }}</span>
        </span>
        <!-- 右缘把手：只负责拖动改列宽 -->
        <span
          class="mod-ct__resizer"
          @mousedown.stop.prevent="startColumnResize($event, col)"
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
          <!-- 名字列右对齐的三个输出格式子列：固定宽度、不可压缩，名字先让位省略；
               与名字同属表头搜索栏那一列，不单独成列 -->
          <span class="mod-ct__fmts" :title="$t('compColFormatHint')">
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
            :aria-label="stateAriaOf(node)"
            @click.stop="onStateClick(node)"
          >
            <is-icon class="mod-ct__state-ico" :name="stateIconOf(node)" size="xs" />
            <span v-if="stateLabelOf(node)" class="mod-ct__state-txt">{{ stateLabelOf(node) }}</span>
            <span v-if="stateSizeOf(node)" class="mod-ct__state-size">{{ stateSizeOf(node) }}</span>
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
    <!-- 表头右键：列顺序与恢复默认宽度。拖拽只留给「改宽度」一件事 -->
    <div
      v-if="headMenu.open"
      class="mod-ct__menu"
      :style="headMenuStyle"
      role="menu"
      @mousedown.stop
      @click.stop
      @contextmenu.prevent.stop
    >
      <button
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        :disabled="!canShiftHead(-1)"
        @click="shiftHeadCol(-1)"
      >{{ $t('compColMenuLeft') }}</button>
      <button
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        :disabled="!canShiftHead(1)"
        @click="shiftHeadCol(1)"
      >{{ $t('compColMenuRight') }}</button>
      <span class="mod-ct__menu-sep" aria-hidden="true"></span>
      <button
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        @click="resetHeadColWidth"
      >{{ $t('compColMenuReset') }}</button>
    </div>
  </section>
</template>

<script>
import sourceAdapter, { normalizeCompNode } from '../../cep/comp-source'
import IsCheckbox from '../../ui-next/components/ui/IsCheckbox.vue'
import rightMenu from '../projectList/menu'
import {
  stateOf as taskStateOf, iconOfState, existingOutputFilesOf,
  sizeTextOfFiles, sizeTipOfFiles, lastLineOf
} from '../../util/task-output'
import notice from '../../ui-next/notice'
import hostAdapter from '../../util/host-env'
import { OUTPUT_FORMATS, defaultOutputFormats } from '../../util/outputFormats'
import {
  columnOf, clampColumnWidth, loadColumnLayout, saveColumnLayout
} from '../../util/compTreeColumns'

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
/**
 * 演示最新日志与失败原因，与 MOCK_STATES 同索引。
 * 失败项的 detail 末行是编码器结论（真实面板同样把 stderr 末尾写进 detail），
 * 列内只显示这一行，hover 才展开完整多行。
 */
const MOCK_LOGS = [
  { text: '转换成功！', detail: '' },
  { text: '正在渲染合成 7/24...', detail: '' },
  { text: '转换成功！ APNG 质量 80 → 70（1.24 MB > 0.78 MB）', detail: '' },
  { text: '', detail: '' },
  {
    text: '生成失败',
    detail: 'Command failed: apngquant --quality 80-80 -o /tmp/out.apng\n' +
      'stderr: apngquant: out of memory while quantizing frame 132/480'
  },
  { text: '转换成功！', detail: '' }
]
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
      /** 拖动中已顶到 min / max：把分隔线换成警示色，避免「拖了没反应」 */
      colLimit: '',
      /** 表头右键菜单：只放「左移 / 右移 / 恢复默认宽度」，不再占用拖拽手势 */
      headMenu: { open: false, x: 0, y: 0, key: '' },
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
    /**
     * 名字 + 输出格式这列永远自适应：宽度 = 剩余空间，不需要记宽度，
     * 也不会出现「设了宽度之后窗口变窄被压坏」的补偿逻辑。
     */
    nameColStyle () {
      return { flex: '1 1 0' }
    },
    headMenuStyle () {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      return {
        left: Math.max(4, Math.min(this.headMenu.x, vw - 170)) + 'px',
        top: Math.max(4, Math.min(this.headMenu.y, vh - 110)) + 'px'
      }
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
    this.closeHeadMenu()
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
    /** 状态名（成功 / 失败 / 进行中 / 待处理）：列内文本为空时的兜底与 hover 首行 */
    stateNameOf (node) {
      const s = this.stateOf(node)
      if (s === 'done') return this.$t('statDone')
      if (s === 'fail') return this.$t('statFail')
      if (s === 'running') return this.$t('statRunning')
      return this.$t('compStatePending')
    },
    /** 最新一条过程日志（渲染进度、成功文案等）：真实面板读 process.text */
    stateLogOf (node) {
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        return MOCK_LOGS[Math.abs(Number(node && node.index) || 0) % MOCK_LOGS.length].text
      }
      const task = this.taskOf(node)
      return String((task && task.process && task.process.text) || '')
    },
    /** 失败 / 中止的具体原因（stderr 摘要等）：真实面板读 process.detail */
    stateDetailOf (node) {
      if (typeof window !== 'undefined' && window.__ispartaMockup) {
        return MOCK_LOGS[Math.abs(Number(node && node.index) || 0) % MOCK_LOGS.length].detail
      }
      const task = this.taskOf(node)
      return String((task && task.process && task.process.detail) || '')
    },
    /**
     * 列内文本：完成态不再重复「成功」，把位置直接留给产物大小；
     * 失败 / 中止 / 进行中显示最新一条日志（原因优先），列宽不够时省略，hover 看全文。
     */
    stateLabelOf (node) {
      if (this.stateOf(node) === 'done') return ''
      return lastLineOf(this.stateDetailOf(node)) ||
        lastLineOf(this.stateLogOf(node)) ||
        this.stateNameOf(node)
    },
    /** 无障碍名称：状态 + 原因/进度 + 产物大小（读屏不依赖 hover） */
    stateAriaOf (node) {
      const name = this.stateNameOf(node)
      const parts = [name]
      const label = this.stateLabelOf(node)
      if (label && label !== name) parts.push(label)
      const size = this.stateSizeOf(node)
      if (size) parts.push(size)
      return parts.join(' · ')
    },
    /** hover 完整信息：状态 + 完整原因（多行不省略）+ 逐文件产物路径与精确字节数 + 复制提示 */
    stateTipOf (node) {
      const state = this.stateOf(node)
      const size = this.stateSizeOf(node)
      const lines = [state === 'done' && size
        ? this.stateNameOf(node) + ' · ' + size
        : this.stateNameOf(node)]
      if (state !== 'done') {
        const detail = String(this.stateDetailOf(node) || '').replace(/\r/g, '').trim()
        // 失败原因常是 stderr 多行原文，hover 给全文；没有原因时退回最近一条过程文案
        if (detail) {
          lines.push(detail)
        } else {
          const log = lastLineOf(this.stateLogOf(node))
          if (log) lines.push(log)
        }
      }
      if (state === 'done') {
        if (typeof window !== 'undefined' && window.__ispartaMockup) {
          lines.push('/mock/output/' + String((node && node.name) || 'comp') + ' — ' + size)
        } else {
          const task = this.taskOf(node)
          const tip = task ? sizeTipOfFiles(existingOutputFilesOf(task)) : ''
          if (tip) lines.push(tip)
        }
        lines.push(this.$t('compStateCopy'))
      }
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
    /** 持久化整份布局（列顺序 + 各列宽度） */
    saveLayout () {
      saveColumnLayout({
        order: this.columnOrder,
        widths: this.columnWidths
      })
    },
    /** 表头短点击：数据升 / 降序排序（表头唯一的手势） */
    onHeadClick (col) {
      if (col && col.sortKey) this.sortBy(col.sortKey)
    },
    /**
     * 表头右缘拖宽：与 Home.vue 面板分隔条同一范式（document 监听 + body class），
     * 拖动只改内存宽度，松手才持久化，避免每帧写 storage。
     */
    startColumnResize (e, col) {
      if (e.button !== 0) return
      const startX = e.clientX
      const cell = e.currentTarget && e.currentTarget.parentElement
      // 基准取实测宽度：列被 flex 压过时存储值会大于实际，用存储值会让指针与列宽脱节
      const measured = cell ? Math.round(cell.getBoundingClientRect().width) : 0
      const startW = measured > 0 ? measured : clampColumnWidth(col.key, this.columnWidths[col.key])
      this.resizingCol = col.key
      this.colLimit = ''
      document.body.classList.add('is-column-resizing')
      const onMove = (ev) => {
        const cur = clampColumnWidth(col.key, this.columnWidths[col.key])
        const next = clampColumnWidth(col.key, startW + ev.clientX - startX)
        const pushed = Math.abs(ev.clientX - startX) > 1
        // 已到边界还在同方向推：给出「到底了」的视觉反馈，而不是静默无变化
        this.colLimit = pushed && next === cur ? (ev.clientX < startX ? 'min' : 'max') : ''
        this.$set(this.columnWidths, col.key, next)
      }
      this._colResizeCleanup = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', this.stopColumnResize)
        document.body.classList.remove('is-column-resizing')
        this.resizingCol = ''
        this.colLimit = ''
        this.saveLayout()
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', this.stopColumnResize)
    },
    stopColumnResize () {
      const cleanup = this._colResizeCleanup
      this._colResizeCleanup = null
      if (cleanup) cleanup()
    },
    /** 恢复该列出厂宽度（表头右键菜单入口） */
    resetColumnWidth (col) {
      const def = columnOf(col.key)
      if (!def) return
      this.$set(this.columnWidths, col.key, def.width)
      this.saveLayout()
    },
    /** 表头右键：列顺序与恢复默认宽度的唯一入口（拖拽只留给「改宽度」） */
    onHeadContext (ev, col) {
      if (!col) return
      this.headMenu = { open: true, x: ev.clientX, y: ev.clientY, key: col.key }
      if (typeof window !== 'undefined') window.addEventListener('mousedown', this.closeHeadMenu)
    },
    closeHeadMenu () {
      if (!this.headMenu.open) return
      this.headMenu.open = false
      if (typeof window !== 'undefined') window.removeEventListener('mousedown', this.closeHeadMenu)
    },
    /** step=-1 左移一列，+1 右移一列；到头了菜单项直接禁用 */
    canShiftHead (step) {
      const i = this.columnOrder.indexOf(this.headMenu.key)
      const j = i + step
      return i >= 0 && j >= 0 && j < this.columnOrder.length
    },
    shiftHeadCol (step) {
      const i = this.columnOrder.indexOf(this.headMenu.key)
      const j = i + step
      if (i < 0 || j < 0 || j >= this.columnOrder.length) return
      const order = this.columnOrder.slice()
      const tmp = order[i]
      order[i] = order[j]
      order[j] = tmp
      this.columnOrder = order
      this.saveLayout()
      this.closeHeadMenu()
    },
    resetHeadColWidth () {
      const col = columnOf(this.headMenu.key)
      if (col) this.resetColumnWidth(col)
      this.closeHeadMenu()
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
/* 表头那格要露出跨边界的列宽把手（名字列同样可拖宽，只是不能拖顺序） */
.mod-ct__c--name-h {
  /* 只负责「搜索框撑满这一列」：宽度 flex 自适应，没有把手 */
  overflow: hidden;
}
.mod-ct__c--num {
  padding-right: 8px;
  text-align: right;
}
/* 表头可配置列：宽度由 colStyle 注入，表头与行共用；右缘留给列宽分隔条。
 * overflow 必须可见：分隔条要跨在列边界上（左右各半），否则被裁掉一半。 */
.mod-ct__c--h {
  position: relative;
  overflow: visible;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  font-weight: 600;
}
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
  max-width: 100%;
  overflow: hidden;
  cursor: default;
}
/* 列宽分隔条：跨在列边界上（左右各半），从哪一侧靠近都给 col-resize 光标 */
/* 列宽把手：16px 宽、跨在边界上（左右各 8px），比一格文字还宽，容易抓准 */
.mod-ct__resizer {
  position: absolute;
  z-index: 3;
  top: 0;
  right: -8px;
  bottom: 0;
  width: 16px;
  cursor: col-resize;
}
.mod-ct__resizer::after {
  content: '';
  position: absolute;
  top: 3px;
  bottom: 3px;
  right: 7px;
  width: 2px;
  border-radius: 1px;
  background: var(--is-accent, #c8f542);
  opacity: 0;
}
.mod-ct__c--h:hover .mod-ct__resizer::after,
.mod-ct__c--h.is-resizing .mod-ct__resizer::after {
  opacity: 0.75;
}
.mod-ct__resizer:hover::after {
  opacity: 1;
}
/* 已顶到最小 / 最大宽度：分隔线转警示色，明确「到头了」，不是拖拽失灵 */
.mod-ct__c--h.is-at-limit .mod-ct__resizer::after {
  opacity: 1;
  background: var(--is-warn, #ffc857);
}
/* 运行状态列（替代原帧数列）：完成态显示产物大小，整格可点击复制
 * 与尺寸 / 帧率同为「数值列」：整列（表头 + 内容）右对齐，右缘对齐成一条竖线，
 * 长原因由省略号截断，hover 看全文。 */
.mod-ct__c--state {
  padding-right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  text-align: right;
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
  /* 可收缩：原因/进度往往长于列宽，省略号交给它，别把产物大小挤出列 */
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
/* 产物大小紧跟图标（第二段起点与其它行的原因/进度一致），不再贴右留空 */
.mod-ct__state-size {
  flex: 0 1 auto;
  min-width: 0;
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
.mod-ct__fmt {
  box-sizing: border-box;
  flex: 0 0 auto;
  width: 18px;
  height: 18px;
  border-radius: 4px;
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
/* 操作列固定不压缩，overflow:visible 防止齿轮被行裁掉；
 * margin-left:auto 让齿轮始终贴右 —— 名字列拖窄后多出的空间留在状态列之后，不会把齿轮挤到中间 */
.mod-ct__c--act {
  width: 32px;
  flex: 0 0 32px;
  margin-left: auto;
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

/* 表头右键菜单：列顺序 / 恢复默认宽度 */
.mod-ct__menu {
  position: fixed;
  z-index: 30;
  min-width: 152px;
  padding: 4px;
  border: 1px solid var(--is-line, rgba(128, 128, 128, 0.3));
  border-radius: 6px;
  background: var(--is-card, #1a201c);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
  font-weight: 400;
}
.mod-ct__menu-item {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.mod-ct__menu-item:hover:not(:disabled) {
  background: var(--is-card-hi, #222a24);
}
.mod-ct__menu-item:disabled {
  opacity: 0.38;
  cursor: default;
}
.mod-ct__menu-sep {
  display: block;
  height: 1px;
  margin: 4px 6px;
  background: var(--is-line, rgba(128, 128, 128, 0.25));
}
</style>
