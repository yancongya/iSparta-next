import fs from 'fs-extra'
import path from 'path'
import action from './action'
import PNGs2apng from './pngs2apng'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.analysing + '...',
    schedule: 0.4
  })

  var tmpDir = item.basic.tmpDir
  var webpDir = path.join(tmpDir, 'webp')
  var tmpFile = path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')
  fs.ensureDirSync(tmpDir)
  fs.ensureDirSync(webpDir)
  if (tmpFile != item.basic.fileList[0]) {
    fs.copySync(item.basic.fileList[0], tmpFile)
  }

  item.basic.fileList[0] = tmpFile

  return new Promise(function (resolve, reject) {
    getframe(item, store, locale, 1, (frames) => {
      var dwebpFunc = []
      for (let i = 1; i <= frames; i++) {
        dwebpFunc.push(action.exec(action.bin('dwebp'), [
          path.join(webpDir, i + '.webp'),
          '-o', path.join(webpDir, i + '.png')
        ], item, store, locale).then(() => {
          item.basic.fileList[i - 1] = path.join(webpDir, i + '.png')
          return item.basic.fileList[i]
        }))
      }
      Promise.all(dwebpFunc).then(() => {
        PNGs2apng(item, store, locale).then(() => {
          resolve()
        }).catch(reject)
      }).catch(reject)
    })
  })
}

function getframe (item, store, locale, frame, callback) {
  var webpDir = path.join(item.basic.tmpDir, 'webp')
  fs.ensureDirSync(webpDir)
  action.exec(action.bin('webpmux'), [
    '-get', 'frame', String(frame),
    item.basic.fileList[0],
    '-o', path.join(webpDir, frame + '.webp')
  ], item, store, locale).then(() => {
    getframe(item, store, locale, frame + 1, callback)
  }).catch(() => {
    if ((typeof callback) === 'function') {
      callback(frame - 1)
    }
  })
}
