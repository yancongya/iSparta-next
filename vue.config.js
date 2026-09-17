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
    hot: false,
    liveReload: false,
    inline: false
  }
}
