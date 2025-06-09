const { defineConfig } = require('@vue/cli-service')
module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: config => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .loader('vue-loader')
      .tap(options => {
        // Disable hot reload as it reloads all threeJS entities each time which is a huge performance hit
        options.hotReload = false
        return options
      })
  }
})
