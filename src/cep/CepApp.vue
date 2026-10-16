/**
 * 【可选 demo / 非主 UI】精简合成导出壳，仅供脚本链路演示与回归对照。
 * 主 UI 必须是完整 Home 工作台（src/cep/main.js → ui-next/views/Home.vue）。
 * 禁止将本组件恢复为 CEP 终态入口；AE 特殊化只经 host-env / sourceAdapter 注入。
 *
 * 选合成 → 导出 PNG 序列 → 同一 processor 出 APNG/WebP/GIF
 * UI 复用 ui-next；编码只走 src/util/processor/*（禁止 lib/cli 旁路）。
 */
<template>
  <div class="cep-shell">
    <header class="cep-hd">
      <div class="cep-title">iSparta</div>
      <div class="cep-sub">{{ $t('appTitle') || 'iSparta' }} · AE → APNG / WebP / GIF</div>
    </header>

    <section class="cep-sec">
      <div class="cep-sec-hd">
        <span>合成</span>
        <is-button size="sm" icon="refresh" :disabled="busy" @click="loadComps">刷新</is-button>
      </div>
      <div v-if="!comps.length" class="cep-empty">无合成（请打开工程后点刷新）</div>
      <ul class="cep-comps" role="listbox" aria-label="compositions">
        <li
          v-for="c in comps"
          :key="c.index"
          class="cep-comp"
          :class="{ on: selectedMap[c.index] }"
          @click="toggleComp(c.index)"
        >
          <is-checkbox
            :value="!!selectedMap[c.index]"
            @input="toggleComp(c.index)"
          />
          <div class="cep-comp-meta">
            <div class="cep-comp-name">{{ c.name }}</div>
            <div class="cep-comp-sub">
              {{ c.width }}×{{ c.height }} · {{ c.fps | fps }}fps · {{ c.frames }}f
            </div>
          </div>
        </li>
      </ul>
    </section>

    <section class="cep-sec">
      <div class="cep-sec-hd"><span>输出</span></div>
      <is-form>
        <is-form-item label="格式">
          <is-segmented
            :value="format"
            :options="formatOptions"
            @input="format = $event"
          />
        </is-form-item>
        <is-form-item label="输出名">
          <is-input v-model="outputName" placeholder="动画名（不含扩展名）" />
        </is-form-item>
        <is-form-item label="输出目录">
          <div class="cep-row">
            <is-input v-model="outputDir" placeholder="选择或输入目录" />
            <is-button size="sm" @click="browseOutput">浏览…</is-button>
          </div>
        </is-form-item>
        <is-form-item label="帧率">
          <is-input-number v-model="fps" :min="1" :max="120" :step="0.01" />
        </is-form-item>
        <is-form-item label="循环">
          <is-input-number v-model="loop" :min="0" :max="9999" :step="1" />
          <span class="cep-hint">0 = 无限</span>
        </is-form-item>
        <is-form-item label="质量">
          <is-input-number v-model="quality" :min="0" :max="100" :step="1" />
        </is-form-item>
        <is-form-item label="APNG 压缩">
          <is-checkbox v-model="useCompress" label="apngquant / apngopt" />
        </is-form-item>
        <is-form-item :label="$t('sizeLimitEnable')">
          <is-checkbox v-model="sizeLimit.enabled" :label="$t('sizeLimitEnable')" />
        </is-form-item>
        <is-form-item :label="$t('sizeLimitMax')">
          <is-input-number v-model="sizeLimit.maxKB" :min="1" :max="102400" :step="1" />
          <span class="cep-hint">KB</span>
        </is-form-item>
        <is-form-item :label="$t('sizeLimitStep')">
          <is-input-number v-model="sizeLimit.step" :min="1" :max="99" :step="1" />
          <span class="cep-hint">Q</span>
        </is-form-item>
        <is-form-item :label="$t('sizeLimitTries')">
          <is-input-number v-model="sizeLimit.maxTries" :min="0" :max="50" :step="1" />
        </is-form-item>
      </is-form>

      <is-button
        type="primary"
        block
        :disabled="busy || !selectedComps.length || !outputDir"
        :loading="busy"
        @click="convert"
      >
        导出并转换（{{ selectedComps.length }}）
      </is-button>
    </section>

    <section class="cep-sec">
      <div class="cep-sec-hd"><span>状态</span></div>
      <div class="cep-progress" :class="progressKind">{{ progressText }}</div>
      <is-log-panel />
    </section>
  </div>
</template>

<script>
import processor from '../util/processor'
import { ipc } from '../util/node-env'
import store from './cep-store'
import { toCompItem, prepareCompSequence } from './comp-source'
import appLog from '../ui-next/log'
import IsLogPanel from '../ui-next/components/IsLogPanel.vue'
import i18n from '../i18n'

/* global window */

function host () {
  return (typeof window !== 'undefined' && window.ispartaCS) || null
}

export default {
  name: 'CepApp',
  components: { IsLogPanel },
  filters: {
    fps (v) {
      const n = Number(v)
      return isFinite(n) ? String(Math.round(n * 100) / 100) : String(v)
    }
  },
  data () {
    return {
      busy: false,
      comps: [],
      selectedMap: {},
      format: 'APNG',
      formatOptions: [
        { value: 'APNG', label: 'APNG' },
        { value: 'WEBP', label: 'WebP' },
        { value: 'GIF', label: 'GIF' }
      ],
      outputName: '',
      outputDir: '',
      fps: 25,
      loop: 0,
      quality: 80,
      useCompress: true,
      sizeLimit: {
        enabled: true,
        maxKB: 800,
        maxBytes: 819200,
        unit: 'KB',
        autoDelete: true,
        autoQuality: true,
        step: 5,
        maxTries: 10
      },
      fpsFromComp: true,
      progressText: '就绪',
      progressKind: ''
    }
  },
  computed: {
    selectedComps () {
      return this.comps.filter((c) => this.selectedMap[c.index])
    }
  },
  created () {
    this.loadComps()
  },
  methods: {
    setProgress (text, kind) {
      this.progressText = text
      this.progressKind = kind || ''
    },
    localePack () {
      // processor 只读这些键；与桌面 setting.vue 传入的 locale 同形
      const t = (k, fallback) => {
        try {
          const v = i18n.t(k)
          return v && v !== k ? v : fallback
        } catch (e) {
          return fallback
        }
      }
      return {
        startConvert: t('startConvert', '开始转换'),
        analysing: t('analysing', '分析中'),
        assembling: t('assembling', '合成动画'),
        convertSuccess: t('convertSuccess', '转换成功'),
        convertFail: t('convertFail', '转换失败'),
        noticeConvertAborted: t('noticeConvertAborted', '已中止'),
        renderingComp: t('renderingComp', '渲染合成'),
        seqModeTitle: t('seqModeTitle', '序列帧已存在'),
        seqModeBody: t('seqModeBody', '检测到「{comp}」已有 {existing} 帧序列（期望 {expected} 帧）。是否重新渲染？'),
        seqModeBodyIncomplete: t('seqModeBodyIncomplete', '检测到「{comp}」已有 {existing} 帧，少于期望的 {expected} 帧，可能不完整，建议重新渲染。'),
        seqModeRerender: t('seqModeRerender', '重新渲染'),
        seqModeReuse: t('seqModeReuse', '复用现有帧'),
        seqModeCancel: t('seqModeCancel', '取消'),
        sizeLimitRetry: t('sizeLimitRetry', '超限，质量降至'),
        sizeLimitWarn: t('sizeLimitWarn', '超出大小阈值')
      }
    },
    toggleComp (index) {
      this.$set(this.selectedMap, index, !this.selectedMap[index])
    },
    loadComps () {
      const cs = host()
      if (!cs) {
        this.setProgress('浏览器预览：无 AE 宿主', 'err')
        return
      }
      this.busy = true
      cs.evalJson('ispartaListComps()')
        .then((res) => {
          if (!res || !res.ok) {
            throw new Error((res && res.error) || '列出合成失败')
          }
          this.comps = res.comps || []
          if (!this.outputName && this.comps.length === 1) {
            this.outputName = this.comps[0].name
          }
          this.setProgress('合成 ' + this.comps.length + ' 个')
        })
        .catch((e) => {
          this.setProgress(e.message || String(e), 'err')
          appLog.error('list comps: ' + e.message)
        })
        .then(() => {
          this.busy = false
        })
    },
    browseOutput () {
      const cs = host()
      if (!cs) {
        this.setProgress('浏览器预览：无法选目录', 'err')
        return
      }
      cs.evalJson('ispartaPickOutputFolder(' + JSON.stringify(this.outputDir || '') + ')')
        .then((res) => {
          if (res && res.ok && res.path) {
            this.outputDir = res.path
            this.setProgress('已选择输出目录')
          } else if (res && res.cancelled) {
            this.setProgress('已取消选择')
          } else {
            this.setProgress((res && res.error) || '选择目录失败', 'err')
          }
        })
        .catch((e) => this.setProgress(e.message, 'err'))
    },
    listPngs (folder) {
      const bridge = window.ispartaAPI
      try {
        const names = bridge.fs.readdirSync(folder)
        const files = names
          .filter((n) => /\.png$/i.test(n))
          .map((n) => bridge.path.join(folder, n))
        files.sort()
        return files
      } catch (e) {
        appLog.error('readdir: ' + e.message)
        return []
      }
    },
    convert () {
      const cs = host()
      const bridge = window.ispartaAPI
      if (!cs || !bridge) {
        this.setProgress('缺少宿主桥', 'err')
        return
      }
      const selected = this.selectedComps
      const outDir = (this.outputDir || '').trim()
      const outName = (this.outputName || '').trim()
      if (!selected.length || !outDir) {
        this.setProgress('请选择合成与输出目录', 'err')
        return
      }

      this.busy = true
      this.setProgress('检查环境…')
      const locale = this.localePack()
      // 先按共享合成任务源准备帧序列：已有帧时询问复用/重渲染/取消。
      // 再把完整面板设置写入同一 processor 任务，保证阈值重压也生效。
      let chain = Promise.resolve([])
      selected.forEach((comp) => {
        chain = chain.then((items) => {
          const name = outName && selected.length === 1 ? outName : (outName ? outName + '_' : '') + comp.name
          const item = toCompItem(Object.assign({}, comp, { projectPath: comp.projectPath || '' }), {
            frameRate: this.fpsFromComp ? comp.fps : this.fps,
            loop: this.loop,
            outputName: name,
            outputFormat: [this.format],
            floyd: { checked: this.useCompress, value: 0.35 },
            quality: { checked: true, value: this.quality },
            sizeLimit: Object.assign({}, this.sizeLimit, {
              maxBytes: Math.max(1, Number(this.sizeLimit.maxKB) || 800) * 1024,
              maxMB: Math.max(1, Number(this.sizeLimit.maxKB) || 800) / 1024
            }),
            outputTo: { mode: 'custom', customPath: outDir, template: '' }
          })
          item.basic.outputPath = outDir
          this.setProgress('检查「' + comp.name + '」序列帧…')
          return prepareCompSequence(item, { store: store, locale: locale }).then((ready) => {
            items.push(ready)
            return items
          })
        })
      })

      chain
        .then((items) => {
          this.setProgress('进入转换核…')
          return store.dispatch('setItems', items).then(() => {
            // sameOutputPath：输出目录由面板指定，与桌面「输出到文件夹」一致
            return processor(store, outDir, locale)
          })
        })
        .then(() => {
          this.setProgress('完成: ' + outDir, 'ok')
          appLog.info('convert ok', outDir)
        })
        .catch((e) => {
          const msg = (e && e.message) || (e && e.err) || String(e)
          this.setProgress(msg, 'err')
          appLog.error('convert: ' + msg)
        })
        .then(() => {
          this.busy = false
        })
    }
  }
}
</script>

<style scoped>
.cep-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px 20px;
  min-height: 100vh;
  box-sizing: border-box;
  color: var(--is-fg, #1a1a1a);
  background: var(--is-bg, #f7f5f0);
}
.cep-hd {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cep-title {
  font-size: 16px;
  font-weight: 600;
}
.cep-sub {
  font-size: 12px;
  opacity: 0.65;
}
.cep-sec {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cep-sec-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.8;
}
.cep-empty {
  font-size: 12px;
  opacity: 0.55;
  padding: 8px 0;
}
.cep-comps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow: auto;
}
.cep-comp {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--is-line, rgba(0, 0, 0, 0.08));
  cursor: pointer;
  user-select: none;
}
.cep-comp.on {
  border-color: var(--is-accent, #c8f542);
  background: var(--is-accent-soft, rgba(200, 245, 66, 0.15));
}
.cep-comp-meta {
  min-width: 0;
}
.cep-comp-name {
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cep-comp-sub {
  font-size: 11px;
  opacity: 0.6;
}
.cep-row {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}
.cep-hint {
  font-size: 11px;
  opacity: 0.55;
  margin-left: 8px;
}
.cep-progress {
  font-size: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--is-panel, rgba(0, 0, 0, 0.04));
}
.cep-progress.ok {
  color: var(--is-ok, #2f7d32);
}
.cep-progress.err {
  color: var(--is-err, #b3261e);
}
</style>
