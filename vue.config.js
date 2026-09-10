const path = require('path')

module.exports = {
  pluginOptions: {
    electronBuilder: {
      preload: 'src/preload.js',
      nodeIntegration: false
    }
  },
  chainWebpack: (config) => {
    // nodeIntegration:false 时渲染层没有 require；webpack HMR 会 external "events" 调 require
    // 强制打成浏览器版 events，避免白屏
    config.resolve.alias.set('events', require.resolve('events/'))
  },
  devServer: {
    // 关闭 HMR，进一步避开 electron-renderer 的 Node external 问题
    hot: false,
    liveReload: false
  }
}
