const { defineConfig } = require('@vue/cli-service')
const path = require('path')
const THREE = require('three')

// Mirrors @tresjs/core's `templateCompilerOptions` (ESM-only, so it can't be required here):
// <TresMesh>, <TresSphereGeometry> etc. map onto THREE classes and are handled by the Tres
// renderer rather than resolved as Vue components. Matching against THREE's exports (rather
// than just the prefix) keeps our own components resolvable. Avoid naming components Tres<ThreeClass>.
const isTresElement = tag => (tag.startsWith('Tres') && tag.slice(4) in THREE) || tag === 'primitive'

// Modules that build the scene, or hold what it reads, reload the page in dev instead of hot
// swapping (see build/no-hot-reload-loader.js). The panels' templates and all styles still hot reload.
const SCENE_SOURCES = [path.resolve(__dirname, 'src/scene'), path.resolve(__dirname, 'src/services')]
const SCENE_COMPONENTS = ['App.vue', 'PlanetScene.vue', 'belfast-photo.vue', 'cloud-veil.vue', 'city-signs.vue',
  'skill-signs.vue', 'planet-hud.vue']
const isSceneModule = file => SCENE_SOURCES.some(dir => file.startsWith(dir + path.sep))
  || SCENE_COMPONENTS.includes(path.basename(file))

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

    // Tres reaches for `THREE.Timer` (three r179+) only after checking the revision, and falls back to `Clock` on
    // ours, so the missing export is fine there
    config.module
      .rule('tres-optional-exports')
      .test(/\.m?js$/)
      .include.add(path.resolve(__dirname, 'node_modules/@tresjs')).end()
      .parser({ exportsPresence: false })

    // On the .ts modules and each component's own module (not its ?vue&type=... blocks, so a
    // style edit is still swapped in place), after they're compiled
    config.when(process.env.NODE_ENV === 'development', config => config.module
      .rule('no-hot-reload')
      .enforce('post')
      .test(/\.(ts|vue)$/)
      .include.add(isSceneModule).end()
      .resourceQuery(query => !query)
      .use('no-hot-reload')
      .loader(path.resolve(__dirname, 'build/no-hot-reload-loader.js')))

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
