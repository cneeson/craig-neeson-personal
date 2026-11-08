const { defineConfig } = require('@vue/cli-service')
const THREE = require('three')

// Mirrors @tresjs/core's `templateCompilerOptions` (ESM-only, so it can't be required here):
// <TresMesh>, <TresSphereGeometry> etc. map onto THREE classes and are handled by the Tres
// renderer rather than resolved as Vue components. Matching against THREE's exports (rather
// than just the prefix) keeps our own components resolvable. Avoid naming components Tres<ThreeClass>.
const isTresElement = tag => (tag.startsWith('Tres') && tag.slice(4) in THREE) || tag === 'primitive'

module.exports = defineConfig({
  transpileDependencies: true,
  chainWebpack: config => {
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap(options => ({
        ...options,
        compilerOptions: { ...(options && options.compilerOptions), isCustomElement: isTresElement },
      }))

    config.plugin('define').tap(([definitions]) => [{
      ...definitions,
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    }])
  },
  // Served from the root of the custom domain (see CNAME)
  publicPath: '/',
})
