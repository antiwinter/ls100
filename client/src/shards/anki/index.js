// Export all Anki shard functionality
export {
  detect,
  generateCover,
  shardTypeInfo,
  EditorComponent,
  ReaderComponent,
  processData,
  cleanup
} from './AnkiShard.js'

export { AnkiReader } from './reader/AnkiReader.jsx'
export { AnkiShardEditor } from './AnkiShardEditor.jsx'
export { BrowseMode } from './reader/BrowseMode.jsx'
export { StudyMode } from './reader/StudyMode.jsx'

// Core API and modules - direct function exports
export {
  // API functions
  addTemplate,
  getTemplates,
  removeTemplate,
  getBundle,
  getCardsForBundles,
  removeBundles,
  addBundle,
  // Note functions
  create,
  get,
  update,
  delete,
  // Render functions
  render,
  // Media functions
  addMedia,
  removeMedia,
  retainMedia,
  replaceMediaUrls,
  getBundlesMediaStats,
  getMediaStatsForBundles,
  removeBundlesMedia,
  clearCache,
  // Study engine
  StudyEngine
} from './core'

// Parser utilities
export {
  parseApkgFile,
  importApkgData
} from './apkg/index.js'

// Study engine utilities
export {
  RATINGS,
  STATES,
  formatInterval,
  getRatingLabel
} from './core/studyEngine.js'

// Demo utilities
export {
  setupDemo,
  demoMultiCard,
  demoMedia,
  cleanupDemo
} from './demo/setupDemo.js'
