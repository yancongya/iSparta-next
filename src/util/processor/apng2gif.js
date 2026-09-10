import { path, fs } from '../node-env'
import action from './action'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' GIF...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')

  fs.ensureDirSync(tmpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  var fileName = path.basename(item.basic.fileList[0])
  return action.exec(action.bin('apng2gif'), [
    fileName,
    item.options.outputName + '.gif'
  ], item, store, locale, { cwd: path.dirname(item.basic.fileList[0]) })
}
