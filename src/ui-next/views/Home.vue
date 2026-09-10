<template>
  <div
    class="ib"
    :class="['ib--' + theme, { 'ib--empty': !items.length }]"
  >
    <!-- ===== 空态：全屏导入 ===== -->
    <section v-if="!items.length" class="ib-import">
      <div class="ib-noise" aria-hidden="true"></div>
      <header class="ib-top">
        <div class="ib-logo">
          <span class="ib-logo__glyph">▣</span>
          <div>
            <div class="ib-logo__name">iSparta</div>
            <div class="ib-logo__sub">NEXT · SEQUENCE PRESS</div>
          </div>
        </div>
        <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
          {{ theme === 'dark' ? '☼' : '☾' }}
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
        <div class="ib-drop__rings" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class="ib-drop__copy">
          <div class="ib-drop__kicker">DROP · PASTE · CLICK</div>
          <h1>把序列帧<br />压进流水线</h1>
          <p>PNG 序列 · APNG · GIF · 拖文件夹 / 粘贴文件 / 点击选择</p>
          <div class="ib-drop__cta">选择文件 / 目录</div>
          <ul class="ib-drop__pills">
            <li>本地转换</li>
            <li>帧序自然排序</li>
            <li>APNG · GIF · WEBP</li>
          </ul>
        </div>
        <div class="ib-drop__ticker" aria-hidden="true">
          <span>APNG</span><span>GIF</span><span>WEBP</span><span>PNGs</span>
          <span>APNG</span><span>GIF</span><span>WEBP</span><span>PNGs</span>
        </div>
      </div>

      <footer class="ib-foot">
        <span>Ctrl 拖文件夹即可批量</span>
        <span class="ib-foot__sep">/</span>
        <span>接口：store · ispartaAPI · processor</span>
      </footer>
    </section>

    <!-- ===== 工作台 ===== -->
    <section v-else class="ib-ws">
      <div class="ib-noise" aria-hidden="true"></div>

      <header class="ib-top ib-top--ws">
        <div class="ib-logo">
          <span class="ib-logo__glyph">▣</span>
          <div class="ib-logo__name">iSparta</div>
        </div>

        <nav class="ib-tabs">
          <button
            v-for="(item, index) in items"
            :key="index"
            type="button"
            class="ib-tab"
            :class="{ 'ib-tab--on': index === selected }"
            @click="selected = index"
          >
            <i class="ib-tab__pip" :data-t="typeOf(item)"></i>
            <span>{{ shortName(item) }}</span>
          </button>
          <button type="button" class="ib-tab ib-tab--add" @click="onPick">＋</button>
        </nav>

        <div class="ib-top__right">
          <button type="button" class="ib-iconbtn" :title="themeTitle" @click="toggleTheme">
            {{ theme === 'dark' ? '☼' : '☾' }}
          </button>
        </div>
      </header>

      <div class="ib-body">
        <!-- 中央舞台 -->
        <div class="ib-stage">
          <div class="ib-card ib-focus">
            <div class="ib-focus__bar">
              <span class="ib-tag" :data-t="typeOf(current)">{{ typeOf(current) }}</span>
              <div class="ib-focus__text">
                <div class="ib-focus__title">{{ nameOf(current) }}</div>
                <div class="ib-focus__path">{{ pathOf(current) }}</div>
              </div>
              <div class="ib-focus__meters">
                <div class="ib-meter">
                  <b>{{ frameCount }}</b><span>FRAMES</span>
                </div>
                <div class="ib-meter">
                  <b>{{ scheduleLabel }}</b><span>STATE</span>
                </div>
              </div>
            </div>

            <!-- 胶片条（可折叠） -->
            <div class="ib-filmwrap" :class="{ 'ib-filmwrap--shut': filmShut }">
              <button type="button" class="ib-fold" @click="filmShut = !filmShut">
                <span>FILM STRIP</span>
                <span class="ib-fold__chev">{{ filmShut ? '▸' : '▾' }}</span>
              </button>
              <div v-show="!filmShut" class="ib-film">
                <button
                  v-for="(t, i) in thumbs"
                  :key="i"
                  type="button"
                  class="ib-cell"
                  :class="{ 'ib-cell--on': i === activeFrame }"
                  @click="activeFrame = i"
                >
                  <img v-if="t" :src="t" alt="" />
                  <em>{{ i + 1 }}</em>
                </button>
                <div v-if="!thumbs.length" class="ib-film__empty">暂无缩略图</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧可折叠参数舱 -->
        <aside class="ib-side" :class="{ 'ib-side--shut': sideShut }">
          <button type="button" class="ib-side__toggle" @click="sideShut = !sideShut">
            <span>{{ sideShut ? '参数' : '输出参数' }}</span>
            <span>{{ sideShut ? '‹' : '›' }}</span>
          </button>

          <div v-show="!sideShut" class="ib-side__body">
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
                <label class="ib-num">
                  <span>FPS</span>
                  <input type="number" min="1" max="100" v-model.number="fps" @change="pushOptions" />
                </label>
                <label class="ib-num">
                  <span>LOOP</span>
                  <input type="number" min="0" v-model.number="loop" @change="pushOptions" />
                </label>
              </div>
            </template>

            <div class="ib-lab">输出名</div>
            <input class="ib-text" type="text" v-model="outputName" @change="pushOptions" />

            <div class="ib-side__gap"></div>

            <button
              type="button"
              class="ib-go"
              :disabled="!formats.length || busy"
              @click="startConvert"
            >
              <span class="ib-go__pulse" aria-hidden="true"></span>
              {{ busy ? 'PRESS RUNNING…' : 'START PRESS' }}
            </button>
            <p class="ib-side__note">至少勾选一种格式才能启动</p>
          </div>
        </aside>
      </div>

      <footer class="ib-status">
        <span>任务 {{ items.length }}</span>
        <span class="ib-status__dots"><i v-for="n in items.length" :key="n"></i></span>
        <span class="ib-status__grow"></span>
        <button type="button" class="ib-ghost" @click="onPick">继续导入</button>
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
      filmShut: false,
      sideShut: false,
      selected: 0,
      activeFrame: 0,
      formats: [],
      fps: 25,
      loop: 0,
      outputName: '',
      thumbs: [],
      busy: false
    }
  },
  computed: {
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
      const c = this.current
      return (c && c.basic && c.basic.fileList && c.basic.fileList.length) || 0
    },
    scheduleLabel () {
      const p = this.current && this.current.process
      if (!p) { return 'IDLE' }
      if (p.schedule === 1) { return 'OK' }
      if (p.schedule === -1) { return 'FAIL' }
      if (p.schedule > 0 && p.schedule < 1) { return Math.round(p.schedule * 100) + '%' }
      return 'IDLE'
    },
    themeTitle () {
      return this.theme === 'dark' ? '切换到亮色' : '切换到暗色'
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
    }
  },
  created () {
    try {
      if (window.storage && window.storage.getItem('uiTheme') === 'light') {
        this.theme = 'light'
      }
    } catch (e) { /* ignore */ }
    this.syncFromItem()
  },
  mounted () {
    this.loadThumbs()
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
    syncFromItem () {
      const o = this.current && this.current.options
      if (!o) {
        this.formats = []
        return
      }
      this.formats = (o.outputFormat || []).slice()
      this.fps = o.frameRate || 25
      this.loop = o.loop || 0
      this.outputName = o.outputName || ''
      this.busy = !!(this.current.process && this.current.process.schedule > 0 && this.current.process.schedule < 1)
    },
    toggleFormat (f) {
      const i = this.formats.indexOf(f)
      if (i > -1) { this.formats.splice(i, 1) } else { this.formats.push(f) }
      this.pushOptions()
    },
    pushOptions () {
      if (!this.current) { return }
      this.$store.dispatch('editOptions', {
        outputFormat: this.formats.slice(),
        frameRate: this.fps,
        loop: this.loop,
        outputName: this.outputName
      })
    },
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
          this.$store.dispatch('add', {
            basic: ars[i].basic,
            options: ars[i].options
          })
        }
        this.selected = Math.max(0, this.items.length - 1)
      }).catch((e) => { console.error(e) })
    },
    loadThumbs () {
      this.thumbs = []
      this.activeFrame = 0
      const list = this.current && this.current.basic && this.current.basic.fileList
      if (!list || !list.length) { return }
      const max = Math.min(list.length, 24)
      const out = []
      for (let i = 0; i < max; i++) {
        try {
          out.push('file://' + list[i])
        } catch (e) {
          out.push('')
        }
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
  transition: background 0.25s ease, color 0.25s ease;
}

.ib-noise {
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image:
    linear-gradient(var(--is-bg-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--is-bg-grid) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse at 50% 30%, #000 20%, transparent 75%);
}

.ib-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 0;
}

.ib-top--ws {
  padding: 12px 16px;
  border-bottom: 1px solid var(--is-border);
  background: color-mix(in srgb, var(--is-panel) 88%, transparent);
  backdrop-filter: blur(10px);
  gap: 12px;
}

.ib-logo {
  display: flex;
  align-items: center;
  gap: 10px;

  &__glyph {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--is-accent);
    color: var(--is-bg);
    font-size: 14px;
    box-shadow: var(--is-glow);
  }

  &__name {
    font-size: 13px;
    font-weight: 750;
    letter-spacing: 0.14em;
  }

  &__sub {
    font-size: 9px;
    letter-spacing: 0.22em;
    color: var(--is-text-3);
    font-family: var(--is-mono);
    margin-top: 2px;
  }
}

.ib-iconbtn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text);
  cursor: pointer;
  font-size: 15px;

  &:hover {
    border-color: var(--is-border-hi);
    color: var(--is-accent);
  }
}

/* import stage */
.ib-import {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.ib-drop {
  position: relative;
  z-index: 1;
  flex: 1;
  margin: 18px;
  border-radius: 22px;
  border: 1px dashed var(--is-border-hi);
  background:
    radial-gradient(800px 320px at 50% 0%, var(--is-accent-soft), transparent 70%),
    var(--is-panel);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;

  &:hover,
  &--hot {
    transform: translateY(-2px);
    box-shadow: var(--is-glow);
  }

  &__rings {
    position: absolute;
    inset: 0;
    pointer-events: none;

    span {
      position: absolute;
      border: 1px solid var(--is-accent-dim);
      border-radius: 50%;
      animation: ib-spin 18s linear infinite;
    }

    span:nth-child(1) { width: 420px; height: 420px; left: 12%; top: 18%; }
    span:nth-child(2) { width: 280px; height: 280px; right: 14%; bottom: 16%; animation-duration: 12s; animation-direction: reverse; }
    span:nth-child(3) { width: 120px; height: 120px; right: 28%; top: 22%; animation-duration: 8s; }
  }

  &__copy {
    position: relative;
    z-index: 1;
    text-align: center;
    padding: 32px;
    max-width: 520px;
  }

  &__kicker {
    font-family: var(--is-mono);
    font-size: 11px;
    letter-spacing: 0.28em;
    color: var(--is-accent);
    margin-bottom: 14px;
  }

  h1 {
    margin: 0 0 12px;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.03em;
  }

  p {
    margin: 0 0 22px;
    color: var(--is-text-2);
    font-size: 13px;
  }

  &__cta {
    display: inline-flex;
    padding: 12px 20px;
    border-radius: 999px;
    background: var(--is-accent);
    color: var(--is-bg);
    font-weight: 750;
    font-size: 13px;
    letter-spacing: 0.06em;
  }

  &__pills {
    list-style: none;
    margin: 18px 0 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;

    li {
      font-size: 11px;
      font-family: var(--is-mono);
      letter-spacing: 0.04em;
      color: var(--is-text-2);
      border: 1px solid var(--is-border);
      border-radius: 999px;
      padding: 4px 10px;
      background: var(--is-accent-soft);
    }
  }

  &__ticker {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    gap: 28px;
    padding: 10px 0;
    overflow: hidden;
    font-family: var(--is-mono);
    font-size: 10px;
    letter-spacing: 0.2em;
    color: var(--is-text-3);
    border-top: 1px solid var(--is-border);
    background: color-mix(in srgb, var(--is-bg) 70%, transparent);
    animation: ib-marquee 22s linear infinite;
    width: max-content;
  }
}

.ib-foot {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 0 16px 16px;
  font-size: 11px;
  color: var(--is-text-3);
  font-family: var(--is-mono);

  &__sep { opacity: 0.4; }
}

/* workspace */
.ib-ws {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.ib-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
  scrollbar-width: thin;
}

.ib-tab {
  appearance: none;
  border: 1px solid var(--is-border);
  background: var(--is-card);
  color: var(--is-text-2);
  border-radius: 999px;
  padding: 7px 12px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  max-width: 180px;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &--on {
    border-color: var(--is-border-hi);
    color: var(--is-text);
    background: var(--is-accent-dim);
  }

  &--add {
    padding: 7px 12px;
    color: var(--is-accent);
  }

  &__pip {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--is-accent);
    flex: 0 0 auto;

    &[data-t='APNG'] { background: var(--is-ok); }
    &[data-t='GIF'] { background: var(--is-warn); }
  }
}

.ib-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0;
  position: relative;
  z-index: 1;
}

.ib-stage {
  min-width: 0;
  overflow: auto;
  padding: 18px;
}

.ib-card {
  border-radius: 18px;
  border: 1px solid var(--is-border);
  background: var(--is-panel);
  box-shadow: var(--is-shadow);
}

.ib-focus {
  padding: 16px 16px 12px;

  &__bar {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  &__text {
    min-width: 0;
    flex: 1;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  &__path {
    font-size: 11px;
    font-family: var(--is-mono);
    color: var(--is-text-3);
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
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--is-accent-dim);
  color: var(--is-accent);
  border: 1px solid var(--is-border-hi);

  &[data-t='APNG'] {
    color: var(--is-ok);
    border-color: color-mix(in srgb, var(--is-ok) 40%, transparent);
    background: color-mix(in srgb, var(--is-ok) 12%, transparent);
  }

  &[data-t='GIF'] {
    color: var(--is-warn);
    border-color: color-mix(in srgb, var(--is-warn) 40%, transparent);
    background: color-mix(in srgb, var(--is-warn) 12%, transparent);
  }
}

.ib-meter {
  min-width: 72px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--is-card);
  border: 1px solid var(--is-border);
  text-align: center;

  b {
    display: block;
    font-size: 14px;
    font-family: var(--is-mono);
  }

  span {
    font-size: 9px;
    letter-spacing: 0.14em;
    color: var(--is-text-3);
  }
}

.ib-filmwrap {
  border-top: 1px solid var(--is-border);
  padding-top: 8px;
}

.ib-fold {
  appearance: none;
  border: 0;
  background: transparent;
  color: var(--is-text-3);
  font-size: 10px;
  letter-spacing: 0.2em;
  font-family: var(--is-mono);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 2px 10px;

  &:hover { color: var(--is-accent); }

  &__chev { font-size: 12px; }
}

.ib-film {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 6px;

  &__empty {
    width: 100%;
    text-align: center;
    padding: 28px;
    color: var(--is-text-3);
    font-size: 12px;
    border: 1px dashed var(--is-border);
    border-radius: 12px;
  }
}

.ib-cell {
  position: relative;
  flex: 0 0 auto;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  border: 1px solid var(--is-border);
  background: #000;
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    opacity: 0.92;
  }

  em {
    position: absolute;
    left: 6px;
    bottom: 4px;
    font-style: normal;
    font-size: 10px;
    font-family: var(--is-mono);
    color: #fff;
    text-shadow: 0 1px 3px #000;
  }

  &:hover {
    transform: translateY(-3px) scale(1.02);
    border-color: var(--is-border-hi);
  }

  &--on {
    border-color: var(--is-accent);
    box-shadow: var(--is-glow);
  }
}

/* side panel */
.ib-side {
  width: 300px;
  border-left: 1px solid var(--is-border);
  background: var(--is-panel);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;

  &--shut {
    width: 44px;
  }

  &__toggle {
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--is-text-2);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 14px 14px;
    cursor: pointer;
    font-size: 11px;
    letter-spacing: 0.16em;
    font-family: var(--is-mono);
    border-bottom: 1px solid var(--is-border);
    writing-mode: horizontal-tb;

    &:hover { color: var(--is-accent); }
  }

  &--shut &__toggle {
    writing-mode: vertical-rl;
    height: 100%;
    border-bottom: 0;
    border-left: 0;
    padding: 16px 0;
  }

  &__body {
    padding: 14px;
    overflow: auto;
    flex: 1;
  }

  &__gap { height: 18px; }

  &__note {
    margin: 10px 0 0;
    font-size: 11px;
    color: var(--is-text-3);
    text-align: center;
  }
}

.ib-lab {
  font-size: 10px;
  letter-spacing: 0.18em;
  color: var(--is-text-3);
  font-family: var(--is-mono);
  margin: 12px 0 8px;
}

.ib-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ib-chip {
  appearance: none;
  border: 1px solid var(--is-border);
  background: transparent;
  color: var(--is-text-2);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;

  &:hover {
    border-color: var(--is-border-hi);
    color: var(--is-text);
  }

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
  font-family: var(--is-mono);

  input {
    background: var(--is-card);
    border: 1px solid var(--is-border);
    color: var(--is-text);
    border-radius: 8px;
    padding: 8px;
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
  border-radius: 8px;
  padding: 9px 10px;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--is-accent);
  }
}

.ib-go {
  position: relative;
  width: 100%;
  appearance: none;
  border: 0;
  border-radius: 999px;
  padding: 14px 16px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.14em;
  cursor: pointer;
  background: var(--is-accent);
  color: var(--is-bg);
  overflow: hidden;

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  &__pulse {
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent 30%, rgba(255, 255, 255, 0.35), transparent 70%);
    transform: translateX(-100%);
  }

  &:not(:disabled):hover &__pulse {
    animation: ib-sheen 0.8s ease;
  }
}

.ib-status {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--is-border);
  font-size: 11px;
  color: var(--is-text-2);
  font-family: var(--is-mono);

  &__dots {
    display: flex;
    gap: 4px;

    i {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--is-accent);
      opacity: 0.85;
    }
  }

  &__grow { flex: 1; }
}

.ib-ghost {
  appearance: none;
  border: 1px solid var(--is-border);
  background: transparent;
  color: var(--is-text-2);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    color: var(--is-accent);
    border-color: var(--is-border-hi);
  }
}

@keyframes ib-spin {
  to { transform: rotate(360deg); }
}

@keyframes ib-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes ib-sheen {
  to { transform: translateX(100%); }
}
</style>
