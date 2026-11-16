// 纯 JS SHA-256：渲染进程直接算工具哈希，不扩展 ispartaAPI 桥契约（docs/BRIDGE.md 冻结）。
// 输入 Uint8Array / Array / ArrayBuffer / 字符串（按 UTF-8），返回 64 位小写十六进制。

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]

function toBytes (input) {
  if (input instanceof Uint8Array) { return input }
  if (Array.isArray(input)) { return Uint8Array.from(input) }
  if (input instanceof ArrayBuffer) { return new Uint8Array(input) }
  var str = String(input == null ? '' : input)
  // TextEncoder 三端可用；缺失时退化为 Latin-1（哈希仅对字节敏感，工具路径不依赖此处字符串输入）
  if (typeof TextEncoder !== 'undefined') { return new TextEncoder().encode(str) }
  var out = new Uint8Array(str.length)
  for (var i = 0; i < str.length; i++) { out[i] = str.charCodeAt(i) & 0xff }
  return out
}

function rotr (x, n) { return (x >>> n) | (x << (32 - n)) }

export default function sha256 (input) {
  var msg = toBytes(input)
  var len = msg.length
  // 填充：0x80 + 若干 0 + 64bit 位长度
  var bitLen = len * 8
  var withOne = len + 1
  var zeroPad = (withOne % 64 <= 56) ? (56 - withOne % 64) : (64 + 56 - withOne % 64)
  var total = withOne + zeroPad + 8
  var buf = new Uint8Array(total)
  buf.set(msg, 0)
  buf[len] = 0x80
  // 64 位长度：高 32 位通常为 0（工具文件远小于 512MB）；低 32 位按大端写
  var hi = Math.floor(bitLen / 0x100000000)
  var lo = bitLen >>> 0
  var dv = new DataView(buf.buffer)
  dv.setUint32(total - 8, hi, false)
  dv.setUint32(total - 4, lo, false)

  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  var w = new Uint32Array(64)

  for (var off = 0; off < total; off += 64) {
    for (var t = 0; t < 16; t++) { w[t] = dv.getUint32(off + t * 4, false) }
    for (var j = 16; j < 64; j++) {
      var s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)
      var s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], hh = h[7]
    for (var i = 0; i < 64; i++) {
      var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      var ch = (e & f) ^ (~e & g)
      var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0
      var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      var maj = (a & b) ^ (a & c) ^ (b & c)
      var t2 = (S0 + maj) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0
      d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0
  }

  var hex = ''
  for (var k = 0; k < 8; k++) { hex += h[k].toString(16).padStart(8, '0') }
  return hex
}
