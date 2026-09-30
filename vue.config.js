module.exports = {
  // 关掉生产 source map：默认 true 会把 .map 打进产物，
  // 等于把全部源码（含注释）随安装包发给每个用户，且体积翻倍
  productionSourceMap: false,
  pluginOptions: {
    electronBuilder: {
      preload: 'src/preload.js',
      nodeIntegration: false
    }
  },
  chainWebpack: (config) => {
    // electron-renderer target 会把 Node builtin 打成 require() external，
    // nodeIntegration:false 时 HMR 的 events 依赖会直接白屏
    config.target('web')
    config.resolve.alias.set('events', require.resolve('events/'))
    try { config.plugins.delete('hmr') } catch (e) { /* ignore */ }

      },
  configureWebpack: {
    target: 'web'
  },
  devServer: {
    // Electron 关 HMR；CEP serve（BUILD_TARGET=cep）开热更
    hot: process.env.BUILD_TARGET === 'cep',
    liveReload: false,
    inline: false,
    // HMR 下让 /lib/cep-bridge.js 可解析到 targets/cep/lib（禁止打进 bundle）
    contentBase: process.env.BUILD_TARGET === 'cep'
      ? require('path').join(__dirname, 'targets', 'cep')
      : undefined
  }
}

// CEP 面板（W2u）：独立 entry 输出到 targets/cep/ui，复用 src/ui-next + util/processor
// 触发：BUILD_TARGET=cep（见 .env.cep 与 npm run build:cep / serve:cep）
if (process.env.BUILD_TARGET === 'cep') {
  module.exports.pages = {
    index: {
      entry: 'src/cep/main.js',
      template: 'src/cep/index.html',
      filename: 'index.html'
    },
    settings: {
      entry: 'src/cep/settings.js',
      template: 'src/cep/settings.html',
      filename: 'settings.html'
    }
  }
  module.exports.outputDir = 'targets/cep/ui'
  module.exports.publicPath = './'
  module.exports.filenameHashing = false
  module.exports.lintOnSave = false
}
