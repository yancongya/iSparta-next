// Vue CLI 4 在处理 --skip-plugins 前就 require 插件；从服务元数据中排除 Electron。
const path = require('path')
const Service = require('@vue/cli-service/lib/Service')
const root = path.resolve(__dirname, '../..')
const pkg = JSON.parse(JSON.stringify(require('../../package.json')))
delete pkg.devDependencies['vue-cli-plugin-electron-builder']
const raw = process.argv.slice(2)
const args = require('minimist')(raw)
const landingDemo = args._[0] === 'build' && args.mode === 'landing-demo'
if (!landingDemo && !['serve', 'lint'].includes(args._[0])) throw new Error('UI 入口仅支持 serve / lint / landing-demo 构建')
if (landingDemo) {
  process.env.NODE_ENV = 'production'
  process.env.VUE_APP_LANDING_DEMO = '1'
}
new Service(root, { pkg }).run(args._[0], args, raw).catch(error => {
  console.error(error)
  process.exitCode = 1
})
