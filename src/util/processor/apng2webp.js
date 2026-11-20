import { fs, path } from '../node-env'
import action from './action'
import { isPreserveBitDepth } from '../paletteConfig'

export default function (item, store, locale, opts) {
  store.dispatch('editProcess', {
    index: item.index,
    text: locale.outputing+' WEBP...',
    schedule: 0.8
  })

  var tmpDir = item.basic.tmpDir
  var gateOpts = opts && opts.markFail === false ? { markFail: false } : undefined
  return action.exec(action.bin('apngdis'), [
    item.basic.fileList[0]
  ], item, store, locale, gateOpts).then(() => {
    var data = fs.readFileSync(path.join(tmpDir, 'apngframe_metadata.json'), {encoding: 'utf-8'})
    var animation = JSON.parse(data)
    var frames = animation['frames']
    // 保真输出（关压缩、保留源 32-bit RGBA）：cwebp 必须走无损。
    // 实测 static/bin/win64/cwebp.exe 为 0.6.0——**不给 -lossless 即为有损 VP8**，
    // 透明区 RGB 还会被清零；`-exact` 单独给会被忽略，必须与 -lossless 同时给，
    // 才是「保留透明像素隐藏 RGB」的语义。两者组合实测逐像素完全一致
    // （含 alpha=0 区域的隐藏 RGB），故保真链路固定 -lossless -exact。
    var preserve = isPreserveBitDepth(item.options)
    var promises = frames.map(function (frame) {
      var png_frame_file = path.join(tmpDir, frame['src'])
      var webp_frame_file = path.join(tmpDir, frame['src'] + '.webp')
      var cwebpArgs = []
      if (preserve) {
        cwebpArgs.push('-lossless', '-exact')
      } else if (item.options.quality.checked) {
        cwebpArgs.push('-q', String(item.options.quality.value))
      }
      cwebpArgs.push(png_frame_file, '-o', webp_frame_file)
      return action.exec(action.bin('cwebp'), cwebpArgs, item, store, locale, gateOpts).then(() => {
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
    // 中间产物固定 ASCII 名 out.webp（与 index.js 的 apng2other / sizeGate 的 tmpPathFor 对齐；
    // 曾写 <outputName>.webp，中文名虽能落盘但下游按 out.webp 取，必然 ENOENT）
    return action.exec(action.bin('webpmux'), [
      ...frameArgs,
      '-loop', String(item.options.loop),
      '-o', path.join(item.basic.tmpOutputDir, 'out.webp')
    ], item, store, locale, Object.assign({ cwd: tmpDir }, gateOpts || {}))
  })
}

function _flatten (arrays) {
  return arrays.reduce(function (acc, cur) {
    return acc.concat(cur)
  }, [])
}
