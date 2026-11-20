// Focused regression checks for the CEP directory menu without loading Vue or AE.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const source = fs.readFileSync(path.join(__dirname, '../src/components/projectList/menu.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default rightMenu$/m, 'globalThis.testApi = { resolveOutDir, openOsDir }')
const calls = []
const errors = []
const context = {
  window: {
    ispartaCS: {
      evalScript: (script) => {
        calls.push(script)
        return Promise.resolve('true')
      }
    }
  },
  notice: { error: (...args) => errors.push(args) },
  ipc: { invoke: (...args) => { calls.push(args); return Promise.resolve('') } },
  console,
  require: () => { throw new Error('directory open must not launch a child process') },
  setTimeout
}
vm.runInNewContext(source, context, { filename: 'menu.js' })
const { resolveOutDir, openOsDir } = context.testApi
assert.strictEqual(resolveOutDir({ outputPath: 'D:\\renders\\final', projectPath: 'C:\\a.aep' }), 'D:\\renders\\final')
assert.strictEqual(resolveOutDir({ projectPath: 'C:\\work\\a.aep', compName: 'wrong-folder' }), 'C:\\work')

async function main () {
  openOsDir('C:\\用户\\a #1?\\输出')
  assert.strictEqual(calls[0], 'new Folder("C:\\\\用户\\\\a #1?\\\\输出").execute()')

  context.window.ispartaCS.evalScript = () => Promise.resolve('false')
  openOsDir('/Users/name/missing')
  await Promise.resolve()
  await Promise.resolve()
  assert.strictEqual(errors.length, 1)

  const electronCalls = []
  context.window.ispartaCS = undefined
  context.navigator = { userAgent: 'Electron' }
  context.ipc.invoke = (...args) => { electronCalls.push(args); return Promise.resolve('') }
  openOsDir('/Users/name/output')
  assert.deepStrictEqual(electronCalls[0], ['shell:openPath', '/Users/name/output'])

  // 任务条 UI 微调（§8）静态守卫：桌面/CEP 共用同一份源码
  const vue = fs.readFileSync(path.join(__dirname, '../src/components/projectList/projectList.vue'), 'utf8')
  const scss = fs.readFileSync(path.join(__dirname, '../src/components/projectList/projectList.scss'), 'utf8')
  assert(!/is-tag v-if="showOutPath"/.test(vue), '类型胶囊必须删除')
  assert(/class="item-headrow"/.test(vue) && /class="item-proc is-ellipsis"/.test(vue), '标题+路径同行、状态独立第二行')
  assert(/\$t\('statePending'\)/.test(vue), '状态空态须固定文案占位')
  assert(/<is-icon name="eye" size="sm" \/><\/button>/.test(vue), '预览入口图标须为 eye')
  assert(/isAnimatedSingle\(project\).*thumb__badge--fmt/s.test(vue), '动图封面须显示格式角标')
  assert(/splitImportButtons \(\)/.test(vue) && /openFolder\('file'\)/.test(vue) && /openFolder\('directory'\)/.test(vue), 'Win/Linux 须拆分导入按钮')
  assert(/\.side__btns \.iconbtn \{[\s\S]*?border-color: transparent[\s\S]*?background: transparent/.test(scss), '任务条按钮须去框')
  for (const f of ['zh-cn', 'zh-tw', 'en-us']) {
    const loc = fs.readFileSync(path.join(__dirname, '../src/locales/' + f + '.js'), 'utf8')
    assert(/"openFile"/.test(loc) && /"importImageFilter"/.test(loc) && /"statePending"/.test(loc), f + ' 缺 UI 文案 key')
  }
  console.log('projectList menu + task UI L1 OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
