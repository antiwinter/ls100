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

// Core API and modules
export {
  ankiApi,
  noteManager,
  cardRender,
  mediaManager,
  db,
  StudyEngine
} from './core'

// Parser utilities
export {
  parseApkgFile,
  importApkgData
} from './apkg/index.js'

// Study engine utilities
export {
  StudyEngine,
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
