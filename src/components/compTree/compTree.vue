<!--
  合成树（CEP 特化注入）
  - 无内嵌面板组标题（刷新/加入在顶部工具栏）
  - 点击行 = 折叠/展开，不是选中
  - 勾选框 = 选中；支持空白拖拽框选
  - 桌面端不使用本组件，互不影响
-->
<template>
  <section
    class="mod-comptree"
    role="region"
    :aria-label="$t('compTree')"
    @mousedown="onMarqueeStart"
  >
    <div v-if="!nodes.length" class="mod-comptree__empty">
      {{ busy ? $t('compTreeLoading') : $t('compTreeEmpty') }}
    </div>
    <ul v-else class="mod-comptree__list" role="listbox" :aria-label="$t('compTree')" multiple>
      <li
        v-for="node in visibleNodes"
        :key="node.id"
        class="mod-comptree__row"
        :class="{ 'is-on': !!selectedMap[node.id], 'is-dim': node.hiddenByCollapse }"
        :data-id="node.id"
        :style="{ paddingLeft: (8 + node.depth * 14) + 'px' }"
        draggable="true"
        @click.stop="onRowClick(node)"
        @dragstart="onRowDrag($event, node)"
      >
        <is-checkbox
          :value="!!selectedMap[node.id]"
          @input.stop="toggleSelect(node)"
        />
        <span
          v-if="hasChildren(node)"
          class="mod-comptree__twisty"
          :class="{ 'is-open': !!expandedMap[node.id] }"
          @click.stop="toggleExpand(node)"
        >▸</span>
        <span v-else class="mod-comptree__twisty mod-comptree__twisty--leaf"></span>
        <div class="mod-comptree__meta">
          <div class="mod-comptree__name" :title="node.name">
            <span v-if="node.folderPath" class="mod-comptree__folder">{{ node.folderPath }}/</span>{{ node.name }}
          </div>
          <div class="mod-comptree__sub" v-if="node.type === 'composition' || node.fps">
            {{ node.width }}×{{ node.height }} · {{ node.fps | fps }}fps · {{ node.frames || node.duration }}f
            <span v-if="node.refs && node.refs.length" class="mod-comptree__nest">· {{ $t('compTreeNested', { n: node.refs.length }) }}</span>
          </div>
        </div>
      </li>
    </ul>
    <div v-if="marquee.active" class="mod-comptree__marquee" :style="marqueeStyle"></div>
  </section>
</template>

<script>
import sourceAdapter, { normalizeCompNode } from '../../cep/comp-source'
import IsCheckbox from '../../ui-next/components/ui/IsCheckbox.vue'

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
    return {
      busy: false,
      nodes: [],
      selectedMap: {},
      expandedMap: {},
      marquee: { active: false, x0: 0, y0: 0, x1: 0, y1: 0 }
    }
  },
  computed: {
    /** 树：带 depth 的扁平列表 + 折叠隐藏 */
    visibleNodes () {
      const hidden = {}
      return this.nodes.filter((n) => {
        if (n.parentId && hidden[n.parentId]) {
          hidden[n.id] = true
          return false
        }
        if (n.type === 'folder' && !this.expandedMap[n.id]) {
          // 折叠文件夹：只显示自身，子级隐藏
          hidden[n.id] = true
        }
        return true
      })
    },
    selectedIds () {
      return this.nodes.filter((n) => this.selectedMap[n.id]).map((n) => n.id)
    },
    selectedNodes () {
      return this.nodes.filter((n) => this.selectedMap[n.id])
    },
    marqueeStyle () {
      const m = this.marquee
      const x = Math.min(m.x0, m.x1)
      const y = Math.min(m.y0, m.y1)
      const w = Math.abs(m.x1 - m.x0)
      const h = Math.abs(m.y1 - m.y0)
      return { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' }
    }
  },
  created () {
    this.refresh()
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$on('comp-tree-refresh', this.refresh)
      this.$root.eventBus.$on('comp-tree-add-selected', this.emitAdd)
    }
  },
  beforeDestroy () {
    if (this.$root && this.$root.eventBus) {
      this.$root.eventBus.$off('comp-tree-refresh', this.refresh)
      this.$root.eventBus.$off('comp-tree-add-selected', this.emitAdd)
    }
    window.removeEventListener('mousemove', this.onMarqueeMove)
    window.removeEventListener('mouseup', this.onMarqueeEnd)
  },
  methods: {
    hasChildren (node) {
      return (node.type === 'folder') ||
        (node.refs && node.refs.length > 0) ||
        this.nodes.some((n) => n.parentId === node.id)
    },
    refresh () {
      if (this.busy) return
      this.busy = true
      const prev = this.selectedNodes.map((n) => ({ name: n.name, index: n.index }))
      sourceAdapter.list()
        .then((list) => {
          this.nodes = (list || []).map(normalizeCompNode)
          // 默认全部展开
          const exp = {}
          this.nodes.forEach((n) => { exp[n.id] = true })
          this.expandedMap = exp
          const next = {}
          this.nodes.forEach((n) => {
            const hit = prev.some((p) => p.index === n.index && p.name === n.name)
            if (hit) { next[n.id] = true }
          })
          this.selectedMap = next
          this.$emit('loaded', this.nodes.length)
        })
        .catch((e) => {
          this.$emit('error', e)
          try {
            var noticeMod = require('../../ui-next/notice')
            var n = noticeMod.default || noticeMod
            if (n && n.warning) {
              n.warning('合成树刷新失败: ' + ((e && e.message) || e))
            }
          } catch (e2) { /* ignore */ }
        })
        .then(() => {
          this.busy = false
        })
    },
    /** 点击行：折叠/展开，不切换选中 */
    onRowClick (node) {
      this.toggleExpand(node)
    },
    toggleExpand (node) {
      if (!this.hasChildren(node)) return
      this.$set(this.expandedMap, node.id, !this.expandedMap[node.id])
    },
    toggleSelect (node) {
      this.$set(this.selectedMap, node.id, !this.selectedMap[node.id])
    },
    emitAdd () {
      const items = sourceAdapter.toItems(this.selectedNodes)
      this.$emit('add', items)
    },
    onRowDrag (ev, node) {
      if (!ev.dataTransfer) return
      const payload = JSON.stringify({ index: node.index, name: node.name })
      ev.dataTransfer.setData(sourceAdapter.COMP_MIME, payload)
      ev.dataTransfer.setData('text/plain', node.name)
      ev.dataTransfer.effectAllowed = 'copy'
    },
    // —— 空白拖拽框选 ——
    onMarqueeStart (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.mod-comptree__row')) return
      if (ev.button !== 0) return
      this.marquee = { active: true, x0: ev.offsetX, y0: ev.offsetY, x1: ev.offsetX, y1: ev.offsetY }
      window.addEventListener('mousemove', this.onMarqueeMove)
      window.addEventListener('mouseup', this.onMarqueeEnd)
    },
    onMarqueeMove (ev) {
      if (!this.marquee.active) return
      const el = this.$el
      const rect = el.getBoundingClientRect()
      this.marquee.x1 = ev.clientX - rect.left
      this.marquee.y1 = ev.clientY - rect.top
    },
    onMarqueeEnd () {
      if (!this.marquee.active) return
      const box = this.marquee
      this.marquee = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 }
      window.removeEventListener('mousemove', this.onMarqueeMove)
      window.removeEventListener('mouseup', this.onMarqueeEnd)
      const el = this.$el
      if (!el) return
      const rows = el.querySelectorAll('.mod-comptree__row')
      const next = Object.assign({}, this.selectedMap)
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i].getBoundingClientRect()
        const host = el.getBoundingClientRect()
        const x = r.left - host.left
        const y = r.top - host.top
        const hit = x < Math.max(box.x0, box.x1) && x + r.width > Math.min(box.x0, box.x1) &&
          y < Math.max(box.y0, box.y1) && y + r.height > Math.min(box.y0, box.y1)
        const id = rows[i].getAttribute('data-id')
        if (id && hit) { next[id] = true }
      }
      this.selectedMap = next
    }
  }
}
</script>

<style lang="scss" scoped>
.mod-comptree {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: auto;
  user-select: none;
}
.mod-comptree__empty {
  padding: 16px 8px;
  font-size: 12px;
  opacity: 0.55;
  text-align: center;
}
.mod-comptree__list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}
.mod-comptree__row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 2px 8px 2px 8px;
  cursor: default;
}
.mod-comptree__row:hover {
  background: rgba(128, 128, 128, 0.08);
}
.mod-comptree__row.is-on {
  background: var(--is-accent-soft, rgba(200, 245, 66, 0.18));
}
.mod-comptree__twisty {
  width: 12px;
  font-size: 10px;
  opacity: 0.7;
  transition: transform 0.12s ease;
}
.mod-comptree__twisty.is-open {
  transform: rotate(90deg);
}
.mod-comptree__twisty--leaf {
  opacity: 0;
}
.mod-comptree__meta {
  min-width: 0;
  flex: 1;
}
.mod-comptree__name {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mod-comptree__sub {
  font-size: 11px;
  opacity: 0.55;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mod-comptree__marquee {
  position: absolute;
  border: 1px solid var(--is-accent, #c8f542);
  background: rgba(200, 245, 66, 0.12);
  pointer-events: none;
  z-index: 2;
}
</style>
