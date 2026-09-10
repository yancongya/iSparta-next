<template>
  <is-shell>
    <template #top-actions>
      <span class="is-hint">设计壳 · T1</span>
    </template>

    <template #queue>
      <is-drop-zone
        v-if="!items.length"
        @drop="onDrop"
        @pick="onPick"
      />
      <div v-else class="is-queue">
        <div class="is-queue__head">
          <span>任务队列（{{ items.length }}）</span>
          <button type="button" class="is-link" @click="onPick">继续添加…</button>
        </div>
        <ul class="is-queue__list">
          <li v-for="(item, index) in items" :key="index" class="is-queue__row">
            <span class="is-badge" :data-type="item.basic && item.basic.type">
              {{ (item.basic && item.basic.type) || '?' }}
            </span>
            <span class="is-queue__path" :title="item.basic && item.basic.inputPath">
              {{ shortPath(item.basic && item.basic.inputPath) }}
            </span>
            <span class="is-queue__files">
              {{ (item.basic && item.basic.fileList && item.basic.fileList.length) || 0 }} 帧
            </span>
          </li>
        </ul>
      </div>
    </template>

    <template #side>
      <h3 class="is-side-title">输出设置</h3>
      <p class="is-side-empty">选择任务后可在此配置格式与转换参数（T3）。</p>
    </template>

    <template #bottom>
      <span>输入的项目（{{ items.length }}）</span>
      <span class="is-hint">保留 store / ispartaAPI / processor 接口</span>
    </template>
  </is-shell>
</template>

<script>
import IsShell from '../components/AppShell.vue'
import IsDropZone from '../components/DropZone.vue'
import { f as fsOperate } from '../../components/drag/file.js'
import { ipc } from '../../util/node-env'

export default {
  name: 'UiNextHome',
  components: { IsShell, IsDropZone },
  computed: {
    items () {
      return this.$store.getters.getterItems
    }
  },
  methods: {
    shortPath (p) {
      if (!p || typeof p !== 'string') { return '—' }
      const parts = p.split(/[\\/]/).filter(Boolean)
      return parts.slice(-3).join('/')
    },
    onPick () {
      ipc.invoke('dialog:openFiles', {
        properties: ['openFile', 'openDirectory', 'multiSelections']
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return }
        this.importPaths(result.filePaths)
      }).catch((e) => {
        console.error('open dialog failed', e)
      })
    },
    onDrop (ev) {
      const files = ev.dataTransfer && ev.dataTransfer.files
      if (!files || !files.length) { return }
      this.importPaths(files)
    },
    importPaths (list) {
      fsOperate.readerFiles(list).then((ars) => {
        for (var i in ars) {
          ars[i].basic.fileList.sort((a, b) => {
            const _a = a.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
            const _b = b.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
            return _a > _b ? 1 : -1
          })
          this.$store.dispatch('add', {
            basic: ars[i].basic,
            options: ars[i].options
          })
        }
      }).catch((e) => {
        console.error('import failed', e)
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.is-hint {
  font-size: 11px;
  color: var(--is-text-muted);
  font-family: var(--is-mono);
}

.is-queue {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--is-space-3);
    font-size: 13px;
    color: var(--is-text-secondary);
  }

  &__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--is-space-2);
  }

  &__row {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: var(--is-space-3);
    align-items: center;
    padding: var(--is-space-3);
    border-radius: var(--is-radius-sm);
    background: var(--is-card);
    border: 1px solid var(--is-border);
  }

  &__path {
    font-size: 12px;
    color: var(--is-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__files {
    font-size: 11px;
    color: var(--is-text-muted);
    font-family: var(--is-mono);
  }
}

.is-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: rgba(74, 108, 247, 0.15);
  color: var(--is-accent);
  border: 1px solid rgba(74, 108, 247, 0.3);

  &[data-type='APNG'] {
    background: rgba(40, 167, 69, 0.12);
    color: #6fdb8a;
    border-color: rgba(40, 167, 69, 0.35);
  }

  &[data-type='GIF'] {
    background: rgba(240, 173, 78, 0.12);
    color: #f5c46a;
    border-color: rgba(240, 173, 78, 0.35);
  }
}

.is-link {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--is-brand);
  cursor: pointer;
  font-size: 12px;
  padding: 0;

  &:hover {
    color: var(--is-accent);
  }
}

.is-side-title {
  margin: 0 0 var(--is-space-3);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--is-text);
}

.is-side-empty {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--is-text-muted);
}
</style>
