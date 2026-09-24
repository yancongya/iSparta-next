import { path, fs } from '../node-env'
import action from './action'

export default function (item, isLossless, store, locale) {
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

	// apngquant
  if (!item.options.quality.checked) {
    return apngopt(item, store, locale)
  } else {
    return action.exec(action.bin('apngquant'), [
      item.basic.fileList[0],
      '--output',
      path.join(item.basic.tmpOutputDir, 'out-quant.png'),
      '--force',
      item.options.floyd.checked ? ('--floyd=' + item.options.floyd.value) : '',
      item.options.quality.checked ? ('--quality=0-' + item.options.quality.value) : ''
    ], item, store, locale).then(() => {
      item.basic.fileList[0] = path.join(item.basic.tmpOutputDir, 'out-quant.png')
      return apngopt(item, store, locale)
    })
  }
}
function apngopt (item, store, locale) {
  return action.exec(action.bin('apngopt'), [
    item.basic.fileList[0],
    path.join(item.basic.tmpOutputDir, 'out.png'),
    '-z2'
  ], item, store, locale)
}
