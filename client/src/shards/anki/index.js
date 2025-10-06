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
export { AnkiStudy } from './reader/AnkiStudy.jsx'

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
