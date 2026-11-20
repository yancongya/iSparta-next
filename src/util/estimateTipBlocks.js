/**
 * 预估角标 hover 富气泡：把 estimateOutput 结果转成方案 B 的结构化 blocks。
 *
 * 单一可编辑源：compTree.vue 与 projectList.vue 两处 estimateTipOf 共用本函数，
 * 保证桌面与 CEP 表现一致。返回的 blocks 交给 v-tip 的结构化写法渲染——所有
 * 字符串由 tip.js 用 textContent 写入，本文件只产出纯数据，不拼 HTML。
 *
 * 语义分支全部沿用旧的纯文本版本（mode/over/hasTarget/多格式明细/位深/免责），
 * 仅呈现方式由「一段灰字」改为分区仪表。
 */

import { humanSize } from './qualityEstimate'

/**
 * @param {object} e    estimateOutput 结果（含组件注入的 srcBits/srcIndexed/preserve/limitedFormats）
 * @param {function} t  i18n 取值函数（this.$t）
 * @returns {Array<object>} blocks
 */
export function buildEstimateTipBlocks (e, t) {
  if (!e) return []
  const blocks = []

  // 主值区：大数值 + 标签；超目标时右上角胶囊
  const over = !!(e.hasTarget && e.over)
  blocks.push({
    type: 'head',
    label: t('estRichLabel'),
    value: e.text || '',
    badge: over ? t('estRichOverBadge') : ''
  })

  // 对比条：仅在开启体积限制（有目标）时绘制；无目标态整条隐去
  if (e.hasTarget && e.target > 0) {
    const ratio = e.bytes / e.target
    blocks.push({
      type: 'gauge',
      ratio: ratio,
      caption: t('estRichGaugeTarget', { target: humanSize(e.target) }),
      captionRight: over ? t('estRichGaugeOver', { n: ratio.toFixed(1) }) : ''
    })
  }

  // 估算依据（按 mode 区分，均为纯说明，不再重复主数值）
  let basis = ''
  if (e.mode === 'preserve') basis = t('estRichBasisPreserve')
  else if (e.mode === 'colors') basis = t('estRichBasisColors', { c: e.colors })
  else basis = t('estRichBasisQ', { q: e.quality })
  if (basis) blocks.push({ type: 'basis', text: basis, tone: 'info' })

  // 双指标：源大小 + 目标（无目标时不显示目标卡，也不显示对比条，见上）
  const metrics = [{ label: t('estRichMetricSource'), value: humanSize(e.sourceBytes) }]
  if (e.hasTarget && e.target > 0) {
    metrics.push({ label: t('estRichMetricTarget'), value: '≤ ' + humanSize(e.target) })
  }
  blocks.push({ type: 'metrics', items: metrics })

  // 多格式明细 + 点击轮换提示（仅在多格式时）：改成结构化列表，
  // 格式名做彩色胶囊、数值右对齐、超目标整行标红，不再是清一色灰字。
  if (e.details && e.details.length > 1) {
    const items = e.details.map(function (d) {
      return {
        format: d.format,
        value: humanSize(d.bytes),
        over: !!d.over,
        overText: d.over ? t('estimateFormatOver') : ''
      }
    })
    blocks.push({ type: 'fmtlist', items: items })
    blocks.push({ type: 'hint', text: t('estimateCycleHint') })
  }

  // 位深说明：源首帧探测到才显示；保真=保留源位深，压缩=产物 8-bit 索引
  if (e.srcBits) {
    const srcLabel = e.srcIndexed
      ? t('bitDepthIndexed', { bits: e.srcBits })
      : t('bitDepthTrue', { bits: e.srcBits })
    const bitText = e.preserve
      ? t('bitDepthPreserved', { src: srcLabel })
      : t('bitDepthForward', { src: srcLabel, dst: t('bitDepthIndexed', { bits: 8 }) })
    blocks.push({ type: 'note', text: bitText, tone: 'info' })
    // 保真但含 GIF 等受限格式：GIF 硬上限 256 色，保不住 32-bit
    if (e.preserve && e.limitedFormats && e.limitedFormats.length) {
      blocks.push({
        type: 'note',
        tone: 'warn',
        text: t('bitDepthFormatLimited', { formats: e.limitedFormats.join('/') })
      })
    }
  }

  // 免责声明
  blocks.push({
    type: 'foot',
    text: e.estimated ? t('estimateDisclaimerEstimated') : t('estimateDisclaimer')
  })

  return blocks
}

export default buildEstimateTipBlocks
