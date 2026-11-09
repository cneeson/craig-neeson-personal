/**
 * Marks a module as declining hot updates, so webpack reloads the page rather than swapping it.
 *
 * The scene's modules build three.js objects, GSAP timelines and window listeners when they're
 * first run, and the rest of the app holds on to them. A hot swap runs the module again beside
 * the old copy (each .vue file accepts its own updates, so a changed .ts dependency is re-run
 * from inside it), which left two scenes running. A full reload is the only clean restart.
 */
const VUE_HOT_RELOAD = '/* hot reload */\nif (module.hot) {'

module.exports = function noHotReload(source) {
  let code = source
  if (this.resourcePath.endsWith('.vue')) {
    // vue-loader's own block accepts the component's updates (and re-renders its template),
    // which webpack honours ahead of a decline, so it's switched off
    if (code.includes(VUE_HOT_RELOAD)) code = code.replace(VUE_HOT_RELOAD, '/* hot reload: declined */\nif (false) {')
    else this.emitWarning(new Error('vue-loader\'s hot reload block not found; this component may still hot swap'))
  }
  return `${code}\nif (import.meta.webpackHot) import.meta.webpackHot.decline();\n`
}
