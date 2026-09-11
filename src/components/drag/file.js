// 依赖库
import { fs, path } from '../../util/node-env'
import { resolveOutputPath } from '../../util/outputPath'
import _ from 'lodash'
// 正则匹配
const reg = {
  'PNGs': /.*\.png$/i,
    // 'WEBP': /.*\.webp$/i,
  'GIF': /.*\.gif$/i,
  'MP4': /.*\.mp4$/i
}

// 记录每次操作的文件
var recordPng = []

// 按 PNG chunk 结构扫描 acTL 判定 APNG（acTL 必在 IDAT 之前，位置不固定）
function isApngBuffer (buffer) {
  if (!buffer || typeof buffer.length !== 'number') {
    return false
  }
  const PNG_SIG = 8
  if (buffer.length < PNG_SIG + 8) {
    return false
  }
  const readUInt32BE = (buf, offset) => {
    if (typeof buf.readUInt32BE === 'function') {
      return buf.readUInt32BE(offset)
    }
    return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0
  }
  const ascii = (buf, start, end) => {
    if (typeof buf.toString === 'function' && !ArrayBuffer.isView(buf) === false && buf instanceof Uint8Array) {
      return String.fromCharCode.apply(null, Array.from(buf.subarray(start, end)))
    }
    if (typeof buf.toString === 'function') {
      return buf.toString('ascii', start, end)
    }
    return ''
  }
  let offset = PNG_SIG
  while (offset + 8 <= buffer.length) {
    const length = readUInt32BE(buffer, offset)
    let type = ''
    if (typeof buffer.toString === 'function' && !(buffer instanceof Uint8Array)) {
      type = buffer.toString('ascii', offset + 4, offset + 8)
    } else {
      type = String.fromCharCode(buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7])
    }
    if (type === 'acTL') {
      return true
    }
    if (type === 'IDAT' || type === 'IEND') {
      return false
    }
    offset += 12 + length
  }
  return false
}


// 文件深度
var maxDeep = 5
var deep

// store
var items = []

// 获取所有的文件夹
class actionFiles {
  getAllFiles (root) {
        // 拉取文件夹
    if (root.split(deep)[1].split('/').length < maxDeep) {
      let stats = fs.lstatSync(root)
      if (stats.isDirectory()) {
        var files = fs.readdirSync(root)
        files.forEach((file) => {
          var res = [],
            pathname = root + '/' + file,
            stat = fs.lstatSync(pathname)
          if (stat.isDirectory()) {
            res = res.concat(this.getAllFiles(pathname))
          }
          if (stat.isFile()) {
            this.getImageFormat(pathname)
          }
        })
      }
            // 拉取图片
      if (stats.isFile()) {
        this.getImageFormat(root)
      }
    } else {
      alert('最深支持5层~')
    }
  }
  getImageFormat (files) {
    var isApng
    let tempPng = []
    let pathname = path.dirname(files)
    for (var i in reg) {
      if (reg[i].test(files)) {
        if (i == 'PNGs') {
          var buffer = fs.readFileSync(files)
          if (isApngBuffer(buffer)) {
            this.writeBasic('APNG', pathname, [files])
          } else {
            recordPng.push(files)
          }
        } else {
          this.writeBasic(i, pathname, [files])
        }
      }
    }
  }

  writeBasic (format, address, fileList) {

    let temp = {}
    let globalSetting = JSON.parse(window.storage.getItem('globalSetting'))
    temp.basic = {}
    temp.options = globalSetting.options
    temp.basic.type = format
    if (format === 'PNGs') {
      // 序列帧：默认输出 {帧目录}/output，可由 outputTo 策略覆盖
      let folderName = path.basename(address)
      temp.options.outputName = folderName.replace(/[ ]/g, '') + '_apng'
      temp.basic.inputPath = address
      temp.basic.fileList = fileList
      temp.basic.outputPath = resolveOutputPath(temp, globalSetting.options)
    } else {
      //去除文件名空格
      temp.options.outputName = path.basename(fileList[0]).split('.')[0].replace(/[ ]/g, '') + '_' + globalSetting.options.outputSuffix
      temp.basic.inputPath = address + '/' + path.basename(fileList[0]).split('.')[0]
      temp.basic.fileList = fileList
      temp.basic.outputPath = resolveOutputPath(temp, globalSetting.options)
    }
    items.push(temp)
  }

  writePngBasic (PNGs) {
    // console.warn(PNGs)
    let tempPrefix = {}
    for (var i = 0; i < PNGs.length; i++) {
      let prefixpath = path.dirname(PNGs[i])
      let prefixname = path.basename(PNGs[i]).replace(/\d+\.png$/i, '')
      let prefix = prefixpath + prefixname
      // console.log(path.basename(PNGs[i]))
      if (!tempPrefix[prefix]) {
        tempPrefix[prefix] = []
        tempPrefix[prefix].push(PNGs[i])
      } else {
        tempPrefix[prefix].push(PNGs[i])
      }
      if (i == PNGs.length - 1) {}
    }

    for (var i in tempPrefix) {
      if (tempPrefix[i].length > 1) {
        this.writeBasic('PNGs', path.dirname(tempPrefix[i][0]), tempPrefix[i])
      }
    }
  }
}

// 文件处理
export const f = {

  readerFiles (dir) {
    return new Promise(function (resolve, reject) {
            //
      items = [], recordPng = []

      let operateFiles = new actionFiles()

      for (var i = 0; i < dir.length; i++) {
        if (dir[i].path) {
                    // 拖拽文件夹
          deep = dir[i].path
          operateFiles.getAllFiles(dir[i].path)
        } else {
                    // 选择文件夹
          deep = dir[i]
          operateFiles.getAllFiles(dir[i])
        }
      }

      operateFiles.writePngBasic(recordPng)
      // 目录里同时存在 PNG 序列与单张 APNG（常见为旧导出产物）时，只保留序列任务
      var pngsDirs = []
      items.forEach(function (item) {
        if (item.basic && item.basic.type === 'PNGs' && item.basic.fileList && item.basic.fileList[0]) {
          pngsDirs.push(path.dirname(item.basic.fileList[0]))
        }
      })
      if (pngsDirs.length) {
        items = items.filter(function (item) {
          if (!item.basic || item.basic.type !== 'APNG' || !item.basic.fileList || !item.basic.fileList[0]) {
            return true
          }
          var apngDir = path.dirname(item.basic.fileList[0])
          return !pngsDirs.some(function (d) {
            return apngDir === d ||
              apngDir.indexOf(d + path.sep) === 0 ||
              d.indexOf(apngDir + path.sep) === 0
          })
        })
      }
      resolve(items)
    })
  },
  basicFIle () {

  }

}
