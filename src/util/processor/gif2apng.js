import { path, fs } from '../node-env'
import action from './action'
import apngCompress from './apngCompress'

export default function (item, store, locale) {
	// apngquant

  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing+'...',
    schedule: 0.4
  })

  var tmpDir = item.basic.tmpDir
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.gif')
  fs.ensureDirSync(tmpDir)
  // console.log(item)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile
  // console.log(1)
  var fileName = path.basename(item.basic.fileList[0])
  return action.exec(action.bin('gif2apng'), [
    fileName,
    item.options.outputName + '.png'
  ], item, store, locale, { cwd: path.dirname(item.basic.fileList[0]) }).then(() => {
    item.basic.fileList = [
      path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
    ]
    // 保留未压缩母版，供大小阈值降质量重压（与 pngs2apng 一致）
    try {
      const assembled = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
      const src = assembled + '-src.png'
      fs.copySync(assembled, src)
      item.basic.assembledApng = src
    } catch (e) { /* ignore */ }
    return apngCompress(item, 0, store, locale)
  })
}
