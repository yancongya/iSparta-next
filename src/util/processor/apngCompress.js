import { path, fs } from '../node-env'
import action from './action'
import appLog from '../../ui-next/log'
import { normalizePalette, isPreserveBitDepth } from '../paletteConfig'

export default function (item, isLossless, store, locale, opts) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.compressing + '...',
    schedule: 0.6
  })

  var tmpDir = item.basic.tmpDir
  // 中间产物固定 ASCII 名 out.png / out-quant.png（避免中文 outputName 让工具失败）
  var tmpFile = path.join(item.basic.tmpOutputDir, 'out.png')
  // sizeGate 重压复用同一 item / tmpDir；每轮开始重置跳过标志，避免上一轮的
  // 内存跳过状态或残留 out-quant.png 污染本轮判断。
  item.basic.apngQuantSkipped = false
  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  var gateOpts = opts && opts.markFail ? { markFail: true } : (opts && opts.markFail === false ? { markFail: false } : undefined)

	// apngquant：两条路线互斥——
	// - 色深路线：位置参数色数档位 N（实测 2.10.1 不认 --colors 标志，且 N 必须在输入文件前），
	//   绝不传 --quality；
	// - 质量路线（现状）：--quality=0-X，绝不传色数。
	var pal = normalizePalette(item.options)
	var isColors = pal.mode === 'colors'
  // 量化开关：色深路线始终量化（用户选 C 档即是选减色，C256 也是索引化）；
  // 质量路线沿用 quality.checked 开关——关掉则纯无损 apngopt。
  // 保真输出（preserveBitDepth）优先级最高：无论哪条路线都跳过 apngquant，
  // 仅走 apngopt 无损，保住源 32-bit RGBA（apngquant 本质是量化器，必出 8-bit 索引）。
  if (isPreserveBitDepth(item.options) || (!isColors && !item.options.quality.checked)) {
    return apngopt(item, store, locale, gateOpts)
  } else {
    var quantArgs = [
      item.basic.fileList[0],
      '--output',
      path.join(item.basic.tmpOutputDir, 'out-quant.png'),
      '--force',
      item.options.floyd.checked ? ('--floyd=' + item.options.floyd.value) : ''
    ]
    if (isColors) {
      // 位置参数必须在输入文件之前（实测 `N input --output` 序会段错误/误判）
      quantArgs.unshift(pal.colors)
    } else if (item.options.quality.checked) {
      quantArgs.push('--quality=0-' + item.options.quality.value)
    }
    return action.exec(action.bin('apngquant'), quantArgs, item, store, locale, gateOpts).catch((err) => {
      const detail = String(err && (err.err || err.stderr || err.message) || err)
      if (!/out of memory|memory allocation|libpng failed/i.test(detail)) {
        throw err
      }
      // Keep the assembled APNG usable when quantization cannot allocate its
      // working buffers. Continue with lossless optimization; sizeGate can
      // still enforce the configured output limit and report an oversized file.
      item.basic.apngQuantSkipped = true
      appLog.warn('APNG 质量压缩内存不足，改用无损优化继续转换', detail)
      store.dispatch('editProcess', {
        index: item.index,
        text: locale.sizeLimitQuantMemoryFallback || '质量压缩内存不足，改用无损优化继续转换',
        schedule: 0.62
      })
      return false
    }).then(() => {
      // apngquant 的输出 out-quant.png 必须接回 apngopt 作为输入，否则 --quality
      // 只作用在一个没人读取的死文件上，最终 APNG 恒等于未量化母版 —— 用户会看到
      // quality 设 100 还是 50 输出大小完全不变。
      // 只有量化真正产物存在时才切换；内存不足跳过量化（catch 吞掉）时 out-quant.png
      // 不存在，保持指向母版 out.png，让 apngopt 走无损优化继续。
      const quantFile = path.join(item.basic.tmpOutputDir, 'out-quant.png')
      if (!item.basic.apngQuantSkipped && fs.existsSync(quantFile)) {
        item.basic.fileList[0] = quantFile
      }
      return apngopt(item, store, locale, gateOpts)
    }).then(() => {
      // 收尾把 fileList[0] 指向规范化主文件 out.png（apngopt 的输出），而非 out-quant.png：
      // 否则下游 reExportFormat / 重压复检会读到重量化中间产物，且和首轮一致（首轮由
      // apng2other 重置为 out.png），消除 sizeGate 重压时的不变式隐患
      item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, 'out.png')
      return item
    })
  }
}
function apngopt (item, store, locale, opts) {
  return action.exec(action.bin('apngopt'), [
    item.basic.fileList[0],
    path.join(item.basic.tmpOutputDir, 'out.png'),
    '-z2'
  ], item, store, locale, opts)
}
