// 轻量真实二进制冒烟（非真机，几秒）：验证「保真输出保住 32-bit」的证据链。
// 用 win64 真实工具链跑 32-bit RGBA 序列：
//   1) apngasm 合成母版 → apngopt 无损（=preserveBitDepth 路径）→ 输出仍 colorType=6；
//   2) apngquant 量化（=开压缩路径）→ 输出 colorType=3（8-bit 索引）。
// 只有真实二进制能验色深；mockup 里的位深是假数据（见 mock-bridge __bitdepth__）。
// 用法：node scripts/preserve-bitdepth.smoke.js
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const BIN = path.join(ROOT, 'static', 'bin', 'win64')
const APNGASM = path.join(BIN, 'apngasm.exe')
const APNGOPT = path.join(BIN, 'apngopt.exe')
const APNGQUANT = path.join(BIN, 'apngquant.exe')
const FRAMES = ['cool_00.png', 'cool_01.png', 'cool_02.png']
const SRCDIR = path.join(ROOT, 'test', 'pngs')

function ihdr (file) {
  const d = fs.readFileSync(file)
  assert.strictEqual(d.slice(1, 4).toString('ascii'), 'PNG', 'not a PNG')
  assert.strictEqual(d.slice(12, 16).toString('ascii'), 'IHDR', 'no IHDR')
  return { bitDepth: d[24], colorType: d[25] }
}

function run () {
  for (const bin of [APNGASM, APNGOPT, APNGQUANT]) {
    assert(fs.existsSync(bin), 'missing binary: ' + bin)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-preserve-'))
  try {
    const frames = FRAMES.map((n, i) => {
      const dst = path.join(tmp, 'apng' + (i + 1) + '.png')
      fs.copyFileSync(path.join(SRCDIR, n), dst)
      return dst
    })
    // 源帧必须是 32-bit RGBA（colorType 6）
    FRAMES.forEach((_, i) => {
      const info = ihdr(frames[i])
      assert.strictEqual(info.colorType, 6, 'source frame must be RGBA32: ' + frames[i])
    })

    // 1) 保真路径：合成 + 无损优化，仍为 RGBA 32-bit
    const master = path.join(tmp, 'out.png')
    execFileSync(APNGASM, [master, ...frames, '1', '24', '-l0', '-kc', '-z0', '-i5'], { stdio: 'ignore' })
    const lossless = path.join(tmp, 'out-opt.png')
    execFileSync(APNGOPT, [master, lossless, '-z2'], { stdio: 'ignore' })
    const preserved = ihdr(lossless)
    assert.strictEqual(preserved.colorType, 6, 'preserve path must keep RGBA32 (colorType 6), got ' + preserved.colorType)
    console.log('ok - 保真（apngasm→apngopt 无损）：colorType=6 RGBA 32-bit')

    // 2) 压缩路径：apngquant 量化 → 8-bit 索引
    const quant = path.join(tmp, 'out-quant.png')
    execFileSync(APNGQUANT, [master, '--output', quant, '--force'], { stdio: 'ignore' })
    const quantized = ihdr(quant)
    assert.strictEqual(quantized.colorType, 3, 'quantize path must yield indexed 8-bit (colorType 3), got ' + quantized.colorType)
    console.log('ok - 压缩（apngquant 量化）：colorType=3 8-bit 索引')

    console.log('\npreserve-bitdepth smoke: 真实色深验证通过')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

try { run() } catch (e) { console.error(e); process.exit(1) }
