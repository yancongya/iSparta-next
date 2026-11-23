/**
 * 动图元数据轻量解析：APNG / GIF 的真实帧数与逐帧延时。
 *
 * 背景：桌面导入 APNG/GIF 时 fileList 只有 1 个文件，frameCountOf 走
 * fileList.length 得到 1，durationOf 用 1/frameRate ≈ 0.04s → 封面显示「0s」。
 * 真实帧数与播放节奏藏在文件头里（APNG 的 acTL/fcTL、GIF 的 GCE），
 * 故在导入时读一次写进 basic.frameCount / options.delays，封面角标、
 * 延时面板、转换链路共用同一份数据，不再各自猜。
 *
 * 只依赖 buffer 的字节读取，不引第三方解码库；任何异常/非动图返回 null，
 * 由调用方保持原默认行为。mock fs 读回的是字符串，同样安全降级。
 */

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10]

function isBuffer (b) {
  return !!(b && typeof b.length === 'number' && typeof b.readUInt32BE === 'function' && !(b instanceof Uint8Array))
}

function u32be (b, off) {
  if (isBuffer(b)) return b.readUInt32BE(off)
  return ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0
}

function u16be (b, off) {
  if (isBuffer(b)) return b.readUInt16BE(off)
  return ((b[off] << 8) | b[off + 1]) >>> 0
}

function u16le (b, off) {
  if (isBuffer(b)) return b.readUInt16LE(off)
  return ((b[off + 1] << 8) | b[off]) >>> 0
}

function ascii (b, start, end) {
  if (isBuffer(b)) return b.toString('ascii', start, end)
  let s = ''
  for (let i = start; i < end; i++) s += String.fromCharCode(b[i])
  return s
}

function byteAt (b, off) {
  return isBuffer(b) ? b.readUInt8(off) : b[off]
}

/**
 * APNG：遍历 PNG chunk，取 acTL.num_frames 与每个 fcTL 的 delay_num/delay_den。
 * 延时单位统一成秒，与 options.delays 一致。
 */
export function parseApngMeta (buffer) {
  try {
    if (!buffer || buffer.length < 8) return null
    for (let i = 0; i < PNG_SIG.length; i++) {
      if (byteAt(buffer, i) !== PNG_SIG[i]) return null
    }
    let off = 8
    let numFrames = 0
    const delays = []
    while (off + 12 <= buffer.length) {
      const len = u32be(buffer, off)
      const type = ascii(buffer, off + 4, off + 8)
      if (off + 12 + len > buffer.length + 8) break
      if (type === 'acTL') {
        numFrames = u32be(buffer, off + 8)
      } else if (type === 'fcTL') {
        // chunk data 从 off+8 起；fcTL 布局：seq(4)+w(4)+h(4)+x(4)+y(4)=20
        // 之后 delay_num(2)+delay_den(2)，即绝对偏移 off+8+20 = off+28
        const num = u16be(buffer, off + 28)
        const den = u16be(buffer, off + 30)
        let sec = den > 0 ? num / den : (num > 0 ? num / 100 : 0)
        if (!isFinite(sec) || sec <= 0) sec = 0.01
        delays.push(sec)
      } else if (type === 'IDAT' || type === 'IEND') {
        break
      }
      off += 12 + len
    }
    if (!numFrames) return null
    // fcTL 数量可能少于 num_frames（首帧复用），补齐到 num_frames 保证角标/时长一致
    while (delays.length < numFrames) {
      delays.push(delays.length ? delays[delays.length - 1] : 0.1)
    }
    const total = delays.slice(0, numFrames).reduce(function (s, d) { return s + d }, 0)
    return { frameCount: numFrames, delays: delays.slice(0, numFrames), duration: total }
  } catch (e) {
    return null
  }
}

/**
 * GIF：顺序扫 block，统计图像描述符数量与每个 GCE 的延时（单位 1/100 秒 → 秒）。
 */
export function parseGifMeta (buffer) {
  try {
    if (!buffer || buffer.length < 13) return null
    const header = ascii(buffer, 0, 6)
    if (header !== 'GIF87a' && header !== 'GIF89a') return null
    let off = 13
    // 跳过全局色表
    const packed = byteAt(buffer, 10)
    if (packed & 0x80) {
      off += 3 * (1 << ((packed & 0x07) + 1))
    }
    let frames = 0
    let pendingDelay = 0
    let sawGce = false
    const delays = []
    while (off < buffer.length) {
      const b = byteAt(buffer, off)
      if (b === 0x21) {
        const label = byteAt(buffer, off + 1)
        if (label === 0xf9 && off + 6 <= buffer.length) {
          pendingDelay = u16le(buffer, off + 4) / 100
          if (!isFinite(pendingDelay) || pendingDelay <= 0) pendingDelay = 0.1
          sawGce = true
          off += 8 // 0x21 + 0xF9 + size(4) + delay(2) + terminator
          continue
        }
        // 其他扩展：跳子块
        off += 2
        while (off < buffer.length && byteAt(buffer, off) !== 0) off += 1 + byteAt(buffer, off)
        off += 1
      } else if (b === 0x2c) {
        frames++
        delays.push(sawGce ? pendingDelay : 0.1)
        sawGce = false
        pendingDelay = 0
        // 图像描述符 9 字节 + 可选局部色表 + LZW 最小码长 + 数据子块
        const lp = byteAt(buffer, off + 9)
        off += 10
        if (lp & 0x80) off += 3 * (1 << ((lp & 0x07) + 1))
        off += 1
        while (off < buffer.length && byteAt(buffer, off) !== 0) off += 1 + byteAt(buffer, off)
        off += 1
      } else if (b === 0x3b) {
        break
      } else {
        off++
      }
    }
    if (!frames) return null
    const total = delays.reduce(function (s, d) { return s + d }, 0)
    return { frameCount: frames, delays, duration: total }
  } catch (e) {
    return null
  }
}

/** 按格式分派；非动图/解析失败返回 null */
export function parseAnimationMeta (type, buffer) {
  const t = String(type || '').toUpperCase()
  if (t === 'APNG') return parseApngMeta(buffer)
  if (t === 'GIF') return parseGifMeta(buffer)
  return null
}
