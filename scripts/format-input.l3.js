// L3（真实二进制）：各「输入格式」解码链路的端到端回归，上接全局测试审计的浅验证缺口。
// 转换引擎有 4 条输入分发（processor/index.js）：PNGs/Comp、GIF、APNG、WEBP。
// 此前只有 APNG 路线 + cwebp 输出被 compression-toggle.l3.js 真机覆盖；本脚本补齐输入端：
//   场景 A：GIF 输入 → gif2apng 真机 → 合法 APNG（证明这条链路可用，防回归）。
//   场景 B：WEBP 局部帧动画 → webpmux 拆帧尺寸不一致 → apngasm 合成失败。
//           这是 drag/file.js 里 WEBP 导入正则保持注释的**技术理由**，防止有人误以为底层已修好而解开。
//   场景 C：源码守卫——WEBP 导入正则必须仍是注释态（与场景 B 的真机证据互相锁定）。
// 用法：node scripts/format-input.l3.js（需 static/bin/win64 真实二进制 + test/{gif,webp}/cool.* 素材）
const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const BIN = path.join(ROOT, 'static', 'bin', 'win64')
const GIF2APNG = path.join(BIN, 'gif2apng.exe')
const WEBPMUX = path.join(BIN, 'webpmux.exe')
const DWEBP = path.join(BIN, 'dwebp.exe')
const APNGASM = path.join(BIN, 'apngasm.exe')
const GIF_SRC = path.join(ROOT, 'test', 'gif', 'cool.gif')
const WEBP_SRC = path.join(ROOT, 'test', 'webp', 'cool.webp')

function runQuiet (bin, args, opts) {
  return execFileSync(bin, args, Object.assign({ stdio: 'pipe' }, opts || {}))
}

/** 读 PNG 头：签名 / IHDR 尺寸 / 是否 APNG(acTL) / fcTL 帧数 */
function pngInfo (file) {
  const d = fs.readFileSync(file)
  const sig = d.slice(0, 8).toString('hex')
  const isPng = sig === '89504e470d0a1a0a'
  if (!isPng) return { isPng: false, sig }
  const s = d.toString('latin1')
  return {
    isPng: true,
    w: d.readUInt32BE(16),
    h: d.readUInt32BE(20),
    isApng: s.indexOf('acTL') >= 0,
    frames: (s.match(/fcTL/g) || []).length
  }
}

async function run () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'isparta-format-input-'))
  try {
    // ---------- 场景 A：GIF 输入 → gif2apng 真机 → 合法 APNG ----------
    {
      const gif = path.join(tmp, 'cool.gif')
      fs.copyFileSync(GIF_SRC, gif)
      // 与 gif2apng.js 一致：cwd=源目录，参数 = <文件名> <输出名.png>
      runQuiet(GIF2APNG, ['cool.gif', 'cool.png'], { cwd: tmp })
      const out = path.join(tmp, 'cool.png')
      assert(fs.existsSync(out), 'gif2apng 应产出 PNG')
      const info = pngInfo(out)
      assert(info.isPng, 'GIF→输出必须是合法 PNG')
      assert(info.isApng, 'GIF→输出必须是 APNG（含 acTL）')
      assert(info.frames > 1, 'GIF→APNG 帧数应 >1，实测 ' + info.frames)
      assert.strictEqual(info.w, 300, '宽度应为 300')
      console.log('ok - 场景A：GIF 输入 → gif2apng 真机 → 合法 APNG（' + info.frames + ' 帧 ' + info.w + 'x' + info.h + '）')
    }

    // ---------- 场景 B：WEBP 局部帧 → 拆帧尺寸不一致 → 合成失败 ----------
    {
      const webp = path.join(tmp, 'src.webp')
      fs.copyFileSync(WEBP_SRC, webp)
      // 严格按 webp2apng.js 源码参数：webpmux -get frame N <src> -o N.webp，直到失败
      let n = 1
      const sizes = new Set()
      for (; n <= 60; n++) {
        const frameWebp = path.join(tmp, n + '.webp')
        try {
          runQuiet(WEBPMUX, ['-get', 'frame', String(n), webp, '-o', frameWebp])
        } catch (e) {
          break // 取到末帧后 webpmux 必失败，属探测结束条件
        }
        const framePng = path.join(tmp, n + '.png')
        runQuiet(DWEBP, [frameWebp, '-o', framePng])
        const info = pngInfo(framePng)
        assert(info.isPng, '第 ' + n + ' 帧应是 PNG')
        sizes.add(info.w + 'x' + info.h)
      }
      const frames = n - 1
      assert(frames > 1, '应拆出多帧，实测 ' + frames)
      assert(sizes.size > 1,
        '该样本必须是局部帧动画（尺寸不一致），否则失去本回归意义')

      // 按 webp2apng → pngs2apng 现状：不同尺寸帧直接喂 apngasm 必然失败
      const args = []
      for (let i = 1; i <= frames; i++) args.push(path.join(tmp, i + '.png'))
      args.push('-o', path.join(tmp, 'merged.png'))
      let failed = false
      try {
        const r = execFileSync(APNGASM, args, { encoding: 'utf8', stdio: 'pipe' })
        // 若竟然合成成功，则该样本/工具链行为变了，本回归需要重新评估
        assert(!fs.existsSync(path.join(tmp, 'merged.png')),
          '预期不同尺寸帧合成失败，却产出了 merged.png——WEBP 支持可能已可用，请重新评估注释状态')
        void r
      } catch (e) {
        // execFileSync 非 0 退出即合成失败（apngasm: different image size）
        failed = true
      }
      assert(failed, '不同尺寸帧喂 apngasm 应失败；若成功说明底层已修，需重新评估 WEBP 输入')
      console.log('ok - 场景B：WEBP 局部帧（' + frames + ' 帧 / ' + sizes.size + ' 种尺寸）→ apngasm 合成失败 = 注释理由仍成立')
    }

    // ---------- 场景 C：源码守卫——WEBP 导入正则必须仍是注释态 ----------
    {
      const src = fs.readFileSync(path.join(ROOT, 'src', 'components', 'drag', 'file.js'), 'utf8')
      const active = /^\s*'WEBP':\s*\/\.\*\\\.webp\$\/i,/m.test(src)
      assert(!active,
        'drag/file.js 的 WEBP 导入正则被解开了——场景B 已证明局部帧会导致端到端失败，禁止解开')
      const commented = /\/\/\s*'WEBP':\s*\/\.\*\\\.webp\$\/i,/.test(src)
      assert(commented, 'WEBP 导入正则应保留为注释态（附技术理由见本脚本头注释）')
      console.log('ok - 场景C：源码守卫——WEBP 导入正则保持注释态（防止误解开导致转换失败）')
    }

    console.log('\nformat-input L3: GIF 输入端到端通过 + WEBP 输入限制锁定（注释理由有效），验证通过')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

try { run().catch(e => { console.error(e); process.exit(1) }) } catch (e) { console.error(e); process.exit(1) }
