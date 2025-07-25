# Global Import System ✅ IMPLEMENTED

## Overview
Universal file upload system that automatically detects content type and creates appropriate shards.

## Implementation Status

### GlobalImport Component ✅
**Location**: `client/src/components/GlobalImport.jsx`

**Features Implemented**:
- ✅ Drag-and-drop file upload
- ✅ File type detection using registered shard detectors  
- ✅ Auto-proceed to shard creation (no intermediate dialog)
- ✅ Processing progress with LinearProgress indicator
- ✅ Type-agnostic architecture via shard engine registry
- ✅ Error handling and user feedback

### Detection Registry ✅
Currently supports:
- **Subtitle Detection**: `.srt`, `.vtt`, `.ass` files + content pattern matching
- **Movie Info Parsing**: Filename analysis for movie name, year, language
- **Confidence Scoring**: Extension-based (90%) vs content-based (70%)

### Usage Flow ✅ STREAMLINED
1. **File Selection**: User drops file or clicks to browse
2. **Auto-Detection**: Run registered detectors, pick highest confidence winner
3. **Processing Indicator**: Show LinearProgress during detection and setup
4. **Direct Navigation**: Automatically navigate to EditShard page with detected info
5. **Shard Configuration**: User configures name, description, type-specific settings
6. **Creation**: Shard created via engine registry, return to home library

## Integration Points

### HeaderToolbar Integration ✅
- Import button in top-right corner
- Opens GlobalImport modal overlay
- Closes on successful upload or cancel

### Shard Creation Flow ✅ ENGINE REGISTRY
1. **GlobalImport** detects content type and navigates to EditShard
2. **EditShard** uses `getSuggestedName()` and `getEditorComponent()` from engine registry
3. **User Configuration** via type-specific editor component
4. **Creation** via `createShard()` from engine registry + generic shard update
5. **Return** to home with new shard visible in ShardBrowser

## Future Extensibility

### Adding New Shard Types
To add new content types with the engine registry system:

1. **Implement Shard Engine Interface**:
```javascript
// In your-shard/YourShard.js
export const detect = (filename, buffer) => ({
  match: /\.(pdf|epub)$/i.test(filename),
  confidence: 0.9,
  metadata: { title: 'Extracted Title', pages: 200 }
})

export const getSuggestedName = (detectedInfo) => { ... }
export const createShard = async (file, options) => { ... }
export const shardTypeInfo = { name: 'book', displayName: 'Book', color: '#4CAF50' }
export const EditorComponent = BookShardEditor
export const ReaderComponent = BookReader
```

2. **Register in Engine Registry**:
```javascript
// In client/src/shards/engines.js
import * as bookEngine from './book/BookShard.js'

const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  book: bookEngine  // Add new engine
}
```

3. **Register Detector in GlobalImport**:
```javascript
// In client/src/components/GlobalImport.jsx
import * as book from '../shards/book'

const detectors = [
  { name: 'subtitle', ...subtitle },
  { name: 'book', ...book }
]
```

The system will automatically:
- Run all detectors on uploaded files
- Navigate to EditShard with detected info
- Load appropriate editor component dynamically
- Handle creation via engine registry 