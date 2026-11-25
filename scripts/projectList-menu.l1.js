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
  // F4 状态行高度稳定性：.item-proc 无 v-if 始终渲染 + min-height 占位，四态切换卡片不跳高度。
  // mock 实测 5 卡 pending→done 全 105→105、item-proc 恒 15px；锁死 CSS/模板契约防回归。
  assert(/class="item-proc is-ellipsis"[\s\S]{0,260}>\s*\{\{\s*\(project\.process/.test(vue) &&
    !/item-proc[^>]*v-if/.test(vue),
    'F4: 状态行 item-proc 须始终渲染（无 v-if），仅文案随状态切换')
  assert(/\.item-proc \{[\s\S]*?min-height: 15px/.test(scss),
    'F4: 状态行须 min-height:15px 占位（空态/进行中/完成/失败切态卡片不跳高度）')
  assert(/<is-icon name="eye" size="sm" \/><\/button>/.test(vue), '预览入口图标须为 eye')
  assert(/isAnimatedSingle\(project\).*thumb__badge--fmt/s.test(vue), '动图封面须显示格式角标')
  assert(/&__badge--fmt \{[\s\S]*?background: rgba\(0, 0, 0, 0\.66\)[\s\S]*?color: #fff/.test(scss), '格式角标须深色底白字、不按格式上强调色')
  assert(/openFolder \(e\)/.test(vue) && /e\.ctrlKey \|\| e\.metaKey/.test(vue) && /@click="openFolder\(\$event\)"/.test(vue),
    '导入按钮须为单按钮 + Ctrl/⌘ 修饰键分流（目录/文件），跨平台一致')
  assert(/\.side__btns \.iconbtn \{[\s\S]*?border-color: transparent[\s\S]*?background: transparent/.test(scss), '任务条按钮须去框')

  // B7 短列表空白交互：单击取消 / 双击全选 / 框选 / 外层兜底转发 + 两层 min-height 契约。
  // mock 实测 9/9：.mod-list 占满滚动区、按钮下空白命中 .mod-list、单击取消、双击全选、
  // 框选命中 3/5、样式失效（.mod-list 不占满）时外层 .ib-main__list 转发单击取消仍生效。
  const home = fs.readFileSync(path.join(__dirname, '../src/ui-next/views/Home.vue'), 'utf8')
  assert(/onBlankClick \(e\)/.test(vue) && /dispatch\('noneSelect'\)/.test(vue), 'B7: 单击空白须取消全部选中')
  assert(/onBlankDblclick \(e\)/.test(vue) && /dispatch\('allSelect'\)/.test(vue), 'B7: 双击空白须全选')
  assert(/onListMouseDown \(e\)/.test(vue) && /dispatch\('setMultiSelected'/.test(vue), 'B7: 空白拖拽框选须按索引集合写选中态')
  assert(/bindHostBlankEvents \(\)/.test(vue) && /host\.addEventListener\('click', this\._onHostBlankClick\)/.test(vue) &&
    /host\.addEventListener\('dblclick', this\._onHostBlankDblclick\)/.test(vue),
    'B7: 外层壳须绑定 click/dblclick 转发兜底（样式失效时仍可取消/全选）')
  assert(/outOfList[\s\S]{0,120}!t\.closest\('\.mod-list'\)/.test(vue), 'B7: 外层转发须排除列表内事件避免重复触发')
  assert(/\.mod-list \{[\s\S]{0,120}min-height: 100%/.test(scss), 'B7: .mod-list 基础 min-height:100% 承接短列表空白')
  assert(/\.ib-main__list > \* \{[\s\S]{0,80}min-height: 0/.test(home) &&
    /\.ib-main__list > \.mod-list \{[\s\S]{0,80}min-height: 100%/.test(home),
    'B7: 壳层 min-height:0 后须显式恢复 .mod-list 的 100%（短列表空白不被壳层吞掉）')
  for (const f of ['zh-cn', 'zh-tw', 'en-us']) {
    const loc = fs.readFileSync(path.join(__dirname, '../src/locales/' + f + '.js'), 'utf8')
    assert(/"openFile"/.test(loc) && /"importImageFilter"/.test(loc) && /"statePending"/.test(loc) && /"openFolderHint"/.test(loc), f + ' 缺 UI 文案 key')
  }
  console.log('projectList menu + task UI L1 OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
