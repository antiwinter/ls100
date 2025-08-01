// App constants - build-time safe
export const APP = {
  name: 'LS100 - Learn English with Movies',
  short: 'LS100',
  desc: 'Interactive English learning using movie subtitles',
  tagline: 'Learn English with movie subtitles',
  version: '1.0.0',
  
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