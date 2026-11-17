import { path, fs } from '../node-env'
import action from './action'
import appLog from '../../ui-next/log'
import { normalizePalette } from '../paletteConfig'

export default function (item, store, locale, opts) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' GIF...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir
  // 中间产物固定 ASCII 名：输入 out-gif.png（刻意不复用 out.png —— sizeGate 重压时
  // fileList[0] 是 out-quant.png，若拷进 out.png 会把最终 APNG 产物覆盖掉）
  var tmpFile = path.join(item.basic.tmpOutputDir, 'out-gif.png')

  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  var fileName = path.basename(item.basic.fileList[0])
  var gateOpts = opts && opts.markFail === false ? { markFail: false } : undefined
  return action.exec(action.bin('apng2gif'), [
    fileName,
    'out.gif'
  ], item, store, locale, Object.assign({ cwd: path.dirname(item.basic.fileList[0]) }, gateOpts || {}))
    .then(function () {
      return reduceGifColors(item, store, locale)
    })
}

/**
 * 色深路线：gifsicle 把 GIF 调色板硬约束到 N 色（`--colors N`，实测 1.97：
 * 位置任意、输出全帧共享全局调色板；`-i` 是 interlace 不要带）。
 *
 * 为什么母版量化之外还要这一步：apngquant 内存不足跳过量化（apngQuantSkipped）时
 * 上游色数约束会失守，这里在格式层兜底；且 gifsicle 的 LZW 重编码通常更小。
 * 始终采用 gifsicle 产物（不做「取更小者」）：色深契约优先于体积，
 * 且 sizeGate 还有事后体积闸。
 *
 * 失败不阻断转换（与工具链软校验哲学一致）：上游母版量化通常已约束色数，
 * 保留 apng2gif 原产物即为兜底；工具缺失/损坏由 toolManifest 完整性诊断呈现。
 */
function reduceGifColors (item, store, locale) {
  var pal = normalizePalette(item.options)
  if (pal.mode !== 'colors') {
    return Promise.resolve()
  }
  var outGif = path.join(item.basic.tmpOutputDir, 'out.gif')
  var quantGif = path.join(item.basic.tmpOutputDir, 'out-gif-quant.gif')
  // markFail:false —— 增强步骤失败绝不把任务标红「生成失败」，由下方 catch 兜底
  return action.exec(action.bin('gifsicle'), [
    '--colors',
    String(pal.colors),
    outGif,
    '--output',
    quantGif
  ], item, store, locale, { markFail: false }).then(function () {
    if (fs.existsSync(quantGif)) {
      fs.copySync(quantGif, outGif)
    }
  }).catch(function (err) {
    var detail = String(err && (err.err || err.stderr || err.message) || err)
    appLog.warn('GIF 色深量化未执行（gifsicle），保留上游量化产物', detail)
  })
}
