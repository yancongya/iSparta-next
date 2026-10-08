import { path, fs } from '../node-env'
import action from './action'

export default function (item, store, locale) {
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
  return action.exec(action.bin('apng2gif'), [
    fileName,
    'out.gif'
  ], item, store, locale, { cwd: path.dirname(item.basic.fileList[0]) })
}
