// Focused regression checks for the CEP directory menu without loading Vue or AE.
const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const source = fs.readFileSync(path.join(__dirname, '../src/components/projectList/menu.js'), 'utf8')
  .replace(/^import .*$/gm, '')
  .replace(/^export default rightMenu$/m, 'globalThis.testApi = { fileUrlOf, resolveOutDir, openOsDir }')
const calls = []
const errors = []
const context = {
  window: { ispartaCS: { openURLInDefaultBrowser: (url) => { calls.push(url); return true } } },
  notice: { error: (...args) => errors.push(args) },
  ipc: {},
  console,
  require: () => { throw new Error('CEP must not launch a child process') },
  setTimeout
}
vm.runInNewContext(source, context, { filename: 'menu.js' })
const { fileUrlOf, resolveOutDir, openOsDir } = context.testApi
assert.strictEqual(fileUrlOf('C:\\用户\\a #1?\\输出'), 'file:///C:/%E7%94%A8%E6%88%B7/a%20%231%3F/%E8%BE%93%E5%87%BA')
assert.strictEqual(fileUrlOf('/Users/name/输出 #1'), 'file:///Users/name/%E8%BE%93%E5%87%BA%20%231')
assert.strictEqual(fileUrlOf('\\\\server\\share\\输出'), 'file://server/share/%E8%BE%93%E5%87%BA')
assert.strictEqual(resolveOutDir({ outputPath: 'D:\\renders\\final', projectPath: 'C:\\a.aep' }), 'D:\\renders\\final')
assert.strictEqual(resolveOutDir({ projectPath: 'C:\\work\\a.aep', compName: 'wrong-folder' }), 'C:\\work')
openOsDir('C:\\用户\\a #1?\\输出')
assert.strictEqual(calls[0], 'file:///C:/%E7%94%A8%E6%88%B7/a%20%231%3F/%E8%BE%93%E5%87%BA')
context.window.ispartaCS.openURLInDefaultBrowser = () => false
context.window.ispartaCS.evalScript = (_script, callback) => callback('false')
openOsDir('C:\\missing')
assert.strictEqual(errors.length, 1)
console.log('projectList menu L1 OK')
