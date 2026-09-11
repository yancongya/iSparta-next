<template>
  <div class="ib" :class="themeClass">
    <globalsetting></globalsetting>
    <!-- 空态：无任务时全屏导入 -->
    <section v-if="!items.length" class="ib-import">
      <div class="ib-import__top">
        <span class="ib-brand">iSparta</span>
        <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
          {{ theme === 'dark' ? '☀' : '☾' }}
        </button>
      </div>
      <div
        class="ib-drop"
        @dragover.prevent
        @drop.prevent="onDrop"
        @click="onPick"
      >
        <p class="ib-drop__kicker">DROP · PASTE · CLICK</p>
        <h1>拖入 PNG 序列 / APNG / GIF</h1>
        <div class="ib-drop__cta">打开目录…</div>
      </div>
    </section>

    <!-- 有任务：与原版相同的 中列表 + 右设置 两栏 -->
    <section
      v-else
      class="ib-ws"
      @dragover.prevent
      @drop.prevent="onDrop"
    >
      <div class="ib-main">
        <project-list></project-list>
        <sort-bar></sort-bar>
      </div>

      <div class="ib-side" :class="{ 'ib-side--shut': !settingsOpen }">
        <button
          type="button"
          class="ib-side__fold"
          :title="settingsOpen ? '收起输出设置' : '展开输出设置'"
          @click="toggleSettings"
        >{{ settingsOpen ? '›' : '‹' }}</button>
        <div v-show="settingsOpen" class="ib-side__body">
          <div class="ib-side__theme">
            <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
              {{ theme === 'dark' ? '☀' : '☾' }}
            </button>
          </div>
          <setting></setting>
        </div>
      </div>
    </section>
  </div>
</template>

<script>
import projectList from '../../components/projectList/projectList.vue'
import setting from '../../components/setting/setting.vue'
import sortBar from '../../components/sortBar/sortBar.vue'
import globalSetting from '../../components/globalSetting/globalSetting.vue'
import { f as fsOperate } from '../../components/drag/file.js'

export default {
  name: 'UiNextHome',
  components: {
    'project-list': projectList,
    'setting': setting,
    'sort-bar': sortBar,
    'globalsetting': globalSetting
  },
  data () {
    return {
      drag: false,
      settingsOpen: true,
      theme: 'dark'
    }
  },
  computed: {
    items () {
      return this.$store.getters.getterItems
    },
    themeClass () {
      return this.theme === 'light' ? 'is-theme-light' : 'is-theme-dark'
    },
    themeTitle () {
      return this.theme === 'dark' ? '切换到亮色' : '切换到暗色'
    }
  },
  created () {
    try {
      const t = window.storage && window.storage.getItem('uiTheme')
      if (t === 'light' || t === 'dark') { this.theme = t }
    } catch (e) { /* ignore */ }
  },
  mounted () {
    window.addEventListener('paste', this.onPaste)
  },
  beforeDestroy () {
    window.removeEventListener('paste', this.onPaste)
  },
  methods: {
    toggleTheme () {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      try {
        if (window.storage) { window.storage.setItem('uiTheme', this.theme) }
      } catch (e) { /* ignore */ }
    },
    toggleSettings () {
      this.settingsOpen = !this.settingsOpen
    },
    onPick () {
      const ipc = window.ispartaAPI && window.ispartaAPI.ipc
      if (!ipc) { return }
      ipc.invoke('dialog:openFiles', {
        properties: ['openFile', 'openDirectory', 'multiSelections']
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return }
        this.importPaths(result.filePaths)
      }).catch((e) => { console.error(e) })
    },
    onDrop (ev) {
      const files = ev.dataTransfer && ev.dataTransfer.files
      if (files && files.length) { this.importPaths(files) }
    },
    onPaste (ev) {
      const cd = ev.clipboardData
      if (!cd || !cd.files || !cd.files.length) { return }
      this.importPaths(cd.files)
    },
    importPaths (list) {
      fsOperate.readerFiles(list).then((ars) => {
        for (var i in ars) {
          ars[i].basic.fileList.sort((a, b) => {
            const _a = a.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
            const _b = b.replace(/(\d+)/g, (e) => '0'.repeat(8 - Math.min(e.length, 8)) + e)
            return _a > _b ? 1 : -1
          })
          this.$store.dispatch('add', { basic: ars[i].basic, options: ars[i].options })
        }
      }).catch((e) => { console.error(e) })
    }
  }
}
</script>

<style lang="scss" scoped>
.ib {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: var(--is-bg);
  color: var(--is-text);
  font-family: var(--is-font);
  transition: background 0.2s ease, color 0.2s ease;
}

/* —— 空态 —— */
.ib-import {
  height: 100%;
  display: flex;
  flex-direction: column;

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
  }
}

.ib-brand {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
}

.ib-iconbtn {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text);
  cursor: pointer;

  &:hover {
    color: var(--is-accent);
    border-color: var(--is-border-hi);
  }
}

.ib-drop {
  flex: 1;
  margin: 0 16px 16px;
  border-radius: 14px;
  border: 1px dashed var(--is-border-hi);
  background: var(--is-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-align: center;

  &:hover { box-shadow: var(--is-glow); }

  h1 {
    margin: 8px 0 18px;
    font-size: 22px;
    font-weight: 800;
  }

  &__kicker {
    margin: 0;
    font-family: var(--is-mono);
    font-size: 11px;
    letter-spacing: 0.2em;
    color: var(--is-accent);
  }

  &__cta {
    padding: 10px 18px;
    border-radius: 999px;
    background: var(--is-accent);
    color: var(--is-bg);
    font-weight: 700;
    font-size: 13px;
  }
}

/* —— 工作区：与原版 wrap-main / wrap-side 一致的两栏 —— */
.ib-ws {
  height: 100%;
  display: flex;
}

.ib-main {
  flex: 1 1 70%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  position: relative;

  :deep(.mod-list) {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }

  :deep(.mod-list .item) {
    border-bottom-color: var(--is-border);
    color: var(--is-text);
    background: transparent;
  }

  :deep(.mod-list .item.active),
  :deep(.mod-list .item:hover) {
    background: var(--is-card-hi) !important;
  }

  :deep(.mod-list .open-folder) {
    color: var(--is-accent);
  }

  :deep(.mod-list .inputPath),
  :deep(.mod-list .outputPath) {
    color: var(--is-text-2);
  }

  :deep(.mod-bar) {
    position: relative;
    left: auto;
    bottom: auto;
    width: auto;
    background: var(--is-panel);
    border-color: var(--is-border);
    color: var(--is-text-2);
  }
}

.ib-side {
  flex: 0 0 300px;
  display: flex;
  border-left: 1px solid var(--is-border);
  background: var(--is-panel);
  min-height: 0;
  transition: flex-basis 0.18s ease;

  &--shut {
    flex-basis: 36px;
  }

  &__fold {
    flex: 0 0 36px;
    appearance: none;
    border: 0;
    border-right: 1px solid var(--is-border);
    background: transparent;
    color: var(--is-text-2);
    cursor: pointer;
    font-size: 16px;

    &:hover { color: var(--is-accent); }
  }

  &__body {
    flex: 1;
    min-width: 0;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }

  &__theme {
    display: flex;
    justify-content: flex-end;
    padding: 8px 10px 0;
    flex: 0 0 auto;
  }

  :deep(.mod-setting) {
    color: var(--is-text);
    flex: 1;
    min-height: 0;
  }

  :deep(.mod-setting h3),
  :deep(.mod-setting p),
  :deep(.mod-setting label),
  :deep(.mod-setting .el-form-item__label) {
    color: var(--is-text-2);
  }

  :deep(.mod-setting .el-input__inner) {
    background: var(--is-card);
    border-color: var(--is-border);
    color: var(--is-text);
  }
}
</style>
