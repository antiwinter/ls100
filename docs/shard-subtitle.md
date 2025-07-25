# Subtitle Shard Component

Frontend shard component for subtitle-type content learning.

## File Structure
```
client/src/shards/subtitle/
├── SubtitleShard.js         # Core logic (detector, shard management, engine interface)
├── SubtitleShardEditor.jsx  # Configuration UI for EditShard page
├── SubtitleReader.jsx       # Reading UI component  
└── index.js                 # Export all functionality
```

## Content Detector Interface
```javascript
// SubtitleShard.js
export const detect = (filename, buffer) => {
  const content = buffer.toString('utf8')
  
  // Check file extension
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)
  
  // Check content pattern (timestamps + text)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)
  
  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : (hasPattern ? 0.7 : 0.0),
    metadata: parseMovieInfo(filename)
  }
}
```

## Shard Management Functions
```javascript
// SubtitleShard.js  
export const createShard = async (file, user) => {
  // 1. Upload subtitle file
  const result = await uploadSubtitle(file)
  
  // 2. Create shard with auto-detected metadata
  const shard = await createShardRecord({
    name: result.metadata.movie_name,
    owner: user.id,
    subtitles: [result.subtitle_id],
    cover: generateCover(result.metadata.movie_name)
  })
  
  return shard
}

export const generateCover = (title) => {
  // Text-based cover with movie title
  // Decent typography on gradient background
  return {
    type: 'text',
    title,
    style: 'movie-poster',
    background: 'gradient'
  }
}
```

## Editor Component Interface ✅ ENHANCED UI/UX
```javascript
// SubtitleShardEditor.jsx - Used in EditShard page
export const SubtitleShardEditor = ({ 
  mode, shardData, detectedInfo, onChange, onCoverClick 
}) => {
  // Language management with CSS ellipsis + long press
  // Cover preview (clickable to edit)
  // File information display
  // Learning language selection
  
  return (
    <Stack spacing={3}>
      {/* Cover Preview Section */}
      {/* Language Selection with Mobile-Optimized UI */}
      {/* Pro Features Toggle */}
    </Stack>
  )
}
```

**Key Features**:
- **CSS Ellipsis Filenames**: Accurate text truncation using `overflow: hidden; textOverflow: ellipsis`
- **Long Press Detection**: 500ms threshold for mobile + desktop compatibility
  - **Short Press**: Select learning language
  - **Long Press**: Show full filename in modal dialog
- **Cross-Platform Events**: `onMouseDown`/`onMouseUp` + `onTouchStart`/`onTouchEnd`
- **Visual Feedback**: Opacity changes during press, centered language chips
- **Tooltip Modal**: Full filename display with monospace font and word-break

### Mobile-Optimized Language Selection ✅
```javascript
// TruncatedFilename component with long press
const TruncatedFilename = ({ filename, isEnabled, onLongPress, onShortPress }) => {
  // 500ms long press detection
  // CSS ellipsis for accurate truncation
  // Event handling for touch + mouse
  // Visual press feedback
  
  return (
    <Typography sx={{
      overflow: 'hidden',
      textOverflow: 'ellipsis', 
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      opacity: isPressed ? 0.7 : 1
    }} />
  )
}
```

## Reader Component Interface
```javascript
// SubtitleReader.jsx
export const SubtitleReader = ({ shardId }) => {
  const [lines, setLines] = useState([])
  const [currentLine, setCurrentLine] = useState(0)
  
  // Load subtitle content
  // Display lines with timestamps  
  // Navigate next/previous
  // Handle word selection for learning
  
  return (
    <Box>
      {/* Subtitle display */}
      {/* Navigation controls */}
      {/* Word selection interface */}
    </Box>
  )
}
```

## Shard Engine Interface ✅ TYPE-AGNOSTIC
```javascript
// SubtitleShard.js - Engine exports for registry system
export const detect = (filename, buffer) => { ... }
export const getSuggestedName = (detectedInfo) => { ... }
export const createShard = async (file, options) => { ... }
export const generateCoverFromShard = (shard) => { ... }

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

## Export Interface
```javascript
// index.js - Re-export all functionality
export { 
  detect, 
  getSuggestedName,
  createShard, 
  generateCover,
  generateCoverFromShard,
  shardTypeInfo,
  EditorComponent,
  ReaderComponent
} from './SubtitleShard.js'
``` 