// 产物实测色深：读**已落盘产物**的真实色深/编码，而不是靠选项预测。
//
// 为什么需要独立于 pngBitDepth.js：
// - pngBitDepth 面向**源**（首帧 IHDR），用于「源 X-bit → 产物 Y-bit」的预期展示；
// - 本模块面向**产物**，回答用户「我导出的这个文件到底多少位」。
//   压缩路线的实际产物位深取决于 apngquant/apngopt 的真实行为，选项只能预测、
//   不能保证（例如 apngopt -z2 对统一 alpha 会无损转索引，源是 32-bit 产物却是 8-bit），
//   所以必须回读文件头字节才算「真实」。
//
// 三种格式的读取方式：
// - APNG/PNG：IHDR byte24=bitDepth、byte25=colorType。colorType 6=RGBA(32-bit)、
//   2=RGB(24-bit)、3=索引(8-bit)、4=灰度+alpha、0=灰度。带 PLTE chunk 说明是索引色。
// - GIF：GIF89a 逻辑屏幕描述符的「全局色表标志 + 色表大小」→ 2^(N+1) 色，
//   格式硬上限 256 色 → 永远是 8-bit 索引。
// - WebP：RIFF chunk 判定——VP8L=无损(可承载 32-bit RGBA)、VP8=有损 VP8、
//   VP8X 容器里再逐 ANMF 帧看子块是 VP8L 还是 VP8。
//
// 设计约束：
// - parse* 是纯函数（只吃字节），可被 L1 沙箱直接单测；
// - read* 走 node-env 的 fs 桥（桌面 preload / CEP bridge / mock 同构），
//   读失败返回 null（调用方据此「该行不显示」，绝不伪造数值）；
// - 只读文件头若干字节，不整文件读入。

import { fs } from './node-env'

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function byteAt (buf, offset) {
  if (!buf || offset < 0 || offset >= buf.length) return -1
  return typeof buf === 'string' ? buf.charCodeAt(offset) & 0xff : buf[offset] & 0xff
}

function asciiAt (buf, offset, length) {
  let out = ''
  for (let i = 0; i < length; i++) {
    const b = byteAt(buf, offset + i)
    if (b < 0) return ''
    out += String.fromCharCode(b)
  }
  return out
}

function u32be (buf, offset) {
  return ((byteAt(buf, offset) << 24) | (byteAt(buf, offset + 1) << 16) |
    (byteAt(buf, offset + 2) << 8) | byteAt(buf, offset + 3)) >>> 0
}

function u16le (buf, offset) {
  return byteAt(buf, offset) | (byteAt(buf, offset + 1) << 8)
}

function u24le (buf, offset) {
  return byteAt(buf, offset) | (byteAt(buf, offset + 1) << 8) | (byteAt(buf, offset + 2) << 16)
}

function isPng (buf) {
  if (!buf || buf.length < 8) return false
  for (let i = 0; i < 8; i++) {
    if (byteAt(buf, i) !== PNG_SIG[i]) return false
  }
  return true
}

/**
 * 解析 PNG/APNG 的 IHDR 位深信息（纯函数）。
 * @param {Buffer|Uint8Array|string} data 至少 26 字节
 * @returns {{format:'APNG', bits:number, bitDepth:number, colorType:number,
 *            indexed:boolean, lossless:boolean}|null}
 */
export function parsePngOutputDepth (data) {
  if (!isPng(data) || data.length < 26) return null
  if (asciiAt(data, 12, 4) !== 'IHDR') return null
  const bitDepth = byteAt(data, 24)
  const colorType = byteAt(data, 25)
  const width = u32be(data, 16)
  const height = u32be(data, 20)
  let frames = 0
  if (data.length >= 41 && asciiAt(data, 37, 4) === 'acTL') {
    frames = u32be(data, 41)
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1
  // colorType 3 是调色板索引：位深就是每通道位数（1/2/4/8），呈现为 8-bit 索引
  const indexed = colorType === 3
  const bits = indexed ? 8 : bitDepth * channels
  return {
    format: 'APNG',
    bits: bits,
    bitDepth: bitDepth,
    colorType: colorType,
    indexed: indexed,
    width: width,
    height: height,
    frames: frames,
    // PNG 全程无损（量化是「降色」不是「有损压缩」；这里 lossless 指是否保留源位深）
    lossless: !indexed
  }
}

/**
 * 解析 GIF 的全局色表大小（纯函数）。
 * @param {Buffer|Uint8Array|string} data 至少 13 字节
 * @returns {{format:'GIF', bits:number, colors:number, indexed:true, lossless:false}|null}
 */
export function parseGifOutputDepth (data) {
  if (!data || data.length < 13) return null
  if (asciiAt(data, 0, 3) !== 'GIF') return null
  const width = u16le(data, 6)
  const height = u16le(data, 8)
  const flags = byteAt(data, 10)
  const hasGct = (flags & 0x80) !== 0
  // 色表大小 = 2^(N+1)，N 取 packed 字段低 3 位
  const colors = hasGct ? Math.pow(2, (flags & 0x07) + 1) : 256
  // GIF89a 硬上限 256 色索引 → 永远 8-bit 索引（格式限制，非本应用降级）
  return {
    format: 'GIF',
    bits: 8,
    colors: Math.min(256, colors),
    width: width,
    height: height,
    indexed: true,
    lossless: false
  }
}

/**
 * 解析 WebP 的编码方式（纯函数）。
 * @param {Buffer|Uint8Array|string} data 至少 16 字节
 * @returns {{format:'WEBP', bits:number, lossless:boolean, alpha:boolean}|null}
 */
export function parseWebpOutputDepth (data) {
  if (!data || data.length < 16) return null
  if (asciiAt(data, 0, 4) !== 'RIFF' || asciiAt(data, 8, 4) !== 'WEBP') return null
  const chunk = asciiAt(data, 12, 4)
  let lossless = false
  let alpha = false
  let width = 0
  let height = 0
  if (chunk === 'VP8L') {
    lossless = true
    alpha = true // VP8L 支持 alpha 通道
  } else if (chunk === 'VP8 ') {
    lossless = false
    alpha = false
  } else if (chunk === 'VP8X') {
    // 扩展容器：flags 的 0x10=ALPHA、0x02=ANIMATION；再扫 ANMF 帧看子块编码
    const flags = byteAt(data, 20)
    alpha = (flags & 0x10) !== 0
    if (data.length >= 30) {
      width = u24le(data, 24) + 1
      height = u24le(data, 27) + 1
    }
    // 逐 chunk 扫描找第一个 ANMF，其子块类型决定编码。
    // 注意：必须跳过 ANIM（它是动画控制块，不代表编码方式），
    // 也不能在这里 break——ANIM 之后才是真正的 ANMF 帧数据。
    let offset = 12
    let guard = 0
    while (offset + 8 <= data.length && guard < 64) {
      const fourcc = asciiAt(data, offset, 4)
      const size = byteAt(data, offset + 4) | (byteAt(data, offset + 5) << 8) |
        (byteAt(data, offset + 6) << 16) | (byteAt(data, offset + 7) << 24)
      if (fourcc === 'ANMF') {
        // ANMF 载荷前 16 字节是帧头（x/y/宽/高/延时/flags），子块紧随其后
        const sub = asciiAt(data, offset + 8 + 16, 4)
        lossless = sub === 'VP8L'
        break
      }
      if (fourcc === 'VP8L' || fourcc === 'VP8 ') {
        lossless = fourcc === 'VP8L'
        break
      }
      offset += 8 + size + (size & 1)
      guard++
    }
  } else {
    return null
  }
  // VP8L 无损可承载 32-bit RGBA；VP8 有损按 8-bit YUV 呈现
  return {
    format: 'WEBP',
    bits: lossless ? 32 : 8,
    lossless: lossless,
    alpha: alpha,
    width: width,
    height: height
  }
}

/**
 * 按扩展名猜测产物格式（用于决定用哪个解析器）。
 * 注意：slice(-4) 得到的是 4 个字符（不含点），与 '.webp' 这类 5 字符串比较永远不等，
 * 必须用 slice(-5) 取「点+后缀」再比。
 * @param {string} file
 * @returns {'APNG'|'GIF'|'WEBP'|null}
 */
export function outputFormatOf (file) {
  const lower = String(file || '').toLowerCase()
  if (lower.slice(-5) === '.webp') return 'WEBP'
  if (lower.slice(-4) === '.gif') return 'GIF'
  if (lower.slice(-4) === '.png') return 'APNG'
  return null
}

/**
 * 读产物文件的真实色深（走 fs 桥；读失败返回 null）。
 * @param {string} file 产物路径
 * @returns {object|null} 同 parse* 的返回结构
 */
export function readOutputDepth (file) {
  if (!file) return null
  const format = outputFormatOf(file)
  if (!format) return null
  try {
    const data = fs.readFileSync(file)
    if (!data) return null
    if (format === 'GIF') return parseGifOutputDepth(data)
    if (format === 'WEBP') return parseWebpOutputDepth(data)
    return parsePngOutputDepth(data)
  } catch (e) {
    return null
  }
}

/**
 * 将 readOutputDepth 结果格式化为 hover 气泡展示文本（含色深/编码、分辨率、APNG 帧数）。
 * @param {object|null} info
 * @param {Function} t i18n 翻译函数
 * @returns {string}
 */
export function formatOutputDepthText (info, t) {
  if (!info || typeof t !== 'function') return ''
  const parts = []
  if (info.format === 'GIF') {
    parts.push(t('outputDepthGif', { colors: info.colors }))
  } else if (info.format === 'WEBP') {
    parts.push(info.lossless ? t('outputDepthWebpLossless') : t('outputDepthWebpLossy'))
    if (info.alpha) parts.push('Alpha')
  } else {
    parts.push(info.indexed
      ? t('outputDepthIndexed', { bits: info.bits })
      : t('outputDepthTrue', { bits: info.bits }))
  }
  if (info.width > 0 && info.height > 0) {
    parts.push(`${info.width}×${info.height}`)
  }
  return parts.join(' · ')
}

/**
 * 计算产物相对源文件的压缩比（纯函数）。
 * @param {number} outBytes 产物字节数
 * @param {number} srcBytes 源文件字节数
 * @returns {{pct:number, text:string, over:boolean}|null}
 */
export function calcCompressionRatio (outBytes, srcBytes) {
  if (!(outBytes > 0) || !(srcBytes > 0)) return null
  const diffPct = Math.round(((outBytes - srcBytes) / srcBytes) * 100)
  const over = outBytes > srcBytes
  const pct = over ? 100 : Math.max(4, Math.min(100, Math.round((outBytes / srcBytes) * 100)))
  const text = diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`
  return { pct: pct, text: text, over: over }
}

export default readOutputDepth
