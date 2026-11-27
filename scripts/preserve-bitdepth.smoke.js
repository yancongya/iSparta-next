// 轻量真实二进制冒烟（非真机，几秒）：验证「保真输出保住 32-bit」的证据链。
// 用 win64 真实工具链跑多档 32-bit RGBA 序列：
//   1) apngasm 合成母版 → 直接用母版（=修复后的 preserveBitDepth 路径）→ 仍 colorType=6；
//   2) apngopt -z2（=旧保真路径）→ 统一 alpha 档位会掉 colorType=3，复现 bug 不回归；
//   3) apngquant 量化（=开压缩路径）→ 输出 colorType=3（8-bit 索引）。
// 关键：旧脚本只有 cool_*.png 一套高熵渐变素材（逐像素 alpha 各异），恰好落在
// apngopt 不转索引的分支，从没测到 AE 里常见的纯色/固定透明图层。素材集覆盖
// 全不透明 / 固定半透明 / 二值透明 / 变化 alpha / 高彩 五档（见 gen-bitdepth-fixtures.py）。
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
const FRAMES = ['f0.png', 'f1.png', 'f2.png']
const FIXDIR = path.join(ROOT, 'test', 'bitdepth')
// 档位说明：expectLegacyDrop=true 表示旧 apngopt 路径会降级（统一 alpha）
const CASES = [
  { name: 'opaque-flat', expectLegacyDrop: true },
  { name: 'fixed-alpha', expectLegacyDrop: true },
  { name: 'hard-edge', expectLegacyDrop: true },
  { name: 'varying-alpha', expectLegacyDrop: false },
  { name: 'rich-gradient', expectLegacyDrop: false }
]

function ihdr (file) {
  const d = fs.readFileSync(file)
  assert.strictEqual(d.slice(1, 4).toString('ascii'), 'PNG', 'not a PNG')
  assert.strictEqual(d.slice(12, 16).toString('ascii'), 'IHDR', 'no IHDR')
  return { bitDepth: d[24], colorType: d[25] }
}

function frameCount (file) {
  // 数 fcTL 块（APNG 每帧一个；首帧 IDAT 前的 fcTL 也计入）
  const b = fs.readFileSync(file)
  let n = 0
  for (let i = 8; i + 8 <= b.length;) {
    const len = b.readUInt32BE(i)
    const type = b.slice(i + 4, i + 8).toString('ascii')
    if (type === 'fcTL') n++
    if (len < 0 || i + 12 + len > b.length) break
    i += 12 + len
  }
  return n
}

function run () {
  for (const bin of [APNGASM, APNGOPT, APNGQUANT]) {
    assert(fs.existsSync(bin), 'missing binary: ' + bin)
  }
  assert(fs.existsSync(FIXDIR), 'missing fixtures: ' + FIXDIR + ' (run gen-bitdepth-fixtures.py)')
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-preserve-'))
  try {
    for (const c of CASES) {
      const dir = path.join(FIXDIR, c.name)
      assert(fs.existsSync(path.join(dir, FRAMES[0])), 'missing fixture: ' + dir)
      const frames = FRAMES.map((n, i) => {
        const dst = path.join(tmp, c.name + '-apng' + (i + 1) + '.png')
        fs.copyFileSync(path.join(dir, n), dst)
        return dst
      })
      // 源帧必须是 32-bit RGBA（colorType 6）
      frames.forEach((f) => {
        assert.strictEqual(ihdr(f).colorType, 6, 'source frame must be RGBA32: ' + f)
      })

      // 1) 修复后的保真路径：apngasm 母版直接用，仍为 RGBA 32-bit，且帧完整
      const master = path.join(tmp, c.name + '-master.png')
      execFileSync(APNGASM, [master, ...frames, '1', '24', '-l0', '-kc', '-z0', '-i5'], { stdio: 'ignore' })
      const preserved = ihdr(master)
      assert.strictEqual(preserved.colorType, 6, 'preserve path master must keep RGBA32 (colorType 6): ' + c.name + ' got ' + preserved.colorType)
      assert.strictEqual(frameCount(master), FRAMES.length, 'preserve path must keep all frames: ' + c.name)

      // 2) 旧保真路径（apngopt -z2）复现：统一 alpha 档位必掉 8-bit
      const legacy = path.join(tmp, c.name + '-legacy.png')
      execFileSync(APNGOPT, [master, legacy, '-z2'], { stdio: 'ignore' })
      const legacyCt = ihdr(legacy).colorType
      if (c.expectLegacyDrop) {
        assert.strictEqual(legacyCt, 3, 'legacy apngopt should downgrade unified-alpha case to indexed: ' + c.name)
      } else {
        assert.strictEqual(legacyCt, 6, 'legacy apngopt should keep high-entropy-alpha case: ' + c.name)
      }

      // 3) 压缩路径：apngquant 量化 → 8-bit 索引
      const quant = path.join(tmp, c.name + '-quant.png')
      execFileSync(APNGQUANT, [master, '--output', quant, '--force'], { stdio: 'ignore' })
      assert.strictEqual(ihdr(quant).colorType, 3, 'quantize path must yield indexed 8-bit (colorType 3): ' + c.name)

      console.log('ok - ' + c.name + ': 保真 ct=6 (帧' + FRAMES.length + ') / 旧apngopt ct=' + legacyCt + ' / 压缩 ct=3')
    }
    console.log('\npreserve-bitdepth smoke: 真实色深验证通过（' + CASES.length + ' 档素材）')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

try { run() } catch (e) { console.error(e); process.exit(1) }
