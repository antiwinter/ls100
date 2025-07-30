# Subtitle Shard Engine

Engine module for subtitle-type content learning with enhanced UI and unified data processing.

## File Structure
```
client/src/shards/subtitle/
├── SubtitleShard.js         # Engine logic (detector, data processing, cover generation)
├── SubtitleShardEditor.jsx  # Enhanced configuration UI with long press & tooltips
├── SubtitleReader.jsx       # Reading UI component  
├── reader/                  # Enhanced reader components
│   ├── ActionDrawer.jsx     # Bottom slide-up drawer
│   ├── ReaderToolbar.jsx    # Top slide-down toolbar  
│   ├── DictionaryDrawer.jsx # Context-aware dictionary
│   ├── SubtitleViewer.jsx   # Multi-language subtitle display
│   └── index.js             # Component exports
└── index.js                 # Export all functionality

server/shards/subtitle/
├── data.js                  # Server-side engine data operations
├── engine.js                # Server-side engine processing logic
└── migration.sql            # Engine-specific database tables
```

## Enhanced SubtitleReader Architecture

## Integration
- **SubtitleReader.jsx**: Main container orchestrating all reader components
- **State Management**: Local state with async backend sync via debounced worker
- **Touch Interactions**: Swipe gestures, tap selections, drawer positioning
- **Multi-Language**: Support for multiple subtitle files per shard

## Key Behaviors
- **Toolbar**: Slides down on viewer click, hides on outside click
- **ActionDrawer**: Configurable height (half/full screen), swipe dismiss
- **DictionaryDrawer**: Smart positioning based on selected word location
- **Word Selection**: Persistent state across lines, visual feedback

## Backend Requirements
- API endpoints for word selection CRUD operations
- Multi-language subtitle data structure
- Progress tracking for selected words
- Async state synchronization support

See individual component docs for detailed specifications.

---

# Engine Interface ✅ UNIFIED & CLEAN

## Client-Side Engine Exports
Registry system interface for subtitle shard type.

```javascript
// SubtitleShard.js - Engine exports for registry system
export const detect = (filename, buffer) => { ... }
export const processData = async (shard, apiCall) => { ... }
export const generateCover = (shard) => { ... }

// Type information for UI display
export const shardTypeInfo = {
  name: 'subtitle',
  displayName: 'Subtitle',
  color: '#2196F3'
}

// Component exports for dynamic loading
export const EditorComponent = SubtitleShardEditor
export const ReaderComponent = SubtitleReader
```

## Function Updates
- **Removed Legacy**: `getSuggestedName()` and `createShard()` replaced by unified data flow
- **Enhanced Detection**: `detect()` now includes language detection and suggested names
- **Data Processing**: `processData()` handles file uploads and data preparation
- **Cover Generation**: `generateCover()` uses shard data instead of separate parameters

**Cleaner API**: Engine functions now follow consistent patterns across all shard types

## Export Interface
```javascript
// index.js - Re-export all functionality
export { 
  detect, 
  processData,
  generateCover,
  shardTypeInfo,
  EditorComponent,
  ReaderComponent
} from './SubtitleShard.js'
```

## Server-Side Engine Module
Backend engine processing for subtitle-specific operations.

```javascript
// server/shards/subtitle/engine.js - Backend engine processing
export const getData = (shardId) => {
  // Return engine-specific data for shard (languages array)
}

export const processCreate = async (shard, data) => {
  // Handle subtitle-specific creation logic
}

export const processUpdate = async (shard, data) => {
  // Handle subtitle-specific update logic
}

export const validateData = (data) => {
  // Validate engine-specific data structure
}
```

## Engine Registry Integration
- **Type Safety**: Consistent interface across all shard engines
- **Dynamic Loading**: Components loaded on-demand based on shard type
- **Unified Processing**: Server-side engines handle database operations
- **Clean Abstraction**: Simplified API for engine consumers