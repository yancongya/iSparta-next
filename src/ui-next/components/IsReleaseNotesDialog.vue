<template>
  <is-dialog
    :visible="releaseNotesState.visible"
    :title="$t('aboutReleaseNotes')"
    :width="dialogWidth"
    :root-class="rootClass"
    :panel-class="panelClass"
    @update:visible="onVisible"
  >
    <div class="rn">
      <div class="rn__head">
        <span class="rn__version">v{{ activeVersion }}</span>
        <is-select
          v-model="activeVersion"
          :options="versionOptions"
          class="rn__picker"
          :aria-label="$t('aboutReleaseNotesVersion')"
        />
      </div>

      <template v-if="notes">
        <is-scroll-fade class="upd__notes-fade" :class="{ 'is-expanded': expanded }">
          <ul class="upd__list">
            <li
              v-for="(item, i) in visibleItems"
              :key="i"
              :class="item.kind === 'group' ? 'upd__list-group' : 'upd__list-item'"
            >{{ item.text }}</li>
          </ul>
          <!-- 展开/收起链接放在滚动内容末尾，不能留在 .rn 底部：
               CEP 下滚动区吃满剩余高度，留在外面会被顶到面板最底、与日志正文隔一大截 -->
          <button
            v-if="hasDetail"
            type="button"
            class="upd__notes-toggle"
            :aria-expanded="expanded ? 'true' : 'false'"
            @click="expanded = !expanded"
          >{{ expanded ? $t('updateNotesCollapse') : $t('updateNotesExpand') }}</button>
        </is-scroll-fade>
      </template>
      <p v-else class="upd__notes-empty">{{ $t('updateNotesEmpty') }}</p>
    </div>

  </is-dialog>
</template>

<script>
/**
 * 查看版本更新日志：只读，不检查更新、不下载、不弹任何询问。
 * 内容取本地烘焙的 Release 纯文本（见 util/releaseNotes.js），离线可用；
 * 展示结构与 IsUpdateDialog 共用 .upd__list / .upd__notes-* 样式，CEP 下同样铺满面板。
 *
 * ⚠ IsDialog 默认 teleport 到 body：布局样式一律以 root-class / panel-class 为锚点，
 *   不能写 .globalsetting .rn-xxx（弹窗节点已脱离该 wrapper）。
 */
import IsDialog from './ui/IsDialog.vue'
import IsSelect from './ui/IsSelect.vue'
import IsScrollFade from './ui/IsScrollFade.vue'
import hostAdapter from '../../util/host-env'
import { notesForVersion, versionList } from '../../util/releaseNotes'
import { releaseNotesState, closeReleaseNotes } from '../releaseNotesDialog'

export default {
  name: 'IsReleaseNotesDialog',
  components: { IsDialog, IsSelect, IsScrollFade },
  data () {
    return { expanded: false }
  },
  computed: {
    releaseNotesState () { return releaseNotesState },
    isCep () { return hostAdapter.kind === 'cep' },
    dialogWidth () { return this.isCep ? '100%' : '480px' },
    rootClass () { return this.isCep ? 'rn-dialog' : '' },
    panelClass () { return this.isCep ? 'rn-panel rn-panel--full' : 'rn-panel' },
    versionOptions () {
      return versionList().map(function (v) { return { label: 'v' + v, value: v } })
    },
    activeVersion: {
      get () { return releaseNotesState.version },
      set (v) { releaseNotesState.version = v }
    },
    notes () { return notesForVersion(this.activeVersion) },
    items () {
      var raw = this.notes
      if (!raw) { return [] }
      return String(raw).split(/\r?\n/).map(function (line) {
        var t = String(line).trim()
        if (!t) { return null }
        if (/^【.+】$/.test(t)) { return { kind: 'group', text: t } }
        return { kind: 'item', text: t.replace(/^·\s*/, '') }
      }).filter(Boolean)
    },
    brief () {
      var out = []
      for (var i = 0; i < this.items.length; i++) {
        if (this.items[i].kind === 'group') { break }
        out.push(this.items[i])
      }
      return out
    },
    detailStart () {
      for (var i = 0; i < this.items.length; i++) {
        if (this.items[i].kind === 'group') { return i }
      }
      return -1
    },
    hasDetail () { return this.detailStart >= 0 },
    visibleItems () { return this.expanded ? this.items : this.brief }
  },
  watch: {
    activeVersion () { this.expanded = false }
  },
  methods: {
    onVisible (v) { if (!v) { closeReleaseNotes() } },
    onClose () { closeReleaseNotes() }
  }
}
</script>

<style lang="scss">
/* teleport 到 body 后只有弹窗自身类名可靠，作用域全部以 rn-dialog / rn-panel 起头 */
.rn-panel {
  border-radius: var(--is-r-xl);
  // IsDialog.open() 会 panel.focus()；CEP 下默认 focus ring 变成整圈亮色描边，
  // 这个弹窗只用右上角 X 关闭，不需要可见的键盘焦点框
  outline: none;
}

.is-dialog.rn-dialog {
  padding: 6px;
}

/* CEP 下上下左右都铺满，滚动收进弹窗内部：
   body 不再自己滚（overflow:hidden），剩余高度全部给 .rn > .upd__notes-fade，
   由 IsScrollFade 承担滚动，滚动条贯穿整个内容区，底部不再出现面板级空白。 */
.is-dialog__panel.rn-panel--full {
  width: 100%;
  height: calc(100vh - 12px);
  max-height: calc(100vh - 12px);
}

.rn-panel .is-dialog__body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: var(--is-s-5) var(--is-s-6);
}

/* 兜底：即使 HMR 残留旧的 footer slot（CEP 面板不会自动重载），也不留底部条/按钮 */
.rn-panel .is-dialog__footer {
  display: none;
}

.rn {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--is-s-3);
}

.rn__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: var(--is-s-3);
}

/* 覆盖 .upd__notes-fade 的固定 200px / 46vh：CEP 下吃满剩余高度并内部滚动 */
.rn-panel .upd__notes-fade {
  flex: 1;
  max-height: none;

  &.is-expanded {
    max-height: none;
  }
}

.rn__version {
  color: var(--is-text-2);
  font-size: var(--is-fs-sm);
  font-weight: var(--is-fw-semi);
}

.rn__picker {
  max-width: 150px;
}
</style>
