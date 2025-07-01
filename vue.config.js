const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: config => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .loader('vue-loader');
  },
  publicPath: process.env.NODE_ENV === 'production'
    // ? '/craig-neeson-personal/'
    ? '/' // Not needed while using a custom domain
    : '/',
})
