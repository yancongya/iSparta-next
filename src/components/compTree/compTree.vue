<!--
  合成列表（CEP 特化）— 复用 PAG 列表式：表头全选/搜索 + 尺寸/帧率排序
  无展开折叠；名称与搜索框同列；末列是任务运行状态：列内只显示最新一条
  （失败/中止给原因、进行中给进度），完成态直接留给产物大小；hover 看全文，点击复制产物
  行末不再有齿轮列：双击整行打开该合成的输出设置（定位合成在右键菜单里）
  列宽拖动采用「跟手挤压」：改被拖列的同时反向调整右邻列（数值列之间总宽不变），
  名字列就不会被 flex 反向吸收、分隔线才会跟着指针走；最后一列右缘没有把手。
  名字列右缘是两段式：左拖留白、右拖挤窄数值列，恰好吃满自动回自适应
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
      <!-- 名字 + 输出格式：一只撑满整列的搜索框。默认吃满剩余空间（宽度=0），
           拖右缘可以钉一个固定宽度，右键「恢复自适应」再放回来 -->
      <span
        class="mod-ct__c mod-ct__c--name mod-ct__c--name-h"
        :class="{
          'is-resizing': resizingCol === 'name',
          'is-at-limit': resizingCol === 'name' && !!colLimit
        }"
        :style="nameColStyle"
        :title="$t('compColNameHint')"
        @contextmenu.prevent.stop="onNameHeadContext($event)"
      >
        <input
          v-model="keyword"
          type="search"
          class="mod-ct__search"
          :placeholder="$t('compTree') + ' / ' + $t('search')"
          spellcheck="false"
        />
        <!-- 与数值列一致的右缘把手：名字列/状态列交界处同样能按下拖宽 -->
        <span
          class="mod-ct__resizer"
          @mousedown.stop.prevent="startNameResize"
        ></span>
      </span>
      <!-- 名字列被拖成固定宽度后，多出来的空间留在这里：数值列依旧贴右，
           等价于「名字列窄一点，中间空一段」，而不是把整排数据列往左拽 -->
      <span v-if="nameFixed" class="mod-ct__gap" aria-hidden="true"></span>
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
        <!-- 右缘把手：只负责拖动改列宽。最后一列右缘是面板边、没有右邻列可挤，不设把手 -->
        <span
          v-if="col.key !== lastColumnKey"
          class="mod-ct__resizer"
          @mousedown.stop.prevent="startColumnResize($event, col)"
        ></span>
      </div>
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
        <span class="mod-ct__c mod-ct__c--name" :style="nameColStyle" :title="titleOf(node)">
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
        <span v-if="nameFixed" class="mod-ct__gap" aria-hidden="true"></span>
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
        v-if="!isNameHead"
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        :disabled="!canShiftHead(-1)"
        @click="shiftHeadCol(-1)"
      >{{ $t('compColMenuLeft') }}</button>
      <button
        v-if="!isNameHead"
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        :disabled="!canShiftHead(1)"
        @click="shiftHeadCol(1)"
      >{{ $t('compColMenuRight') }}</button>
      <span v-if="!isNameHead" class="mod-ct__menu-sep" aria-hidden="true"></span>
      <!-- 列宽档位：拖拽之外的离散入口；最后一列右缘没有把手，全靠这一排调宽 -->
      <template v-if="!isNameHead">
        <div class="mod-ct__menu-presets" role="group" :aria-label="$t('compColWidth')">
          <span class="mod-ct__menu-cap">{{ $t('compColWidth') }}</span>
          <button
            v-for="p in widthPresets"
            :key="p.key"
            type="button"
            class="mod-ct__menu-preset"
            :class="{ 'is-on': isPresetOn(p.key) }"
            role="menuitemradio"
            :aria-checked="isPresetOn(p.key) ? 'true' : 'false'"
            @click="setHeadColPreset(p.key)"
          >{{ $t(p.labelKey) }}</button>
        </div>
        <span class="mod-ct__menu-sep" aria-hidden="true"></span>
      </template>
      <button
        type="button"
        class="mod-ct__menu-item"
        role="menuitem"
        @click="resetHeadColWidth"
      >{{ isNameHead ? $t('compColMenuFit') : $t('compColMenuReset') }}</button>
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
  columnOf, clampColumnWidth, clampNameWidth, presetColumnWidth,
  loadColumnLayout, saveColumnLayout, CT_NAME_KEY, CT_NAME_MIN
} from '../../util/compTreeColumns'

/** 渲染后合成的三种动图格式，顺序与 store 默认 outputFormat 一致 */
const FORMATS = [
  { key: 'APNG', label: 'A' },
  { key: 'GIF', label: 'G' },
  { key: 'WEBP', label: 'W' }
]
/** 表头右键菜单的列宽档位（最后一列右缘无把手，靠它改宽度） */
const WIDTH_PRESETS = [
  { key: 'narrow', labelKey: 'compColWidthNarrow' },
  { key: 'normal', labelKey: 'compColWidthNormal' },
  { key: 'wide', labelKey: 'compColWidthWide' }
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
      /** 名字列宽度：0 = 自适应剩余空间，>0 = 用户拖出来的固定宽度 */
      nameWidth: layout.widths[CT_NAME_KEY] || 0,
      resizingCol: '',
      /** 拖动中已顶到 min / max：把分隔线换成警示色，避免「拖了没反应」 */
      colLimit: '',
      /** 表头右键菜单：只放顺序 / 列宽档位 / 恢复默认，不占用拖拽手势 */
      headMenu: { open: false, x: 0, y: 0, key: '' },
      widthPresets: WIDTH_PRESETS,
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
    /** 最后一列右缘是面板边，不是两列交界，不给拖拽把手 */
    lastColumnKey () {
      return this.columnOrder[this.columnOrder.length - 1] || ''
    },
    /**
     * 名字 + 输出格式列：不拖时 flex:1 吃满剩余空间（宽度存 0）；
     * 拖过之后用实测像素宽固定，多余空间由 .mod-ct__gap 吸收（或由右侧数值列让出）。
     * min-width 兜住格式按钮（A/G/W）+ 图标，再窄也还能认出是哪一列。
     */
    nameColStyle () {
      const w = clampNameWidth(this.nameWidth)
      if (!w) return { flex: '1 1 0' }
      // shrink 权重给足：窗口变窄时先压名字列（它可以省略号），别去压数值列
      return { width: w + 'px', flex: '0 100 ' + w + 'px', minWidth: CT_NAME_MIN + 'px' }
    },
    /** 名字列是否已从「自适应」变成「固定宽度」（固定时才需要中间那段弹性留白） */
    nameFixed () {
      return clampNameWidth(this.nameWidth) > 0
    },
    isNameHead () {
      return this.headMenu.key === CT_NAME_KEY
    },
    headMenuStyle () {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800
      return {
        left: Math.max(4, Math.min(this.headMenu.x, vw - 220)) + 'px',
        top: Math.max(4, Math.min(this.headMenu.y, vh - 150)) + 'px'
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
    /** tooltip 始终给全信息：名称 / 文件夹 / index，并提示双击可开输出设置 */
    titleOf (node) {
      var lines = [String((node && node.name) || '')]
      var folder = String((node && node.folderPath) || '').replace(/^\/+|\/+$/g, '')
      if (folder) lines.push(folder)
      lines.push('#' + (Number(node && node.index) + 1))
      lines.push(this.$t('compRowDblHint'))
      return lines.join('\n')
    },
    /** 列宽 inline style：width 与 flex-basis 同步，表头和行取同一个值 */
    colStyle (col) {
      const w = clampColumnWidth(col.key, this.columnWidths[col.key])
      return { width: w + 'px', flex: '0 1 ' + w + 'px', minWidth: col.min + 'px' }
    },
    /** 持久化整份布局（列顺序 + 各列宽度 + 名字列宽度） */
    saveLayout () {
      saveColumnLayout({
        order: this.columnOrder,
        widths: Object.assign({}, this.columnWidths, { name: this.nameWidth })
      })
    },
    /** 表头短点击：数据升 / 降序排序（表头唯一的手势） */
    onHeadClick (col) {
      if (col && col.sortKey) this.sortBy(col.sortKey)
    },
    /**
     * 表头右缘拖宽：与 Home.vue 面板分隔条同一范式（document 监听 + body class）。
     *
     * 关键：宽度变化必须由**紧邻右侧列**反向吸收，让「数值列组总宽」保持不变。
     * 否则名字列的 flex:1 会反向吃掉这次变化 —— 被拖列的左缘等量左移，
     * 右缘（也就是用户按住的那根分隔线）数学上恒定不动，看起来像「拖了没反应、
     * 反而是左边搜索框在缩」。总宽不变时右缘 = 左缘 + 自身宽度，才会跟着指针走。
     *
     * 右邻列顶到 min/max 时继续往更右侧传递；全都到极限就把被拖列回退到能兑现的
     * 幅度并给橙色提示。拖动只改内存宽度，松手才持久化。
     */
    startColumnResize (e, col) {
      if (e.button !== 0) return
      const order = this.columnOrder.slice()
      const idx = order.indexOf(col.key)
      // 最后一列没有右邻列可挤，它的右缘是面板边，把手在模板里就不渲染
      if (idx < 0 || idx >= order.length - 1) return
      const rightKeys = order.slice(idx + 1)
      // clampColumnWidth 把 0 视为「没有有效宽度」回退出厂值，拖动中会产生 0，
      // 所以这里直接用列定义的 min/max 钳制，避免吸收量算错
      const clampW = (key, v) => {
        const def = columnOf(key)
        return Math.max(def.min, Math.min(def.max, Math.round(v)))
      }
      // 起点取实测宽度：列被 flex 压过时存储值会大于实际，用存储值会让指针与列宽脱节
      const startW = {}
      const head = this.$el && this.$el.querySelector('.mod-ct__head')
      order.forEach((key) => {
        const el = head && head.querySelector('[data-col="' + key + '"]')
        const measured = el ? Math.round(el.getBoundingClientRect().width) : 0
        startW[key] = measured > 0 ? measured : clampW(key, this.columnWidths[key])
      })
      const startX = e.clientX
      this.resizingCol = col.key
      this.colLimit = ''
      document.body.classList.add('is-column-resizing')
      const onMove = (ev) => {
        const dx = ev.clientX - startX
        const wanted = clampW(col.key, startW[col.key] + dx)
        const delta = wanted - startW[col.key]
        // 每帧都从「起始快照」重算整组宽度：来回拖动必须完全可逆，不能只写这一帧
        // 变动的列（否则右邻列还回宽度后，更右侧的列会停在上一帧的值上）
        const next = {}
        order.forEach((key) => { next[key] = startW[key] })
        let left = delta
        // 依次从右邻列「借 / 还」宽度：先紧邻列，到极限再往右传
        rightKeys.forEach((key) => {
          if (!left) return
          const w = clampW(key, startW[key] - left)
          next[key] = w
          left -= (startW[key] - w)
        })
        const applied = delta - left
        next[col.key] = clampW(col.key, startW[col.key] + applied)
        const ownLimit = Math.abs(dx) > 1 && Math.round(startW[col.key] + dx) !== wanted
        this.colLimit = (ownLimit || (Math.abs(dx) > 1 && applied !== delta))
          ? (dx < 0 ? 'min' : 'max')
          : ''
        Object.keys(next).forEach((key) => this.$set(this.columnWidths, key, next[key]))
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
    /**
     * 名字列右缘拖宽：两段式，保证分隔线始终跟手。
     *
     * ① 拖窄 / 吃回留白：名字列收窄，多出来的空间由 .mod-ct__gap 吸收（数值列不动）。
     *    从留白态往右拖时先把空白吃回来，回到「吃满」宽度就写回 0 恢复自适应。
     * ② 继续往右拖（默认态一开始就在这里）：名字列还要变宽，就按 startColumnResize
     *    同一套规则从右侧数值列依次借宽度（被拖列 +dx、右邻列 −dx），数值列组总宽
     *    随之减小但右缘仍贴右 —— 名字列右缘与数值组左缘始终重合，分隔线跟着指针走。
     *    以前这里把上限写死成「数值组左缘」，默认已吃满时往右拖第一帧就被钳住，
     *    表现为「搜索栏拖不动宽度」。
     *
     * 「吃满宽度」用实测（数值组左缘 − 名字列左缘），不能用「容器宽 − 存储列宽」估算；
     * 每帧从起始快照重算整组宽度，来回拖动完全可逆。
     */
    startNameResize (e) {
      if (e.button !== 0) return
      const startX = e.clientX
      const cell = e.currentTarget && e.currentTarget.parentElement
      if (!cell) return
      const head = cell.parentElement
      const firstCol = head && head.querySelector('[data-col]')
      const rect = cell.getBoundingClientRect()
      const startW = Math.round(rect.width)
      // 吃满宽度 = 名字列宽 + 当前留白，实测才不会在 flex 压过后错几像素
      const fitW = firstCol
        ? Math.max(startW, Math.round(firstCol.getBoundingClientRect().left - rect.left))
        : startW
      const order = this.columnOrder.slice()
      // 与 startColumnResize 一致：拖动中直接用列定义的 min/max，别走 clampColumnWidth
      // （它把 0 当「无有效宽度」回退出厂值，会让借还量算错）
      const clampW = (key, v) => {
        const def = columnOf(key)
        return Math.max(def.min, Math.min(def.max, Math.round(v)))
      }
      const startColW = {}
      order.forEach((key) => {
        const el = head && head.querySelector('[data-col="' + key + '"]')
        const measured = el ? Math.round(el.getBoundingClientRect().width) : 0
        startColW[key] = measured > 0 ? measured : clampW(key, this.columnWidths[key])
      })
      this.resizingCol = CT_NAME_KEY
      this.colLimit = ''
      document.body.classList.add('is-column-resizing')
      const onMove = (ev) => {
        const dx = ev.clientX - startX
        const raw = startW + dx
        // 超过「吃满」的部分才是需要右侧列让出的挤压缩
        const squeeze = Math.max(0, raw - fitW)
        const baseW = squeeze > 0 ? fitW : Math.max(CT_NAME_MIN, Math.round(raw))
        const next = {}
        order.forEach((key) => { next[key] = startColW[key] })
        let left = squeeze
        order.forEach((key) => {
          if (!left) return
          const w = clampW(key, startColW[key] - left)
          next[key] = w
          left -= (startColW[key] - w)
        })
        const applied = squeeze - left
        // 恰好回到吃满且没有挤压过：写 0，窗口变宽时名字列还能跟着长
        this.nameWidth = (baseW === fitW && applied === 0) ? 0 : baseW + applied
        const atMin = raw < CT_NAME_MIN
        this.colLimit = Math.abs(dx) > 1 && (atMin || applied < squeeze)
          ? (dx < 0 ? 'min' : 'max')
          : ''
        Object.keys(next).forEach((key) => this.$set(this.columnWidths, key, next[key]))
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
    /** 名字列表头右键：它没有列顺序，只给「恢复自适应宽度」 */
    onNameHeadContext (ev) {
      this.onHeadContext(ev, { key: CT_NAME_KEY })
    },
    /** 恢复该列出厂宽度（表头右键菜单入口） */
    resetColumnWidth (col) {
      const def = columnOf(col.key)
      if (!def) return
      this.$set(this.columnWidths, col.key, def.width)
      this.saveLayout()
    },
    /** 右键菜单档位的高亮态：宽度恰好等于档位值才算选中 */
    isPresetOn (preset) {
      const key = this.headMenu.key
      if (!columnOf(key)) return false
      return clampColumnWidth(key, this.columnWidths[key]) === presetColumnWidth(key, preset)
    },
    /** 离散档位改宽：不追求跟手，宽度变化交给名字列 / 留白自然吸收 */
    setHeadColPreset (preset) {
      const key = this.headMenu.key
      if (columnOf(key)) {
        this.$set(this.columnWidths, key, presetColumnWidth(key, preset))
        this.saveLayout()
      }
      this.closeHeadMenu()
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
      if (this.headMenu.key === CT_NAME_KEY) {
        this.nameWidth = 0
        this.saveLayout()
        this.closeHeadMenu()
        return
      }
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
    /**
     * 双击合成行：打开该合成的输出设置（取代原来的齿轮列）。
     * 落在勾选框 / 格式开关 / 状态列等按钮上时不算，避免与它们自己的点击冲突；
     * 「在 AE 中定位合成」移到右键菜单，双击不再抢这个手势。
     */
    onRowDblclick (ev, node) {
      if (ev && ev.target && ev.target.closest) {
        if (ev.target.closest('.mod-ct__cb, button, input, a')) return
      }
      // 进入「单项设置」＝把编辑目标收成这一条（与原来点齿轮一致）：
      // 先同步树内勾选，避免树里看着多选、实际只编辑一条
      this.selectedMap = {}
      this.$set(this.selectedMap, node.id, true)
      this.emitSelection()
      this.$emit('configure', node)
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
  /* 相对定位给把手当基准；overflow 可见让把手跨到右侧列边界上 */
  position: relative;
  overflow: visible;
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
.mod-ct__c--name-h:hover .mod-ct__resizer::after,
.mod-ct__c--h.is-resizing .mod-ct__resizer::after,
.mod-ct__c--name-h.is-resizing .mod-ct__resizer::after {
  opacity: 0.75;
}
.mod-ct__resizer:hover::after {
  opacity: 1;
}
/* 已顶到最小 / 最大宽度：分隔线转警示色，明确「到头了」，不是拖拽失灵 */
.mod-ct__c--h.is-at-limit .mod-ct__resizer::after,
.mod-ct__c--name-h.is-at-limit .mod-ct__resizer::after {
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
/* 名字列固定宽度后吸收剩余空间：数值列仍然贴右，只是名字与尺寸之间空一段 */
.mod-ct__gap {
  flex: 1 1 0;
  min-width: 0;
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
/* 列宽档位：一行三格，避免菜单被六七个条目撑得过长 */
.mod-ct__menu-presets {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px 4px;
}
.mod-ct__menu-cap {
  flex: 1 1 auto;
  color: var(--is-text-3, #8a8f8c);
  white-space: nowrap;
}
.mod-ct__menu-preset {
  padding: 3px 7px;
  border: 1px solid var(--is-line, rgba(128, 128, 128, 0.3));
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
.mod-ct__menu-preset:hover {
  border-color: var(--is-border-hi, rgba(128, 128, 128, 0.6));
}
.mod-ct__menu-preset.is-on {
  border-color: var(--is-accent, #c8f542);
  color: var(--is-accent, #c8f542);
}
</style>
