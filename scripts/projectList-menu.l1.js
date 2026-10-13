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
  console.log('projectList menu L1 OK')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
