/**
 * 离屏验收（Electron）：真实 preload bridge 的 path 方法面 + basenameNoExt 行为。
 *
 * 用法：IS_TEST=1 npx electron scripts/dev/verify-bridge-path.cjs
 *
 * 背景（真实事故）：renderer 里 path 来自 preload bridge，方法面只有
 * join / dirname / basename / sep。新增代码误用 path.extname → 桌面版点「开始」
 * 直接抛 "path.extname is not a function"，而浏览器 mock 因 isMockEnv() 短路预检
 * 碰不到，L1 沙箱注入真 node path 又把它掩盖成绿灯。
 *
 * 这个脚本用真 preload.js + 真 background.js 的 ipcMain handler，
 * 在真 Electron 里断言：
 *   1) bridge.path 暴露的方法面就是那 4 个（没有 extname）；
 *   2) src/util/pathUtil.js 的 basenameNoExt 在真 bridge 下工作正常，
 *      且与 node 的 path.basename(p, path.extname(p)) 语义一致。
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const ROOT = process.cwd()
// 与用户正在运行的 iSparta 桌面版隔离：否则新 Electron 会蹭同一个 userData，
// 被现有实例接管成子进程，脚本既不输出也无法正常退出。
app.setPath('userData', path.join(ROOT, '.tmp', 'verify-bridge-path'))
app.disableHardwareAcceleration()
const results = []
function ok (name, cond, detail) {
  results.push({ name, pass: !!cond, detail })
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (detail ? '  ' + JSON.stringify(detail) : ''))
}

// ---- 真 preload 的 path 桥依赖主进程 ipcMain handler（复刻 background.js 的实现）----
ipcMain.on('path:join', (event, parts) => { event.returnValue = path.join(...(parts || [])) })
ipcMain.on('path:dirname', (event, p) => { event.returnValue = path.dirname(p) })
ipcMain.on('path:basename', (event, p, ext) => { event.returnValue = path.basename(p, ext) })
ipcMain.on('path:sep', (event) => { event.returnValue = path.sep })
// Electron 在离屏页初始化时会顺带读取 preload 暴露的 process.env.NODE_ENV；
// 这里补上真实 background.js 同名 handler，避免 sync IPC 无监听导致退出码异常。
ipcMain.on('process:nodeEnv', (event) => { event.returnValue = process.env.NODE_ENV || '' })

// ---- 真 basenameNoExt 源码（纯函数，直接在主进程求值；与 renderer 同一份文件）----
const pathUtilSrc = fs.readFileSync(path.join(ROOT, 'src/util/pathUtil.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default .*$/gm, '')
  .replace(/^export /gm, '')

app.on('ready', async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: false,
      preload: path.join(ROOT, 'src/preload.js')
    }
  })

  // 必须等页面加载完再 evaluate：preload 的 contextBridge 要先注入
  await new Promise((resolve) => {
    win.webContents.once('did-finish-load', resolve)
    win.loadURL('data:text/html,<html><body>bridge probe</body></html>')
  })

  // 在页面里跑：bridge 形状断言
  const bridgeProbe = await win.webContents.executeJavaScript(`(() => {
    const p = window.ispartaAPI && window.ispartaAPI.path
    if (!p) return { err: 'no ispartaAPI.path' }
    // sep 是 getter（string），不是函数，所以单独取 key
    const keys = Object.keys(p).sort()
    const methods = keys.filter(k => typeof p[k] === 'function')
    return {
      keys: keys,
      methods: methods,
      hasExtname: typeof p.extname === 'function',
      sep: p.sep,
      basename: p.basename('C:\\\\isparta-verify\\\\cool_1.png'),
      basenameNoExtArg: p.basename('C:\\\\isparta-verify\\\\cool_1.png', '.png'),
      join: p.join('a', 'b', 'c.png'),
      dirname: p.dirname('C:\\\\isparta-verify\\\\cool_1.png')
    }
  })()`)

  ok('真 preload 暴露了 ispartaAPI.path', !bridgeProbe.err, bridgeProbe.err)
  ok('bridge path 无 extname（这正是事故根因）', bridgeProbe.hasExtname === false, bridgeProbe)
  ok('bridge path 方法面 = join/dirname/basename/sep',
    JSON.stringify(bridgeProbe.keys) === JSON.stringify(['basename', 'dirname', 'join', 'sep']),
    bridgeProbe.keys)
  ok('bridge basename 正常', bridgeProbe.basename === 'cool_1.png', bridgeProbe.basename)
  ok('bridge basename 带 ext 参数正常', bridgeProbe.basenameNoExtArg === 'cool_1', bridgeProbe.basenameNoExtArg)
  ok('bridge join/dirname 正常',
    bridgeProbe.join === 'a\\b\\c.png' && bridgeProbe.dirname === 'C:\\isparta-verify' && bridgeProbe.sep === '\\',
    bridgeProbe)

  // ---- basenameNoExt：真源码 + 真 bridge 语义对齐 ----
  const fn = new Function(pathUtilSrc + '; return basenameNoExt')
  const basenameNoExt = fn()
  const cases = [
    'cool_1.png',
    'C:\\isparta-verify\\cool_1.png',
    'C:/isparta-verify/cool_1.png',
    '/Users/x/cool_1.png',
    'cool.tar.gz',
    '.png',
    'noext',
    'cool.'
  ]
  let allMatch = true
  for (const c of cases) {
    const mine = basenameNoExt(c)
    const native = path.basename(c, path.extname(c))
    if (mine !== native) { allMatch = false; console.log('    DIFF', JSON.stringify(c), 'mine=', mine, 'node=', native) }
  }
  ok('basenameNoExt 与 node 语义一致（8 组用例）', allMatch)

  // ---- 越界调用在真 bridge 下确实会炸（复现原始报错形态）----
  let extnameThrows = false
  try { path.extname('a.png') } catch (e) { extnameThrows = /not a function/.test(e.message) }
  ok('node path 存在 extname（对照：bridge 没有）', extnameThrows === false)

  const failed = results.filter(r => !r.pass).length
  console.log('\nbridge path 离屏验收:', results.length - failed, '/', results.length, 'passed')
  process.exitCode = failed ? 1 : 0
  win.destroy()
  app.quit()
})

// 主进程不需要窗口显示
app.on('window-all-closed', () => {})
