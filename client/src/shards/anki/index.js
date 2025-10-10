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
export { Browser } from './reader/Browser.jsx'
export { StudySession } from './reader/StudySession.jsx'
export { AnkiShardEditor } from './AnkiShardEditor.jsx'

// Core API - export the structured API
export { default as anki } from './core'

// Parser utilities
export {
  parseApkgFile,
  importApkgData
} from './apkg/index.js'

// Demo utilities
export {
  setupDemo,
  demoMultiCard,
  demoMedia,
  cleanupDemo
} from './demo/setupDemo.js'
