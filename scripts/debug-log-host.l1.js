/**
 * L1：本地调试日志「宿主适配 + 两处开关 + 自动开启」接线守卫（纯 Node）
 * 用法：node scripts/debug-log-host.l1.js
 *
 * 这个功能是纯 UI/宿主接线 bug 高发区（L1 沙箱测不出真机渲染崩与层叠），
 * 本脚本锁定「三处开关共享同一 controller」「持久化字段双防线」「桌面/CEP 端口分离」等契约。
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let passed = 0
let failed = 0
function ok (name, cond, detail) {
  if (cond) { passed++; console.log('  PASS', name) } else { failed++; console.log('  FAIL', name, detail == null ? '' : JSON.stringify(detail)) }
}
function read (rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8') }

function run () {
  const host = read('src/util/debugLogHost.js')
  const log = read('src/ui-next/log.js')
  const panel = read('src/ui-next/components/IsLogPanel.vue')
  const setting = read('src/components/globalSetting/globalSetting.vue')
  const home = read('src/ui-next/views/Home.vue')
  const bg = read('src/background.js')
  const preload = read('src/preload.js')
  const store = read('src/store/index.js')
  const zh = read('src/locales/zh-cn.js')
  const tw = read('src/locales/zh-tw.js')
  const en = read('src/locales/en-us.js')

  // ---- 端口分离（两端不争用，且避开参考项目 48763）----
  ok('桌面端口 48764', /48764/.test(host) && /48764/.test(bg))
  ok('CEP 端口 48765', /48765/.test(host))
  ok('未用参考项目端口 48763', !/48763/.test(host) && !/48763/.test(bg))

  // ---- 单一 controller 源：log.js 导出全局实例 ----
  ok('log.js 持有全局 controller', /createDebugLogController/.test(log) && /log\.debugLog\s*=/.test(log))
  ok('controller 注入 open 适配', /openDebugLogServer/.test(log))
  ok('两处开关均读 log.debugLog', /log\.debugLog|appLog\.debugLog/.test(panel) && /log\.debugLog/.test(setting))

  // ---- 日志面板开关：状态订阅 + 切换 + hover 文案 ----
  ok('日志面板订阅 controller', /debugLog\.subscribe/.test(panel))
  ok('日志面板切换 enable/disable', /debugLog\.enable\(\)/.test(panel) && /debugLog\.disable\(\)/.test(panel))
  ok('日志面板 hover 用连接信息', /connectionHint/.test(panel))
  ok('日志面板自动复制连接信息', /copyText/.test(panel))
  ok('日志面板无自绘弹窗', !/is-confirm|confirm\(/.test(panel))

  // ---- 通用设置：持久化字段 + 即时同步 controller ----
  ok('通用设置有 debugLogEnabled 计算属性', /debugLogEnabled/.test(setting))
  ok('通用设置写 setting.options.debugLog', /o\.debugLog/.test(setting))
  ok('通用设置即时同步 controller', /syncDebugLogController/.test(setting) && /c\.enable\(\)/.test(setting))
  ok('旧配置 debugLog 兜底', /typeof setting\.options\.debugLog\.enabled/.test(setting))
  ok('store 默认也有 debugLog 兜底', /'debugLog'/.test(store) && /enabled: false/.test(store))

  // ---- 自动开启：从持久位读取 ----
  ok('Home 有自动开启入口', /autoStartDebugLog/.test(home) && /c\.enable\(\)/.test(home))
  ok('自动开启读 globalSetting 持久位', /setting\.options\.debugLog\.enabled/.test(home))
  ok('页面卸载停服务', /debugLog\.dispose\(\)/.test(home))

  // ---- 常规设置端口配置（两端各自默认 + 立即生效）----
  ok('host 导出端口规范化', /export function normalizeDebugLogPort/.test(host))
  ok('host 导出当前端口读取', /export function currentDebugLogPort/.test(host))
  ok('host 导出显式端口写入', /export function setDebugLogPort/.test(host))
  ok('host 导出是否显式配置', /export function hasConfiguredPort/.test(host))
  ok('桌面启动用当前端口', /bridge\.start\(currentDebugLogPort\(['"]desktop['"]\)\)/.test(host))
  ok('CEP 启动用当前端口', /currentDebugLogPort\(['"]cep['"]\)/.test(host))
  ok('log.js enable 前同步端口', /syncPortFromSetting\(\)/.test(log) && /hasConfiguredPort\(\)/.test(log))
  ok('通用设置 import 端口工具', /normalizeDebugLogPort/.test(setting) && /setDebugLogPort/.test(setting))
  ok('端口存 setting.options.debugLog.port', /debugLog.*port|o\.debugLog, 'port'/.test(setting))
  ok('端口改动立即重启服务', /onDebugPortChange/.test(setting) && /c\.disable\(\)[\s\S]{0,120}c\.enable\(\)/.test(setting))
  ok('端口默认按端回退', /this\.isCep \? CEP_DEBUG_LOG_PORT : DESKTOP_DEBUG_LOG_PORT/.test(setting))

  // ---- 桌面 IPC 闭环 ----
  ;['debugLog:start', 'debugLog:stop', 'debugLog:status', 'debugLog:feed'].forEach(function (ch) {
    ok('主进程注册 ' + ch + '', bg.indexOf(ch) >= 0)
    ok('preload 暴露 ' + ch + '', preload.indexOf(ch) >= 0)
  })
  ok('退出清理服务', /before-quit/.test(bg) && /stopDebugLogServer/.test(bg))

  // ---- 安全边界（源码级）----
  ok('桌面只绑回环', /DEFAULT_HOST/.test(bg))
  ok('服务在主进程（非 renderer require http）', /createDebugLogServer\(http/.test(bg))

  // ---- 三语 key 齐 ----
  const keys = ['debugToggle', 'debugStatusOff', 'debugStatusStarting', 'debugStatusReady',
    'debugStatusUnavailable', 'debugStatusError', 'debugPortBusy', 'debugHint',
    'debugInfoCopied', 'debugInfoCopyFailed', 'debugAutoStartTip',
    'debugPort', 'debugPortHint', 'debugPortChanged']
  keys.forEach(function (k) {
    ok('zh-cn 有 ' + k, zh.indexOf('"' + k + '"') >= 0)
    ok('zh-tw 有 ' + k, tw.indexOf('"' + k + '"') >= 0)
    ok('en-us 有 ' + k, en.indexOf('"' + k + '"') >= 0)
  })

  console.log('\ndebug-log-host L1:', passed, 'passed,', failed, 'failed')
  if (failed) process.exitCode = 1
}

run()
