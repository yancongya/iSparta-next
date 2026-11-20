// PNG 位深探测：读 IHDR 的 bit depth(byte 24) 与 color type(byte 25)，
// 供角标 hover「源 X-bit → 产物 Y-bit」与保真输出判定共用。
//
// - parsePngBitDepth(header) 是纯函数（只吃一段字节），桌面 / CEP / L1 单测通用；
// - readPngBitDepth(file) 走 preload 的 fs 读首帧前 26 字节；失败/非 PNG 返回 null，
//   调用方（惰性调度器）据此「首帧未算出暂不显示该行」。
// - 混合帧位深按首帧决策（docs/PLAN-apng-bitdepth-preserve.md §4.3），不扫描全序列。

import { fs } from './node-env'

const SIG1 = 0x89
const SIG_S = 'PNG'

function byteAt (buf, offset) {
  return typeof buf === 'string' ? buf.charCodeAt(offset) : buf[offset]
}

function asciiExact (buf, offset, length) {
  let out = ''
  for (let i = 0; i < length; i++) { out += String.fromCharCode(byteAt(buf, offset + i)) }
  return out
}

/**
 * 从 IHDR 头部字节解析位深信息（纯函数，不读文件）。
 * @param {Buffer|Uint8Array|string} header 至少 26 字节，前 8 字节为 PNG signature
 * @returns {{bitDepth:number, colorType:number, bits:number, label:string}|null}
 *          colorType: 6=RGBA / 2=RGB / 3=索引 / 0=灰度 / 4=灰度+alpha；
 *          bits = 通道总位深（如 RGBA8=32、RGB8=24）；label 为可读文案（由调用方 $t 拼装）
 */
export function parsePngBitDepth (header) {
  if (!header || header.length < 26) return null
  if (byteAt(header, 0) !== SIG1 || asciiExact(header, 1, 3) !== SIG_S || asciiExact(header, 12, 4) !== 'IHDR') {
    return null
  }
  const bitDepth = byteAt(header, 24)
  const colorType = byteAt(header, 25)
  // 通道数：RGBA=4、RGB=3、灰度+alpha=2、灰度=1；索引固定按 8-bit 索引呈现
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : colorType === 0 ? 1 : 1
  const bits = colorType === 3 ? bitDepth : bitDepth * channels
  return { bitDepth: bitDepth, colorType: colorType, bits: bits }
}

/** 从文件读首帧位深（惰性调度里调用；读失败返回 null） */
export function readPngBitDepth (file) {
  if (!file) return null
  // mock 探测独立一层 try：'__bitdepth__:' 虚拟键只在浏览器 mock 环境存在，
  // 真机（桌面 / CEP）的 fs 读这个畸形路径会抛错——绝不能让它吞掉下面的真实读取。
  try {
    // 源文件是 'mock' 占位时无法真读 IHDR；预置 __bitdepth__:<path>
    // 虚拟键（形如 '32|6'，bitDepth|colorType）供浏览器预览演示位深行。
    const demo = fs.readFileSync('__bitdepth__:' + file)
    if (demo && typeof demo === 'string' && demo.indexOf('|') > 0) {
      const parts = demo.split('|')
      const bitDepth = Number(parts[0])
      const colorType = Number(parts[1])
      if (isFinite(bitDepth) && isFinite(colorType)) {
        const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1
        const bits = colorType === 3 ? bitDepth : bitDepth * channels
        return { bitDepth: bitDepth, colorType: colorType, bits: bits }
      }
    }
  } catch (e) {
    // 真机无虚拟键，忽略，继续走真实文件读取
  }
  try {
    const data = fs.readFileSync(file)
    return parsePngBitDepth(data && data.length >= 26 ? data.slice(0, 26) : data)
  } catch (e) {
    return null
  }
}

/**
 * 位深对象 → 简短文案的数据（供 i18n 模板渲染）。
 * 索引色统一显示「N-bit 索引」，真彩显示「N-bit」；isLossless 决定产物是否保真。
 */
export function bitDepthText (info) {
  if (!info) return null
  return {
    bits: info.bits,
    indexed: info.colorType === 3,
    // 产物：无损保住源位深；压缩一律 8-bit 索引（apngquant 量化本质）
    outputBits: 8,
    outputIndexed: true
  }
}

/**
 * 目标格式能否承载源位深（保真输出的格式能力）。
 * - APNG：PNG 系容器，colorType 6 可承载 32-bit RGBA → 能
 * - WEBP：VP8L（cwebp -lossless -exact）可承载 RGBA 且逐像素一致 → 能
 * - GIF：GIF89a 硬上限 256 色索引，**格式层面**就无法承载 32-bit → 不能
 *   （与是否关压缩无关；关压缩时它仍会降到 8-bit 索引，必须如实告知，
 *    不能笼统宣称「保留 32-bit 无损」）
 */
export function formatCanPreserveBitDepth (format) {
  return String(format || '').toUpperCase() !== 'GIF'
}
