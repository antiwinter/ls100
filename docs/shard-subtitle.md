# Subtitle Shard Engine

Engine module for subtitle-type content learning with enhanced UI and unified data processing.

## File Structure
```
client/src/shards/subtitle/
├── SubtitleShard.js         # Engine logic (detector, data processing, cover generation)
├── SubtitleShardEditor.jsx  # Enhanced configuration UI with long press & tooltips
├── SubtitleReader.jsx       # Reading UI component  
└── index.js                 # Export all functionality

server/shards/subtitle/
├── data.js                  # Server-side engine data operations
├── engine.js                # Server-side engine processing logic
└── migration.sql            # Engine-specific database tables
```

## Content Detector Interface ✅ ENHANCED
```javascript
// SubtitleShard.js
export const detect = (filename, buffer) => {
  // Handle both ArrayBuffer (browser) and Buffer (Node.js)
  let content;
  if (buffer instanceof ArrayBuffer) {
    content = new TextDecoder('utf-8').decode(buffer);
  } else {
    content = buffer.toString("utf8");
  }
  
  // Check file extension
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)
  
  // Check content pattern (timestamps + text)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)
  
  // Enhanced metadata extraction
  const metadata = parseMovieInfo(filename);
  
  // Language detection from content
  if (hasExt || hasPattern) {
    try {
      const langDetection = detectLanguageWithConfidence(content);
      metadata.language = langDetection.language;
      metadata.languageConfidence = langDetection.confidence;
      metadata.textLinesCount = langDetection.textLinesCount;
    } catch (langError) {
      console.warn('Language detection failed:', langError);
      metadata.languageConfidence = 0.3;
    }
  }
  
  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : (hasPattern ? 0.7 : 0.0),
    metadata: {
      ...metadata,
      // Include suggested name from movie parsing
      suggestedName: metadata?.movieName || null
    }
  }
}
```

## Engine Data Processing ✅ UNIFIED
```javascript
// SubtitleShard.js - Client-side engine functions
export const processData = async (shard, apiCall) => {
  // Upload files and prepare shard for backend
  if (shard.data.languages && Array.isArray(shard.data.languages)) {
    for (const language of shard.data.languages) {
      if (language.file) {
        // Upload new file
        const formData = new FormData()
        formData.append("subtitle", language.file)
        formData.append("movie_name", language.movie_name || "Unknown Movie")
        formData.append("language", language.code || "en")

        const uploadResult = await apiCall("/api/subtitles/upload", {
          method: "POST",
          body: formData,
        })
        
        // Replace file with subtitle_id
        delete language.file
        language.subtitle_id = uploadResult.subtitle_id
      }
    }
  }
  
  // No conversion needed - keep { languages: [...] } format
}

export const generateCover = (shard) => {
  // Enhanced cover generation with consistent gradients
  const title = shard.data?.languages?.[0]?.movie_name || shard.name;
  
  // Create hash for consistent color selection
  let hash = 0;
  const str = title || 'default';
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  
  // Select gradient from predefined set
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    // ... more gradients
  ];
  
  const selectedGradient = gradients[Math.abs(hash) % gradients.length];
  
  return {
    type: "text",
    title,
    background: selectedGradient,
    textColor: '#ffffff',
    formattedText: formatCoverText(title)
  };
}
```

## Editor Component Interface ✅ MAJOR UX OVERHAUL
```javascript
// SubtitleShardEditor.jsx - Enhanced with unified data handling
export const SubtitleShardEditor = ({ 
  mode, shardData, detectedInfo, onChange 
}) => {
  // Unified data handling: process detectedInfo into shardData.data
  // Enhanced language management with visual improvements
  // Tooltip system for filename display
  // Real-time data validation
  
  return (
    <Stack spacing={3}>
      {/* Language Files Section with Enhanced UX */}
      {/* Pro Features (Disabled but Ready) */}
    </Stack>
  )
}
```

**Major Improvements**:
- **Unified Data Flow**: No more `initialFile` special handling - everything flows through `shardData.data`
- **Enhanced Language Management**: 
  - **Main Language Concept**: Replaces "enabled/disabled" with `isMain` flag
  - **Smart Movie Names**: Main language determines movie name for all languages
  - **Better Visual Hierarchy**: Solid chips for main, outlined for reference languages
- **Improved Touch UX**:
  - **Custom Hook**: `useLongPress()` utility for consistent gesture handling
  - **Tooltip System**: Click-to-show tooltips with auto-hide timers
  - **Component Extraction**: Reusable `LanguageBox` and `TruncatedFilename` components
- **Real-time Validation**: Engine-specific data validation and error handling

### Enhanced Mobile UX Components ✅
```javascript
// Reusable components with improved UX
const LanguageBox = ({ children, isMain, isAddButton, onClick, onLongPress }) => {
  const longPressHandlers = useLongPress(onLongPress, onClick, { delay: 500 })
  
  return (
    <Box {...(!isAddButton ? longPressHandlers.handlers : { onClick })}>
      {/* Styled language container with proper touch feedback */}
    </Box>
  )
}

const TruncatedFilename = ({ filename, isMain, showTooltip, onTooltipClose }) => {
  return (
    <Tooltip open={showTooltip} title={filename} placement="top" arrow>
      <Typography sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis', 
        whiteSpace: 'nowrap',
        color: isMain ? 'primary.700' : 'primary.500',
        userSelect: 'none'
      }} />
    </Tooltip>
  )
}

// Long press utility hook
export const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
  // Handles both mouse and touch events
  // Prevents context menu on long press
  // Provides consistent gesture recognition
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

## Engine Interface ✅ UNIFIED & CLEAN
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

**Function Updates**:
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