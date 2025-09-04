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
export { default as ankiApi } from './core/ankiApi.js'
export { default as noteManager } from './core/noteManager.js'
export { default as cardGen } from './core/cardGen.js'
export { default as mediaManager } from './core/mediaManager.js'
export { default as TemplateRenderer } from './core/templateEngine.js'

// Database
export { default as db } from './storage/db.js'

// Parser utilities
export {
  parseApkgFile,
  importApkgData
} from './parser/apkgParser.js'

// Study engine utilities
export {
  StudyEngine,
  RATINGS,
  STATES,
  formatInterval,
  getRatingLabel
} from './engine/studyEngine.js'

// Demo utilities
export {
  setupDemo,
  demoMultiCard,
  demoMedia,
  cleanupDemo
} from './demo/setupDemo.js'
