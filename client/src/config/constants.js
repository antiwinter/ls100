/* global __APP_VERSION__, __BUILD_ID__ */
// App constants - build-time safe
// Determine version from build-time define or environment (when imported in Node via Vite config)
const VERSION = (typeof __APP_VERSION__ !== 'undefined'
  ? __APP_VERSION__
  : (typeof process !== 'undefined' && process.env && process.env.npm_package_version) || '0.0.0')
const BUILD_ID = (typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '')

export const APP = {
  name: 'LS100 - Learn English with Movies',
  short: 'LS100',
  desc: 'Interactive English learning using movie subtitles',
  tagline: 'Learn English with movie subtitles',
  version: VERSION,
  build: BUILD_ID,
  
  pwa: {
    display: 'standalone',
    orientation: 'portrait-primary',
    scope: '/',
    start: '/',
    categories: ['education', 'entertainment']
  },
  
  storage: {
    auth: 'ls100-auth',
    theme: 'ls100-mode', 
    colors: 'ls100-color-scheme',
    sort: 'ls100-shard-sort',
    prefs: 'ls100-prefs'
  }
}