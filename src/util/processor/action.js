import _ from 'lodash'
import { ipc, path, os, getProcessBridge } from '../node-env'

const procEnv = getProcessBridge()
ipc.send('get-app-path')
var basePath = ''
ipc.on('got-app-path', function(path) {
  basePath = path
})

const tmpDir = path.join(os.tmpdir(), 'iSparta')

var chmodDone = false
function ensureExecutable(dir, pf) {
  if (chmodDone) {
    return
  }
  chmodDone = true
  if (pf == 'win32' || pf == 'win64') {
    return
  }
  try {
    ipc.invoke('job:execFile', 'chmod', ['-R', '+x', dir], {})
  } catch (e) {
    console.warn('chmod failed:', e)
  }
}

export default class Action {
  constructor(state) {
    
    this.state = state
    this.format(state)
  }
  format(store) {
    var selectedItem = _.filter(store.state.items, {
      isSelected: true
    })
    this.items = JSON.parse(JSON.stringify(selectedItem))
    for (var i = 0; i < this.items.length; i++) {
      var item = this.items[i]
      item.index = i
      item.basic.tmpDir = path.join(tmpDir, Math.random().toString().replace('0.', ''))
      item.basic.tmpOutputDir = item.basic.tmpDir
    }
  }

  static bin(exec) {
    var pf = getOsInfo()
    var baseDir
    if (procEnv.env.NODE_ENV == 'development') {
      baseDir = path.join(procEnv.cwd(), '/public/bin/', pf)
    } else {
      baseDir = path.join(basePath, '/bin/', pf)
    }
    ensureExecutable(baseDir, pf)
    var bin = path.join(baseDir, exec)
    if (pf == 'win32' || pf == 'win64') {
      bin = bin + '.exe'
    }
    return bin
  }
  // add 0 to num
  static pad(num, n) {
    var len = num.toString().length
    while (len < n) {
      num = '0' + num
      len++
    }
    return num
  }
  static exec(command, args, item, store, locale, options) {
    var execOptions = { maxBuffer: 1024 * 1024 * 64 }
    if (options && options.cwd) {
      execOptions.cwd = options.cwd
    }
    var cleanArgs = args.filter(function(a) {
      return a !== '' && a !== null && a !== undefined
    })
    return ipc.invoke('job:execFile', command, cleanArgs, execOptions).then(function(result) {
      if (!result || !result.ok) {
        console.warn('command failed:', command, cleanArgs)
        console.warn('stdout:', result && result.stdout)
        console.warn('stderr:', result && result.stderr)
        console.warn(result && result.error)
        store.dispatch('editProcess', {
          index: item.index,
          text: locale.convertFail,
          schedule: -1
        })
        store.dispatch('setLock', false)
        return Promise.reject({
          command: command,
          args: cleanArgs,
          err: result && result.error
        })
      }
      return {
        command: command,
        args: cleanArgs
      }
    })
  }
}

function getOsInfo() {
  var _pf = navigator.platform
  var appVer = navigator.userAgent
  var _bit = ''
  if (_pf == 'Win32' || _pf == 'Windows') {
    if (appVer.indexOf('WOW64') > -1 || appVer.indexOf('Win64') > -1) {
      _bit = 'win64'
    } else {
      _bit = 'win32'
    }
    return _bit
  }
  if (_pf.indexOf('Mac') != -1) {
    return 'mac'
  } else if (_pf == 'X11') {
    return 'unix'
  } else if (String(_pf).indexOf('Linux') > -1) {
    return 'linux'
  } else {
    return 'unknown'
  }
}
