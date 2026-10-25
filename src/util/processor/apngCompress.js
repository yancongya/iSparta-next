import { path, fs } from '../node-env'
import action from './action'
import appLog from '../../ui-next/log'

export default function (item, isLossless, store, locale, opts) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.compressing + '...',
    schedule: 0.6
  })

  var tmpDir = item.basic.tmpDir
  // 中间产物固定 ASCII 名 out.png / out-quant.png（避免中文 outputName 让工具失败）
  var tmpFile = path.join(item.basic.tmpOutputDir, 'out.png')
  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  var gateOpts = opts && opts.markFail ? { markFail: true } : (opts && opts.markFail === false ? { markFail: false } : undefined)

	// apngquant
  if (!item.options.quality.checked) {
    return apngopt(item, store, locale, gateOpts)
  } else {
    return action.exec(action.bin('apngquant'), [
      item.basic.fileList[0],
      '--output',
      path.join(item.basic.tmpOutputDir, 'out-quant.png'),
      '--force',
      item.options.floyd.checked ? ('--floyd=' + item.options.floyd.value) : '',
      item.options.quality.checked ? ('--quality=0-' + item.options.quality.value) : ''
    ], item, store, locale, gateOpts).catch((err) => {
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
