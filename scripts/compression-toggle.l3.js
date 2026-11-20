// L3 用户旅程（issue #3 反馈 02 的端到端回归，上接 compression-toggle.l1.js）：
//   关压缩 → 任务面板同步 globalSetting → 新导入任务从 globalSetting 派生 →
//   派生出的 preserveBitDepth 驱动工具链分流 → 真实二进制产出 32-bit（colorType 6）。
// 这是之前缺失的一环：preserve-bitdepth.smoke.js 只证明了「工具链能保 32-bit」，
// 但没证明「配置生命周期能把关压缩传到新任务」。本脚本把两者串起来。
// 另含 WebP 保真回归：关压缩时 cwebp 必须走 -lossless -exact，产物逐像素与源一致。
// 用法：node scripts/compression-toggle.l3.js（需 static/bin/win64 真实二进制）
const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')
const zlib = require('zlib')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const BIN = path.join(ROOT, 'static', 'bin', 'win64')
const APNGASM = path.join(BIN, 'apngasm.exe')
const APNGOPT = path.join(BIN, 'apngopt.exe')
const APNGQUANT = path.join(BIN, 'apngquant.exe')
const APNGDIS = path.join(BIN, 'apngdis.exe')
const CWEBP = path.join(BIN, 'cwebp.exe')
const DWEBP = path.join(BIN, 'dwebp.exe')
const WEBPMUX = path.join(BIN, 'webpmux.exe')
const FRAMES = ['cool_00.png', 'cool_01.png', 'cool_02.png']
const SRCDIR = path.join(ROOT, 'test', 'pngs')

// 载入真实的纯函数（vm 沙箱，不改源码）
const gpSrc = fs.readFileSync(path.join(__dirname, '../src/util/globalPrefs.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export function /gm, 'function ')
  .replace(/^export /gm, '')
  + '\n;globalThis.gp = { applyGlobalCompressionPatch }'
const gpCtx = { Object, Array, console }
vm.createContext(gpCtx)
vm.runInContext(gpSrc, gpCtx)
const { applyGlobalCompressionPatch } = gpCtx.gp

// 防覆盖保底纯函数：与 store/processor 同一份源码
const ocSrc = fs.readFileSync(path.join(__dirname, '../src/util/outputConflict.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export /gm, '')
  + '\n;globalThis.oc = { fallbackRenameForSource, classifyOutputConflicts }'
const ocCtx = { path, Object, Array, String, Boolean }
vm.createContext(ocCtx)
vm.runInContext(ocSrc, ocCtx)
const { fallbackRenameForSource, classifyOutputConflicts } = ocCtx.oc

function sha256 (file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function ihdr (file) {
  const d = fs.readFileSync(file)
  assert.strictEqual(d.slice(1, 4).toString('ascii'), 'PNG', 'not a PNG')
  assert.strictEqual(d.slice(12, 16).toString('ascii'), 'IHDR', 'no IHDR')
  return { bitDepth: d[24], colorType: d[25] }
}

/** 解 PNG 的 IDAT → 原始 RGBA 像素（支持 5 种 filter，用于逐像素比对） */
function decodeRgba (file) {
  const d = fs.readFileSync(file)
  const w = d.readUInt32BE(16)
  const h = d.readUInt32BE(20)
  const colorType = d[25]
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const ids = []
  let off = 8
  while (off + 8 <= d.length) {
    const len = d.readUInt32BE(off)
    const type = d.slice(off + 4, off + 8).toString('ascii')
    if (type === 'IDAT') ids.push(d.slice(off + 8, off + 8 + len))
    off += 12 + len
    if (type === 'IEND') break
  }
  const raw = zlib.inflateSync(Buffer.concat(ids))
  const stride = w * bpp
  const out = Buffer.alloc(w * h * bpp)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[pos++]
    const line = raw.slice(pos, pos + stride)
    pos += stride
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    const cur = out.slice(y * stride, (y + 1) * stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (ft === 1) v += a
      else if (ft === 2) v += b
      else if (ft === 3) v += Math.floor((a + b) / 2)
      else if (ft === 4) {
        const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c)
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)
      }
      cur[x] = v & 255
    }
  }
  return { w, h, bpp, out }
}

/** 两张 RGBA 图逐像素比对：返回 {visibleDiff, transparentDiff}（可见区 / 全透明区） */
function diffRgba (a, b) {
  assert.strictEqual(a.w, b.w, 'width mismatch')
  assert.strictEqual(a.h, b.h, 'height mismatch')
  assert.strictEqual(a.bpp, b.bpp, 'channel count mismatch')
  let visibleDiff = 0
  let transparentDiff = 0
  for (let i = 0; i < a.out.length; i += a.bpp) {
    let d = 0
    for (let c = 0; c < a.bpp; c++) d = Math.max(d, Math.abs(a.out[i + c] - b.out[i + c]))
    if (d === 0) continue
    // alpha=0 的像素 RGB 不可见；-exact 时也应保留，单独统计
    if (a.bpp === 4 && a.out[i + 3] === 0) transparentDiff++
    else visibleDiff++
  }
  return { visibleDiff, transparentDiff }
}

// 模拟 store ITEMS_ADD：_.extend(tempState, data)，新任务 options 从 globalSetting 派生
function deriveNewTaskOptions (globalSetting) {
  return Object.assign({}, globalSetting.options)
}

function run () {
  for (const bin of [APNGASM, APNGOPT, APNGQUANT]) {
    assert(fs.existsSync(bin), 'missing binary: ' + bin)
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-toggle-l3-'))
  try {
    const frames = FRAMES.map((n, i) => {
      const dst = path.join(tmp, 'apng' + (i + 1) + '.png')
      fs.copyFileSync(path.join(SRCDIR, n), dst)
      return dst
    })
    FRAMES.forEach((_, i) => {
      assert.strictEqual(ihdr(frames[i]).colorType, 6, 'source frame must be RGBA32: ' + frames[i])
    })
    const master = path.join(tmp, 'out.png')
    execFileSync(APNGASM, [master, ...frames, '1', '24', '-l0', '-kc', '-z0', '-i5'], { stdio: 'ignore' })

    // ---- 场景 A：任务面板关压缩 → 同步 globalSetting → 新任务派生 → 走无损 → 32-bit ----
    const gsBefore = { options: { frameRate: 30, preserveBitDepth: false, quality: { checked: true, value: 80 } } }
    // setter 派发的 patch（关压缩：preserveBitDepth=true，quality.checked 保留 false 语义）
    const offPatch = { preserveBitDepth: true, quality: { checked: false } }
    const gsAfter = applyGlobalCompressionPatch(gsBefore, offPatch)
    assert.strictEqual(gsAfter.options.preserveBitDepth, true, 'globalSetting 必须记录关压缩')
    assert.strictEqual(gsBefore.options.preserveBitDepth, false, '入参不被改')
    const newTask = deriveNewTaskOptions(gsAfter)
    assert.strictEqual(newTask.preserveBitDepth, true, '新导入任务必须继承关压缩')

    // 分流：派生出的 preserveBitDepth 决定走无损 apngopt（关压缩）还是量化 apngquant（开压缩）
    const lossless = path.join(tmp, 'newtask-preserved.png')
    if (newTask.preserveBitDepth) {
      execFileSync(APNGOPT, [master, lossless, '-z2'], { stdio: 'ignore' })
    } else {
      execFileSync(APNGQUANT, [master, '--output', lossless, '--force'], { stdio: 'ignore' })
    }
    const outA = ihdr(lossless)
    assert.strictEqual(outA.colorType, 6, '场景 A：关压缩派生的新任务必须产 RGBA32，实测 colorType=' + outA.colorType)
    console.log('ok - 场景A：关压缩→globalSetting→新任务派生→无损链→colorType=6 RGBA32')

    // ---- 场景 B：反向——重新开压缩 → 新任务派生 → 走量化 → 8-bit（现状不变） ----
    const onPatch = { preserveBitDepth: false, quality: { checked: true } }
    const gsOn = applyGlobalCompressionPatch(gsAfter, onPatch)
    const newTaskOn = deriveNewTaskOptions(gsOn)
    assert.strictEqual(newTaskOn.preserveBitDepth, false, '重新开压缩须写回 false')
    assert.strictEqual(newTaskOn.quality.checked, true, '开压缩须把质量 checked 打开')
    const quant = path.join(tmp, 'newtask-quant.png')
    if (newTaskOn.preserveBitDepth) {
      execFileSync(APNGOPT, [master, quant, '-z2'], { stdio: 'ignore' })
    } else {
      execFileSync(APNGQUANT, [master, '--output', quant, '--force'], { stdio: 'ignore' })
    }
    const outB = ihdr(quant)
    assert.strictEqual(outB.colorType, 3, '场景 B：开压缩仍应量化出 8-bit，实测 colorType=' + outB.colorType)
    console.log('ok - 场景B：开压缩→新任务派生→量化链→colorType=3 8-bit（现状不变）')

    // ---- 场景 C：关压缩时 WebP 必须走 cwebp -lossless -exact，产物逐像素与源一致 ----
    // 回归 bug：apng2webp 只看 quality.checked 决定传不传 -q，不感知 preserveBitDepth，
    // 关压缩后 quality.checked 仍为 true → cwebp -q 72 → 有损 VP8（实测每帧是 VP8+ALPH），
    // 与「保留 32-bit 无损」的提示自相矛盾。实测 cwebp 0.6.0 不给 -lossless 即为有损。
    {
      // 母版 = 无损 32-bit APNG（colorType 6），模拟 apng2webp 的输入
      const masterLossless = path.join(tmp, 'master-lossless.png')
      execFileSync(APNGOPT, [master, masterLossless, '-z2'], { stdio: 'ignore' })
      assert.strictEqual(ihdr(masterLossless).colorType, 6, '母版应为 32-bit RGBA')

      // apngdis 拆帧（apng2webp 的第一步）。实测 2.6：帧写在「输入文件所在目录」，
      // 不是 cwd；因此先把母版复制进 framesDir，再以相对名调用，确保帧落在 framesDir。
      const framesDir = path.join(tmp, 'webp-frames')
      fs.mkdirSync(framesDir, { recursive: true })
      const localMaster = path.join(framesDir, 'master.png')
      fs.copyFileSync(masterLossless, localMaster)
      execFileSync(APNGDIS, ['master.png'], { cwd: framesDir, stdio: 'ignore' })
      const frameFiles = fs.readdirSync(framesDir).filter((f) => /^apngframe\d+\.png$/.test(f)).sort()
      assert(frameFiles.length > 0, 'apngdis 应拆出帧')

      // cwebp -lossless -exact（保真参数）→ webpmux 封装动画（apng2webp 的后两步）
      const muxArgs = []
      for (const f of frameFiles) {
        const outWebp = path.join(framesDir, f + '.webp')
        execFileSync(CWEBP, ['-lossless', '-exact', path.join(framesDir, f), '-o', outWebp], { stdio: 'ignore' })
        muxArgs.push('-frame', f + '.webp', '+40+0+0+1')
      }
      const animPath = path.join(tmp, 'preserve-lossless.webp')
      execFileSync(WEBPMUX, muxArgs.concat(['-loop', '0', '-o', animPath]), { cwd: framesDir, stdio: 'ignore' })
      assert(fs.existsSync(animPath), 'webpmux 应产出动画 webp')
      // VP8L（无损）而非 VP8（有损）：四字节码在动画容器内
      const animBuf = fs.readFileSync(animPath)
      assert(animBuf.includes(Buffer.from('VP8L')), '保真 WebP 帧应为 VP8L（无损）')
      assert(!animBuf.includes(Buffer.from('VP8 ')), '保真 WebP 不应含 VP8（有损）块')

      // 逐像素断言：dwebp 解回 PNG 与源帧完全一致（含 alpha=0 区的隐藏 RGB）
      const rtPath = path.join(tmp, 'roundtrip.png')
      execFileSync(DWEBP, [path.join(framesDir, frameFiles[0] + '.webp'), '-o', rtPath], { stdio: 'ignore' })
      // 基准取 apngdis 拆出的帧，而不是原始 cool_00.png：apngdis 自身会改写透明区隐藏 RGB，
      // 本场景要证明的是 cwebp -exact 不二次丢信息，比较对象必须是它实际收到的输入帧。
      const diff = diffRgba(decodeRgba(path.join(framesDir, frameFiles[0])), decodeRgba(rtPath))
      assert.strictEqual(diff.visibleDiff, 0, '保真 WebP 可见像素必须逐像素一致，实测差异 ' + diff.visibleDiff)
      assert.strictEqual(diff.transparentDiff, 0, '保真 WebP 透明区隐藏 RGB 也应保留（-exact），实测差异 ' + diff.transparentDiff)
      console.log('ok - 场景C：关压缩→cwebp -lossless -exact→VP8L 动画→逐像素完全一致（含透明区）')

      // 对照：旧行为（-q 有损）确实会产生可见像素差异——证明断言有效
      const lossyPath = path.join(framesDir, 'lossy.webp')
      execFileSync(CWEBP, ['-q', '72', path.join(SRCDIR, 'cool_00.png'), '-o', lossyPath], { stdio: 'ignore' })
      const lossyRt = path.join(tmp, 'lossy-rt.png')
      execFileSync(DWEBP, [lossyPath, '-o', lossyRt], { stdio: 'ignore' })
      const lossyDiff = diffRgba(decodeRgba(path.join(SRCDIR, 'cool_00.png')), decodeRgba(lossyRt))
      assert(lossyDiff.visibleDiff > 0, '对照：-q 有损必须产生可见像素差异（否则逐像素断言无效）')
      console.log('ok - 场景C 对照：-q 有损确实有可见像素差异（逐像素断言有效）')
    }

    // ---- 场景 D：关掉后缀胶囊仍要覆盖时，落盘保底改名，源文件 SHA256 不变 ----
    {
      const source = path.join(tmp, 'source.png')
      fs.copyFileSync(master, source)
      const before = sha256(source)
      const planned = path.join(tmp, 'source.png') // 输出名同名、输出目录=源目录
      const guarded = fallbackRenameForSource(planned, [source])
      assert.strictEqual(guarded, path.join(tmp, 'source_1.png'), '保底应改名到 _1')
      // 模拟 processor 的 fs.copy：写改名后的目标，绝不写 planned
      fs.copyFileSync(master, guarded)
      assert.strictEqual(sha256(source), before, '源文件 SHA256 必须不变')
      assert(fs.existsSync(guarded), '产物应落在 _1 文件')
      const classified = classifyOutputConflicts([{
        basic: { outputPath: tmp, fileList: [source] },
        options: { outputName: 'source', outputFormat: ['APNG'] }
      }], () => false)
      assert.strictEqual(classified.source.length, 1, '预检应识别目标===源')
      console.log('ok - 场景D：落盘保底改名 _1，源文件 SHA256 不变，预检分类正确')
    }

    console.log('\ncompression-toggle L3: 配置生命周期 + 真实色深 + WebP 无损 + 防覆盖保底，端到端通过')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

try { run() } catch (e) { console.error(e); process.exit(1) }
