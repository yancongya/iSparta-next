import _ from 'lodash'
import { ipc, path, os, getProcessBridge, getFs } from '../node-env'

const procEnv = getProcessBridge()
ipc.send('get-app-path')
var basePath = ''
ipc.on('got-app-path', function(path) {
  basePath = path
})

function fsSyncExists (p) {
  try {
    var f = getFs()
    return !!(f && f.existsSync && f.existsSync(p))
  } catch (e) {
    return false
  }
}

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
    var exe = (pf == 'win32' || pf == 'win64') ? (exec + '.exe') : exec
    // 多候选：CEP 装机布局可能是 bin/（扁平）或 ui/bin/<pf>/；开发用 public/bin/<pf>/
    // 禁止 path.join(x, '/bin/') 前导斜杠——部分环境下会拼歪
    var bases = []
    if (basePath) {
      var bp = String(basePath).replace(/^file:\/+/i, '').replace(/[\\/]+$/, '')
      bases.push(bp)
    }
    if (procEnv.env.NODE_ENV == 'development' && procEnv.cwd) {
      try { bases.push(procEnv.cwd()) } catch (eCwd) { /* ignore */ }
    }
    var rels = [
      ['bin', pf],
      ['bin'],
      ['ui', 'bin', pf],
      ['ui', 'bin'],
      ['public', 'bin', pf],
      ['static', 'bin', pf]
    ]
    for (var i = 0; i < bases.length; i++) {
      for (var j = 0; j < rels.length; j++) {
        var parts = [bases[i]].concat(rels[j]).concat([exe])
        var cand = path.join.apply(path, parts)
        try {
          if (fsSyncExists(cand)) {
            ensureExecutable(path.dirname(cand), pf)
            return cand
          }
        } catch (eChk) { /* next */ }
      }
    }
    // 都找不到时仍返回旧布局，让 exec 报出真实路径便于排查
    var fallbackBase = basePath
      ? path.join(basePath, 'bin', pf)
      : path.join(procEnv.cwd(), 'public', 'bin', pf)
    ensureExecutable(fallbackBase, pf)
    return path.join(fallbackBase, exe)
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
    // 默认 30min 超时：大动画下工具挂死时进度会永久停住
    var execOptions = {
      maxBuffer: 1024 * 1024 * 64,
      timeout: (options && options.timeout) || 30 * 60 * 1000
    }
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
        // silent：探测性命令（如 webpmux 取帧到末尾）的预期失败，不写 convertFail、不解锁
        if (!(options && options.silent)) {
          store.dispatch('editProcess', {
            index: item.index,
            text: result && result.cancelled
              ? (locale.noticeConvertAborted || 'Conversion aborted')
              : locale.convertFail,
            schedule: -1
          })
        }
        // 不在此 setLock(false)：多任务批处理中单条命令失败会误开锁；由 processor 统一收口
        return Promise.reject({
          command: command,
          args: cleanArgs,
          cancelled: !!(result && result.cancelled),
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
