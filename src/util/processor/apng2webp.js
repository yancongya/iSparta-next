import { fs, path } from '../node-env'
import action from './action'

export default function (item, store, locale) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' WEBP...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir
  return action.exec(action.bin('apngdis'), [
    item.basic.fileList[0]
  ], item, store, locale).then(() => {
    var data = fs.readFileSync(path.join(tmpDir, 'apngframe_metadata.json'), {encoding: 'utf-8'})
    var animation = JSON.parse(data)
    var frames = animation['frames']
    var promises = frames.map(function (frame) {
      var png_frame_file = path.join(tmpDir, frame['src'])
      var webp_frame_file = path.join(tmpDir, frame['src'] + '.webp')
      var cwebpArgs = []
      if (item.options.quality.checked) {
        cwebpArgs.push('-q', String(item.options.quality.value))
      }
      cwebpArgs.push(png_frame_file, '-o', webp_frame_file)
      return action.exec(action.bin('cwebp'), cwebpArgs, item, store, locale).then(() => {
        var delay = Math.round((frame['delay_num']) / (frame['delay_den']) * 1000)
        if (delay === 0) { // The specs say zero is allowed, but should be treated as 10 ms.
          delay = 10
        }
        var blend_mode = ''
        if (frame['blend_op'] === 0) {
          blend_mode = '-b'
        } else if (frame['blend_op'] === 1) {
          blend_mode = '+b'
        } else {
          throw new Error("Webp can't handle this blend operation")
        }
        return [
          '-frame',
          path.basename(webp_frame_file),
          '+' + delay + '+' + frame['x'] + '+' + frame['y'] + '+' + frame['dispose_op'] + blend_mode
        ]
      })
    })

    return Promise.all(promises).then(function (frameArgs) {
      return _flatten(frameArgs)
    })
  }).then((frameArgs) => {
    return action.exec(action.bin('webpmux'), [
      ...frameArgs,
      '-loop', String(item.options.loop),
      '-o', path.join(item.basic.tmpOutputDir, item.options.outputName + '.webp')
    ], item, store, locale, { cwd: tmpDir })
  })
}

function _flatten (arrays) {
  return arrays.reduce(function (acc, cur) {
    return acc.concat(cur)
  }, [])
}
