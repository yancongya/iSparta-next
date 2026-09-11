import { fs, path } from '../node-env'
import action from './action'
import apngCompress from './apngCompress'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.4
  })

	// copy filelist to temp dir
  var tmpDir = item.basic.tmpDir
  var numLen = item.basic.fileList.length.toString().split('').length
  fs.ensureDirSync(tmpDir)
  var firstPNG = 'apng' + action.pad(1, numLen) + '.png'

  var copyTasks = item.basic.fileList.map((file, index) => {
    var target = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.png')
    var p = fs.copy(file, target)
    if (item.options.delays && item.options.delays[index]) {
      var txtFile = path.join(tmpDir, 'apng' + action.pad(index + 1, numLen) + '.txt')
      p = p.then(() => fs.writeFile(txtFile, "delay=" + item.options.delays[index] * 1000 + "/1000"))
    }
    return p
  })

  return Promise.all(copyTasks).then(() => {
	// apngasm
    return action.exec(action.bin('apngasm'), [
      path.join(item.basic.tmpOutputDir, item.options.outputName + '.png'),
      path.join(tmpDir, firstPNG),
      '1',
      String(item.options.frameRate),
      '-l' + item.options.loop,
      '-kc'
    ], item, store, locale)
  }).then(() => {
		// reset fileList
    item.basic.fileList = [
      path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
    ]
    // 保留未压缩母版，供大小阈值降质量重压
    try {
      const assembled = path.join(item.basic.tmpOutputDir, item.options.outputName + '.png')
      const src = assembled + '-src.png'
      fs.copySync(assembled, src)
      item.basic.assembledApng = src
    } catch (e) { /* ignore */ }
    return apngCompress(item, 0, store, locale)
  })
}
