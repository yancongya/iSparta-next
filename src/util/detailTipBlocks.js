/**
 * 长提示可视化气泡：把 4 类「数据展示型」纯文本提示转成结构化 blocks。
 *
 * 单一可编辑源：compTree.vue（stateTipOf）与 projectList.vue
 * （titleTipOf / badgeTipOf / outputSizeTip）共用本文件，保证桌面与 CEP 表现一致。
 * 与 estimateTipBlocks.js 同构——本文件只产出纯数据，所有字符串交给 tip.js
 * 用 textContent 写入，杜绝路径/stderr 里的 <> 注入。
 *
 * 刻意不在这里读文件系统（fs.statSize）——文件大小、路径等由调用组件采集后传入，
 * 保持本文件为纯函数、可被 L1 沙箱直接单测。原 util/task-output.js 的纯文本函数
 * （sizeTipOfFiles/outputSizeTip 等）保持不变，因为它们还服务于非 tip 场景。
 */

/**
 * 卡片标题提示：合成名 + 输入/输出目录 + 输出名（键值对列表）
 * tone 为语义色（accent/cool/ok/warn/bad），由调用方按字段含义给出，渲染层白名单过滤。
 * @param {object} d  { name, label?, tone?, rows:[{label,value,mono?,tone?}] }
 */
export function buildTitleTipBlocks (d) {
  if (!d) return []
  const blocks = []
  if (d.name) blocks.push({ type: 'head', label: d.label || '', value: d.name, tone: d.tone || 'accent' })
  if (Array.isArray(d.rows) && d.rows.length) {
    blocks.push({
      type: 'kvlist',
      items: d.rows.map(function (r) {
        return { label: r.label || '', value: r.value || '', mono: !!r.mono, tone: r.tone || '' }
      })
    })
  }
  return blocks
}

/**
 * 格式角标提示：格式 + 该格式总大小 + 逐文件列表 + 复制提示
 * @param {object} d  { label, total, tone?, files:[{name,size}], copyText }
 */
export function buildBadgeTipBlocks (d) {
  if (!d) return []
  const blocks = []
  blocks.push({ type: 'head', label: d.label || '', value: d.total || '', tone: d.tone || 'accent' })
  if (Array.isArray(d.files) && d.files.length) {
    blocks.push({
      type: 'filelist',
      items: d.files.map(function (f) {
        return { name: f.name || '', size: f.size || '', tone: f.tone || d.tone || 'accent' }
      })
    })
  }
  if (d.copyText) blocks.push({ type: 'hint', text: d.copyText })
  return blocks
}

/**
 * 产物大小提示：逐文件完整路径 + 精确字节（文件列表，路径允许省略号 + title 全文）
 * @param {object} d  { label, tone?, files:[{name,size,tone?}] }
 */
export function buildOutputSizeTipBlocks (d) {
  if (!d) return []
  const blocks = []
  if (d.label) blocks.push({ type: 'sub', text: d.label, tone: d.tone || 'accent' })
  if (Array.isArray(d.files) && d.files.length) {
    blocks.push({
      type: 'filelist',
      items: d.files.map(function (f) {
        return { name: f.name || '', size: f.size || '', tone: f.tone || d.tone || 'cool' }
      })
    })
  }
  return blocks
}

/**
 * 运行状态提示：状态名 + （失败）多行原文 stderr 红底块 / （成功）产物列表 + 复制提示
 * @param {object} d  { stateLabel, stateTone:'ok'|'bad'|'idle', detail, files:[{name,size}], copyText }
 */
export function buildStateTipBlocks (d) {
  if (!d) return []
  const blocks = []
  const tone = d.stateTone === 'bad' ? 'bad' : (d.stateTone === 'ok' ? 'ok' : 'cool')
  const badge = d.stateTone === 'bad' ? d.badgeText || '' : ''
  blocks.push({ type: 'head', label: '', value: d.stateLabel || '', badge: badge, tone: tone })
  // 失败/非完成态：多行原文（stderr / 最近过程文案）全文放红底等宽块
  if (d.detail) {
    blocks.push({ type: 'stderr', text: d.detail })
  }
  // 完成态：逐文件产物路径 + 大小
  if (Array.isArray(d.files) && d.files.length) {
    blocks.push({
      type: 'filelist',
      items: d.files.map(function (f) {
        return { name: f.name || '', size: f.size || '', tone: f.tone || tone }
      })
    })
  }
  if (d.copyText) blocks.push({ type: 'hint', text: d.copyText })
  return blocks
}
