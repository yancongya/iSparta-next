<template>
  <section
    class="mod-list"
    @click="onBlankClick"
    @dblclick="onBlankDblclick"
    @mousedown="onListMouseDown"
  >
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
        @contextmenu.prevent="itemRightClick(project, index)"
        @click="onItemClick(index)"
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

        <!-- 缩略图：悬停逐帧播放；已完成的条目点击打开前后对比 -->
        <div
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
          <span v-if="frameCount(project) > 1" class="thumb__badge">{{ frameCount(project) }}F</span>
          <span v-if="stateOf(project.process) === 'done'" class="thumb__cmp-hint">
            <is-icon name="eye" size="xs" />
          </span>
        </div>

        <div class="info">
          <!-- 第一行：类型标签 + 输出目录（点击切换，hover 高亮） -->
          <div class="input">
            <is-tag :tone="tagTone(project.basic && project.basic.type)">
              {{ project.basic && project.basic.type }}
            </is-tag>
            <button
              type="button"
              class="outpath is-ellipsis"
              v-tip="$t('tipChangeOutput') + '：' + outPathOf(project)"
              @click.stop="changeFold(project.basic && project.basic.outputPath, index)"
            >
              <is-icon name="folder" size="xs" />
              <span class="is-ellipsis">{{ outPathOf(project) | basePath }}</span>
            </button>
          </div>
          <!-- 第二行：配置摘要。每项独立配色 + hover 反馈 + 完整设置说明。
               数值文字包进 .sum-v：中档容器查询只隐藏数值（is-icon 本身也是 span，不能裸选 > span） -->
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
          </div>
          <!-- 第三行：准备输出的名字 + 变量路径 -->
          <div class="summary summary--out">
            <span class="sum sum--name is-ellipsis" v-tip="tipOf('outputName', outNameOf(project))">
              <is-icon name="save" size="xs" /><span class="is-ellipsis">{{ outNameOf(project) || '—' }}</span>
            </span>
            <span class="sum sum--tpl is-ellipsis" v-tip="tipOf('pathVar', outTplOf(project))">
              <is-icon name="sliders" size="xs" /><span class="is-ellipsis">{{ outTplOf(project) || '—' }}</span>
            </span>
          </div>
        </div>

        <!-- 右侧：延时设置（齿轮）在状态区左边 -->
        <div class="side">
          <button
            v-if="project.basic && project.basic.type == 'PNGs'"
            type="button"
            class="iconbtn"
            :title="$t('tipDelay')"
            @click.stop="onDelaySetting(project)"
          ><is-icon name="settings" size="sm" /></button>

          <!-- 状态与四态进度：未处理时整块不出现，避免空图标与空槽位成噪音 -->
          <div v-if="showMeta(project)" class="meta">
            <span class="status" :class="'is-' + stateOf(project.process)">
              <is-pacman
                v-if="stateOf(project.process) === 'running'"
                size="xs"
                :dot-count="2"
                :label="$t('statRunning')"
              />
              <is-icon v-else :name="statusIcon(project.process)" size="sm" />
              {{ project.process && project.process.text }}
            </span>
            <div class="progress" :class="'is-' + stateOf(project.process)">
              <span
                class="progress__fill"
                :class="{ 'is-shimmer': stateOf(project.process) === 'running' }"
                :style="{ width: processPrecent(project.process && project.process.schedule) + '%' }"
              ></span>
            </div>
          </div>
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

    <button type="button" class="open-folder" :disabled="isLocked" @click="openFolder">
      <is-icon name="folder-plus" size="sm" />
      {{ $t('openFolder') }}
    </button>
  </section>
</template>
<script>
import { ipc } from '../../util/node-env'
import rightMenu from './menu'
import DelayDialog from '../delayDialog/index.vue'
import CompareDialog from '../compareDialog/index.vue'
import IsPacman from '../../ui-next/components/IsPacman.vue'
import { f as fsOperate } from '../drag/file.js'
import { naturalSort } from '../../util/sort'
import notice from '../../ui-next/notice'

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
      hoverFrame: 0,
      hoverTimer: null,
      // 空白处框选
      marquee: { active: false, moved: false, x: 0, y: 0, w: 0, h: 0, startX: 0, startY: 0 },
      suppressBlankClick: false
    }
  },

  created () {
    // 回应修改输出目录的操作
    ipc.on('change-item-fold', (path, order) => {
      if (path[0]) {
        this.$store.dispatch('editBasic', {
          outputPath: path[0]
        })
      }
    })
  },
  beforeDestroy () {
    this.stopHover()
    this.unbindMarquee()
  },
  computed: {
    selectedList () {
      return this.$store.getters.getterSelected
    },
    isMultiItems () {
      return this.selectedList.length > 1
    },
    projectList () {
      return this.$store.getters.getterItems
    },
    isLocked () {
      return this.$store.getters.getterLocked
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
        'is-fail': this.stateOf(project.process) === 'fail'
      }
    },
    frameCount (project) {
      var list = project && project.basic && project.basic.fileList
      return list ? list.length : 0
    },
    // ---------- 摘要项的完整说明气泡 ----------
    tipOf (labelKey, value) {
      return this.$t(labelKey) + '：' + (value || '—')
    },
    fpsTip (project) {
      var v = project && project.options && project.options.frameRate
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
      if (!shown) { return '' }
      var s = project.options.sizeLimit
      var extra = []
      if (s.autoQuality !== false) { extra.push(this.$t('sizeLimitAutoQuality')) }
      if (s.autoDelete) { extra.push(this.$t('sizeLimitAutoDelete')) }
      return shown + (extra.length ? ' · ' + extra.join(' / ') : '')
    },
    // ---------- 第二/三行摘要取值 ----------
    outPathOf (project) {
      return (project && project.basic && project.basic.outputPath) || ''
    },
    outNameOf (project) {
      return (project && project.options && project.options.outputName) || ''
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
      var v = project && project.options && project.options.frameRate
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
    // schedule: 0/undefined 待处理，(0,1) 进行中，1 成功，-1 失败
    stateOf (process) {
      var s = process && process.schedule
      if (s === 1) return 'done'
      if (s === -1) return 'fail'
      if (s > 0 && s < 1) return 'running'
      return 'pending'
    },
    statusIcon (process) {
      switch (this.stateOf(process)) {
        case 'done': return 'check-circle'
        case 'fail': return 'x-circle'
        case 'running': return 'loader'
        default: return 'clock'
      }
    },
    // 待处理且无文案时不占位，让列表安静下来
    showMeta (project) {
      var state = this.stateOf(project.process)
      return state !== 'pending' || !!(project.process && project.process.text)
    },
    thumbSrc (project, index) {
      var list = project && project.basic && project.basic.fileList
      if (!list || !list.length) { return '' }
      if (this.hoverIdx === index) {
        var i = this.hoverFrame % Math.min(list.length, 48)
        return this.thumbFor(list[i])
      }
      return this.thumbFor(list[0])
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
    // 点击条目空白处 = 单选（勾选框负责多选）
    onItemClick (index) {
      if (this.isLocked) return
      var project = this.projectList[index]
      if (project && !project.isSelected) {
        this.$store.dispatch('singleSelect', index)
      }
    },
    // 单击列表空白处 = 取消全部选中
    onBlankClick (e) {
      if (this.suppressBlankClick) {
        this.suppressBlankClick = false
        return
      }
      if (this.isLocked || !this.projectList.length) return
      var t = e.target
      if (!t || !t.closest) return
      // 条目与底部按钮有自己的交互，不算空白
      if (t.closest('.item') || t.closest('.open-folder')) return
      this.$store.dispatch('noneSelect')
    },
    // 双击列表空白处 = 全选（dblclick 前会有两次 click，最终状态以全选为准）
    onBlankDblclick (e) {
      if (this.isLocked || !this.projectList.length) return
      var t = e.target
      if (!t || !t.closest) return
      if (t.closest('.item') || t.closest('.open-folder')) return
      this.$store.dispatch('allSelect')
    },
    // 空白处按下 → 拖拽框选
    onListMouseDown (e) {
      if (this.isLocked || !this.projectList.length) return
      if (e.button !== 0) return
      var t = e.target
      if (!t || !t.closest) return
      if (t.closest('.item') || t.closest('.open-folder') || t.closest('.mod-list__marquee')) return
      // 立刻抑制原生文字/图片拖选
      e.preventDefault()
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
      // 拖拽过程中持续禁止原生选区
      if (e.preventDefault) e.preventDefault()
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
          if (isFinite(idx)) indexes.push(idx)
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
      }
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
    toggleSelect (index) {
      if (this.isLocked) {
        return false
      }
      this.$store.dispatch('multiSelect', index)
    },
    itemRightClick (project, index) {
      var locale = this.$i18n.messages[this.$i18n.locale]
      var procState = this.stateOf(project && project.process)
      var isRunning = procState === 'running'
      this.$store.dispatch('setSelected', index)
      // 让 store 先完成选中态更新，再取当前选中数量构建菜单
      window.setTimeout(() => {
        rightMenu.init(
          this.$store,
          Object.assign({}, project && project.basic, { isRunning: isRunning }),
          index,
          this.isMultiItems,
          locale
        )
      }, 10)
    },
    changeFold (outputPath, index) {
      if (this.isLocked) {
        return false
      }
      ipc.send('change-item-fold', outputPath, index)
    },
    // 打开前后对比：仅已完成（有输出文件）的条目有意义
    openCompare (project) {
      if (this.stateOf(project.process) !== 'done') return
      this.compareProject = project
    },
    openFolder () {
      if (this.isLocked) return
      ipc.invoke('dialog:openFiles', {
        properties: ['openFile', 'openDirectory', 'multiSelections']
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return false }
        return this.importPaths(result.filePaths)
      }).catch((e) => {
        console.error(e)
        notice.error(this.$t('noticeOpenFailed'), e && e.message)
      })
    },
    importPaths (list) {
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
      this.delayProject = project
      this.dialogFormVisible = true
    }
  }
}
</script>

<style lang="scss">
@import "./projectList.scss";
</style>
