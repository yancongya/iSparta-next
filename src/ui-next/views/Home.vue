<template>
  <div class="ib" :class="[themeClass, { 'ib--empty': !items.length }]">
    <!-- ========== 空态 ========== -->
    <section v-if="!items.length" class="ib-import">
      <header class="ib-top">
        <div class="ib-logo"><span class="ib-logo__glyph">▣</span><span class="ib-logo__name">iSparta</span></div>
        <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
          <span class="ib-iconbtn__i">{{ theme === 'dark' ? '☀' : '☾' }}</span>
        </button>
      </header>
      <div
        class="ib-drop"
        :class="{ 'ib-drop--hot': drag }"
        @dragover.prevent="drag = true"
        @dragleave.prevent="drag = false"
        @drop.prevent="onDrop"
        @click="onPick"
      >
        <div class="ib-drop__kicker">DROP · PASTE · CLICK</div>
        <h1>把序列帧压进流水线</h1>
        <p>PNG 序列 · APNG · GIF</p>
        <div class="ib-drop__cta">选择文件 / 目录</div>
      </div>
    </section>

    <!-- ========== 工作台：左列表 + 中预览 + 右设置 ========== -->
    <section v-else class="ib-ws">
      <header class="ib-top ib-top--ws">
        <div class="ib-logo"><span class="ib-logo__glyph">▣</span><span class="ib-logo__name">iSparta</span></div>
        <div class="ib-top__actions">
          <button type="button" class="ib-iconbtn" title="输出设置" @click="settingsOpen = !settingsOpen">
            <span class="ib-iconbtn__i">⚙</span>
          </button>
          <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
            <span class="ib-iconbtn__i">{{ theme === 'dark' ? '☀' : '☾' }}</span>
          </button>
        </div>
      </header>

      <div class="ib-body">
        <!-- 左：任务封面列表 -->
        <aside class="ib-list">
          <div class="ib-list__scroll">
            <button
              v-for="(item, index) in items"
              :key="index"
              type="button"
              class="ib-card"
              :class="{ 'ib-card--on': index === selected }"
              @click="selectTab(index)"
              @mouseenter="startHover(index)"
              @mouseleave="stopHover"
            >
              <div class="ib-card__cover">
                <img v-if="coverSrc(item, index)" :src="coverSrc(item, index)" alt="" />
                <span v-else class="ib-card__ph">{{ typeOf(item) }}</span>
                <span class="ib-card__type" :data-t="typeOf(item)">{{ typeOf(item) }}</span>
              </div>
              <div class="ib-card__meta">
                <div class="ib-card__name">{{ shortName(item) }}</div>
                <div class="ib-card__sub">{{ frameCountOf(item) }} 帧 · {{ scheduleOf(item) }}</div>
              </div>
              <button
                type="button"
                class="ib-card__gear"
                title="设置此任务"
                @click.stop="openSettingsFor(index)"
              >⚙</button>
            </button>
          </div>
          <button type="button" class="ib-add" title="继续导入" @click="onPick">＋</button>
        </aside>

        <!-- 中：选中任务预览 -->
        <main class="ib-main">
          <div class="ib-focus">
            <div class="ib-focus__head">
              <span class="ib-tag" :data-t="typeOf(current)">{{ typeOf(current) }}</span>
              <div class="ib-focus__text">
                <div class="ib-focus__title">{{ nameOf(current) }}</div>
                <div class="ib-focus__path">{{ pathOf(current) }}</div>
              </div>
              <div class="ib-focus__meters">
                <div class="ib-meter"><b>{{ frameCount }}</b><span>FRAMES</span></div>
                <div class="ib-meter"><b>{{ scheduleLabel }}</b><span>STATE</span></div>
              </div>
            </div>
            <div class="ib-film">
              <div class="ib-film__track">
                <div
                  v-for="(t, i) in thumbs"
                  :key="i"
                  class="ib-cell"
                  :class="{ 'ib-cell--on': i === activeFrame }"
                  @click="activeFrame = i"
                >
                  <img v-if="t" :src="t" alt="" />
                  <em>{{ i + 1 }}</em>
                </div>
                <div v-if="!thumbs.length" class="ib-film__empty">暂无帧预览</div>
              </div>
            </div>
          </div>
        </main>

        <!-- 右：可折叠设置 -->
        <aside class="ib-side" :class="{ 'ib-side--shut': !settingsOpen }">
          <button type="button" class="ib-side__icon" :title="settingsOpen ? '收起设置' : '展开设置'" @click="settingsOpen = !settingsOpen">
            {{ settingsOpen ? '›' : '‹' }}
          </button>
          <div v-show="settingsOpen" class="ib-side__body">
            <div class="ib-side__title">输出设置</div>
            <div class="ib-lab">输出格式</div>
            <div class="ib-chips">
              <button
                v-for="f in allFormats"
                :key="f"
                type="button"
                class="ib-chip"
                :class="{ 'ib-chip--on': formats.indexOf(f) > -1 }"
                @click="toggleFormat(f)"
              >{{ f }}</button>
            </div>
            <template v-if="typeOf(current) === 'PNGs'">
              <div class="ib-lab">帧频 / 循环</div>
              <div class="ib-rows">
                <label class="ib-num"><span>FPS</span><input type="number" min="1" max="100" v-model.number="fps" @change="pushOptions" /></label>
                <label class="ib-num"><span>LOOP</span><input type="number" min="0" v-model.number="loop" @change="pushOptions" /></label>
              </div>
            </template>
            <div class="ib-lab">输出名</div>
            <input class="ib-text" type="text" v-model="outputName" @change="pushOptions" />
            <div class="ib-lab">压缩质量</div>
            <label class="ib-quality">
              <input type="checkbox" v-model="qualityOn" @change="pushOptions" />
              <span>Quality</span>
              <input type="number" min="0" max="100" v-model.number="quality" @change="pushOptions" />
            </label>
            <button type="button" class="ib-go" :disabled="!formats.length || busy" @click="startConvert">
              {{ busy ? '转换中…' : '开始' }}
            </button>
            <div class="ib-prog" v-if="busy || progress > 0">
              <div class="ib-prog__bar" :style="{ width: progress + '%' }"></div>
            </div>
          </div>
        </aside>
      </div>

      <footer class="ib-status">
        <span>任务 {{ items.length }}</span>
        <span class="ib-status__grow"></span>
        <button type="button" class="ib-ghost ib-ghost--del" title="删除当前" @click="removeCurrent">删除当前</button>
      </footer>
    </section>
  </div>
</template>

<script>
import { f as fsOperate } from '../../components/drag/file.js'
import { ipc } from '../../util/node-env'
import processor from '../../util/processor'

const ALL_FORMATS = ['APNG', 'GIF', 'WEBP']

export default {
  name: 'UiNextHome',
  data () {
    return {
      theme: 'dark',
      drag: false,
      settingsOpen: true,
      selected: 0,
      activeFrame: 0,
      formats: [],
      fps: 25,
      loop: 0,
      outputName: '',
      qualityOn: false,
      quality: 80,
      thumbs: [],
      hoverIdx: -1,
      hoverTimer: null,
      hoverFrame: 0,
      busy: false
    }
  },
  computed: {
    themeClass () {
      return this.theme === 'light' ? 'is-theme-light' : 'is-theme-dark'
    },
    themeTitle () {
      return this.theme === 'dark' ? '切换到亮色' : '切换到暗色'
    },
    items () {
      return this.$store.getters.getterItems
    },
    current () {
      return this.items[this.selected] || null
    },
    allFormats () {
      return ALL_FORMATS
    },
    frameCount () {
      return this.frameCountOf(this.current)
    },
    scheduleLabel () {
      return this.scheduleOf(this.current)
    },
    progress () {
      const p = this.current && this.current.process
      if (!p) { return 0 }
      if (p.schedule === 1 || p.schedule === -1) { return 100 }
      if (p.schedule > 0 && p.schedule < 1) { return Math.round(p.schedule * 100) }
      return 0
    }
  },
  watch: {
    selected () {
      this.syncFromItem()
      this.loadThumbs()
    },
    items () {
      if (this.selected >= this.items.length) {
        this.selected = Math.max(0, this.items.length - 1)
      }
      this.syncFromItem()
    },
    'current.process.schedule' () {
      this.syncBusy()
    }
  },
  created () {
    try {
      const t = window.storage && window.storage.getItem('uiTheme')
      if (t === 'light' || t === 'dark') { this.theme = t }
      const s = window.storage && window.storage.getItem('uiSettingsOpen')
      if (s === '0') { this.settingsOpen = false }
    } catch (e) { /* ignore */ }
    this.syncFromItem()
  },
  mounted () {
    this.loadThumbs()
    window.addEventListener('paste', this.onPaste)
  },
  beforeDestroy () {
    window.removeEventListener('paste', this.onPaste)
    this.stopHover()
  },
  methods: {
    /* ---------- theme ---------- */
    toggleTheme () {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
      try {
        if (window.storage) { window.storage.setItem('uiTheme', this.theme) }
      } catch (e) { /* ignore */ }
    },
    /* ---------- items ---------- */
    typeOf (item) {
      return (item && item.basic && item.basic.type) || '?'
    },
    shortName (item) {
      const p = this.pathOf(item)
      const segs = p.split(/[\\/]/).filter(Boolean)
      return segs[segs.length - 1] || this.typeOf(item)
    },
    nameOf (item) {
      return (item && item.options && item.options.outputName) || this.shortName(item)
    },
    pathOf (item) {
      return (item && item.basic && item.basic.inputPath) || '—'
    },
    frameCountOf (item) {
      return (item && item.basic && item.basic.fileList && item.basic.fileList.length) || 0
    },
    scheduleOf (item) {
      const p = item && item.process
      if (!p) { return 'IDLE' }
      if (p.schedule === 1) { return 'OK' }
      if (p.schedule === -1) { return 'FAIL' }
      if (p.schedule > 0 && p.schedule < 1) { return Math.round(p.schedule * 100) + '%' }
      return 'IDLE'
    },
    mediaUrl (p) {
      if (!p) { return '' }
      const norm = String(p).replace(/\\/g, '/')
      const withSlash = norm.charAt(0) === '/' ? norm : '/' + norm
      return 'isparta-file://' + encodeURI(withSlash).replace(/#/g, '%23')
    },
    coverSrc (item, index) {
      const list = item && item.basic && item.basic.fileList
      if (!list || !list.length) { return '' }
      if (this.hoverIdx === index) {
        const i = this.hoverFrame % Math.min(list.length, 48)
        return this.mediaUrl(list[i])
      }
      return this.mediaUrl(list[0])
    },
    startHover (index) {
      this.stopHover()
      this.hoverIdx = index
      this.hoverFrame = 0
      this.hoverTimer = setInterval(() => {
        this.hoverFrame += 1
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
    selectTab (index) {
      this.selected = index
      this.$store.dispatch('singleSelect', index)
      this.syncFromItem()
      this.loadThumbs()
    },
    openSettingsFor (index) {
      this.selectTab(index)
      this.settingsOpen = true
    },
    removeCurrent () {
      if (!this.current) { return }
      this.$store.dispatch('singleSelect', this.selected)
      this.$store.dispatch('remove')
      this.selected = Math.max(0, Math.min(this.selected, this.items.length - 1))
    },
    syncBusy () {
      const p = this.current && this.current.process
      this.busy = !!(p && p.schedule > 0 && p.schedule < 1)
    },
    syncFromItem () {
      const o = this.current && this.current.options
      if (!o) {
        this.formats = []
        this.syncBusy()
        return
      }
      this.formats = (o.outputFormat || []).slice()
      this.fps = o.frameRate || 25
      this.loop = o.loop || 0
      this.outputName = o.outputName || ''
      if (o.quality) {
        this.qualityOn = !!o.quality.checked
        this.quality = o.quality.value != null ? o.quality.value : 80
      }
      this.syncBusy()
    },
    pushOptions () {
      if (!this.current) { return }
      this.$store.dispatch('editOptions', {
        outputFormat: this.formats.slice(),
        frameRate: this.fps,
        loop: this.loop,
        outputName: this.outputName,
        quality: {
          checked: this.qualityOn,
          value: this.quality
        }
      })
    },
    toggleFormat (f) {
      const i = this.formats.indexOf(f)
      if (i > -1) { this.formats.splice(i, 1) } else { this.formats.push(f) }
      this.pushOptions()
    },
    /* ---------- import ---------- */
    onPick () {
      ipc.invoke('dialog:openFiles', {
        properties: ['openFile', 'openDirectory', 'multiSelections']
      }).then((result) => {
        if (!result || result.canceled || !result.filePaths.length) { return }
        this.importPaths(result.filePaths)
      }).catch((e) => { console.error(e) })
    },
    onDrop (ev) {
      this.drag = false
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
        this.selected = Math.max(0, this.items.length - 1)
      }).catch((e) => { console.error(e) })
    },
    loadThumbs () {
      this.activeFrame = 0
      const list = this.current && this.current.basic && this.current.basic.fileList
      if (!list || !list.length) {
        this.thumbs = []
        return
      }
      const max = Math.min(list.length, 48)
      const out = []
      for (let i = 0; i < max; i++) {
        out.push(this.mediaUrl(list[i]))
      }
      this.thumbs = out
    },
    startConvert () {
      if (!this.formats.length || !this.current) { return }
      this.pushOptions()
      this.busy = true
      const locale = this.$i18n && this.$i18n.messages && this.$i18n.messages[this.$i18n.locale]
      this.$store.dispatch('editProcess', { index: 0, text: '', schedule: 0 })
      setTimeout(() => {
        this.$store.dispatch('setLock', true)
        processor(this.$store, '', locale).then(() => {
          this.busy = false
          this.syncFromItem()
        }).catch((err) => {
          console.warn('convert error', err)
          this.busy = false
          this.$store.dispatch('setLock', false)
        })
      }, 20)
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

.ib-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 14px;
  flex: 0 0 auto;

  &--ws {
    border-bottom: 1px solid var(--is-border);
    background: var(--is-panel);
  }

  &__actions {
    display: flex;
    gap: 8px;
  }
}

.ib-logo {
  display: flex;
  align-items: center;
  gap: 8px;

  &__glyph {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    background: var(--is-accent);
    color: var(--is-bg);
    font-size: 11px;
  }

  &__name {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
  }
}

.ib-iconbtn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text);
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    border-color: var(--is-border-hi);
    color: var(--is-accent);
  }

  &__i {
    font-size: 14px;
    line-height: 1;
  }
}

/* import */
.ib-import {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ib-drop {
  flex: 1;
  margin: 12px 16px 16px;
  border-radius: 16px;
  border: 1px dashed var(--is-border-hi);
  background: var(--is-panel);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-align: center;
  padding: 24px;

  &:hover, &--hot {
    box-shadow: var(--is-glow);
  }

  h1 {
    margin: 10px 0 6px;
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0 0 18px;
    color: var(--is-text-2);
    font-size: 13px;
  }

  &__kicker {
    font-family: var(--is-mono);
    font-size: 11px;
    letter-spacing: 0.22em;
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

/* workspace */
.ib-ws {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ib-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* left list */
.ib-list {
  width: 280px;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--is-border);
  background: var(--is-panel);
  min-height: 0;

  &__scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    /* 自定义滚动条 */
    scrollbar-width: thin;
    scrollbar-color: var(--is-border-hi) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--is-border-hi);
      border-radius: 999px;
    }
  }
}

.ib-card {
  appearance: none;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  border-radius: 12px;
  padding: 8px;
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px;
  align-items: center;
  cursor: pointer;
  text-align: left;
  color: inherit;
  position: relative;

  &:hover {
    border-color: var(--is-border-hi);
    background: var(--is-card-hi);
  }

  &--on {
    border-color: var(--is-accent);
    box-shadow: 0 0 0 1px var(--is-accent-dim);
  }

  &__cover {
    width: 72px;
    height: 72px;
    border-radius: 8px;
    overflow: hidden;
    background: #000;
    position: relative;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  }

  &__ph {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: 10px;
    color: var(--is-text-3);
  }

  &__type {
    position: absolute;
    left: 4px;
    top: 4px;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.55);
    color: var(--is-accent);

    &[data-t='APNG'] { color: var(--is-ok); }
    &[data-t='GIF'] { color: var(--is-warn); }
  }

  &__meta {
    min-width: 0;
  }

  &__name {
    font-size: 12px;
    font-weight: 650;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__sub {
    margin-top: 4px;
    font-size: 10px;
    color: var(--is-text-3);
    font-family: var(--is-mono);
  }

  &__gear {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--is-text-3);
    cursor: pointer;
    font-size: 14px;
    padding: 4px;
    border-radius: 6px;

    &:hover {
      color: var(--is-accent);
      background: var(--is-accent-soft);
    }
  }
}

.ib-add {
  flex: 0 0 auto;
  margin: 0 10px 10px;
  height: 36px;
  border-radius: 10px;
  border: 1px dashed var(--is-border-hi);
  background: transparent;
  color: var(--is-accent);
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    background: var(--is-accent-soft);
  }
}

/* main */
.ib-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--is-border-hi) transparent;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--is-border-hi);
    border-radius: 999px;
  }
}

.ib-focus {
  border: 1px solid var(--is-border);
  background: var(--is-panel);
  border-radius: 14px;
  padding: 14px;

  &__head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }

  &__text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 15px;
    font-weight: 700;
  }

  &__path {
    font-size: 11px;
    color: var(--is-text-3);
    font-family: var(--is-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__meters {
    display: flex;
    gap: 8px;
  }
}

.ib-tag {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--is-accent-dim);
  color: var(--is-accent);

  &[data-t='APNG'] { color: var(--is-ok); }
  &[data-t='GIF'] { color: var(--is-warn); }
}

.ib-meter {
  min-width: 68px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--is-card);
  border: 1px solid var(--is-border);
  text-align: center;

  b {
    display: block;
    font-size: 13px;
    font-family: var(--is-mono);
  }
  span {
    font-size: 9px;
    color: var(--is-text-3);
    letter-spacing: 0.1em;
  }
}

.ib-film {
  border: 1px solid var(--is-border);
  border-radius: 10px;
  background: var(--is-card);

  &__track {
    display: flex;
    gap: 8px;
    padding: 10px;
    overflow-x: auto;
    min-height: 100px;
    scrollbar-width: thin;
    scrollbar-color: var(--is-accent) transparent;

    &::-webkit-scrollbar {
      height: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: var(--is-accent);
      border-radius: 999px;
    }
  }

  &__empty {
    width: 100%;
    display: grid;
    place-items: center;
    color: var(--is-text-3);
    font-size: 12px;
    min-height: 80px;
  }
}

.ib-cell {
  position: relative;
  flex: 0 0 auto;
  width: 84px;
  height: 84px;
  border-radius: 8px;
  border: 1px solid var(--is-border);
  overflow: hidden;
  cursor: pointer;
  background: #000;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  em {
    position: absolute;
    left: 4px;
    bottom: 2px;
    font-style: normal;
    font-size: 10px;
    font-family: var(--is-mono);
    color: #fff;
    text-shadow: 0 1px 2px #000;
  }

  &:hover { border-color: var(--is-border-hi); }
  &--on {
    border-color: var(--is-accent);
    box-shadow: var(--is-glow);
  }
}

/* side settings */
.ib-side {
  width: 300px;
  flex: 0 0 auto;
  border-left: 1px solid var(--is-border);
  background: var(--is-panel);
  display: flex;
  min-height: 0;
  transition: width 0.18s ease;

  &--shut {
    width: 36px;
  }

  &__icon {
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
    padding: 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--is-border-hi) transparent;
  }

  &__title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-bottom: 8px;
  }
}

.ib-lab {
  font-size: 10px;
  letter-spacing: 0.14em;
  color: var(--is-text-3);
  font-family: var(--is-mono);
  margin: 14px 0 6px;
}

.ib-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ib-chip {
  appearance: none;
  border: 1px solid var(--is-border);
  background: transparent;
  color: var(--is-text-2);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;

  &:hover { border-color: var(--is-border-hi); }
  &--on {
    background: var(--is-accent);
    border-color: var(--is-accent);
    color: var(--is-bg);
  }
}

.ib-rows {
  display: flex;
  gap: 8px;
}

.ib-num {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 10px;
  color: var(--is-text-3);

  input {
    background: var(--is-card);
    border: 1px solid var(--is-border);
    color: var(--is-text);
    border-radius: 6px;
    padding: 7px;
    font-family: var(--is-mono);

    &:focus {
      outline: none;
      border-color: var(--is-accent);
    }
  }
}

.ib-text {
  width: 100%;
  box-sizing: border-box;
  background: var(--is-card);
  border: 1px solid var(--is-border);
  color: var(--is-text);
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--is-accent);
  }
}

.ib-quality {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--is-text-2);

  input[type='number'] {
    width: 64px;
    background: var(--is-card);
    border: 1px solid var(--is-border);
    color: var(--is-text);
    border-radius: 6px;
    padding: 6px;
    font-family: var(--is-mono);
  }
}

.ib-go {
  width: 100%;
  margin-top: 18px;
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 12px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  background: var(--is-accent);
  color: var(--is-bg);

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.ib-prog {
  margin-top: 10px;
  height: 4px;
  border-radius: 999px;
  background: var(--is-border);
  overflow: hidden;

  &__bar {
    height: 100%;
    background: linear-gradient(90deg, var(--is-accent), var(--is-hot));
    transition: width 0.25s ease;
  }
}

.ib-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-top: 1px solid var(--is-border);
  font-size: 11px;
  color: var(--is-text-2);
  font-family: var(--is-mono);
  background: var(--is-panel);

  &__grow { flex: 1; }
}

.ib-ghost {
  appearance: none;
  border: 1px solid var(--is-border);
  background: transparent;
  color: var(--is-text-2);
  border-radius: 999px;
  padding: 5px 12px;
  font-size: 11px;
  cursor: pointer;

  &:hover { color: var(--is-accent); border-color: var(--is-border-hi); }
  &--del:hover { color: var(--is-bad); border-color: var(--is-bad); }
}
</style>
