module.exports = {
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
