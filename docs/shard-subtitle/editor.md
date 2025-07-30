# Engine Data Processing ✅ UNIFIED

## Data Processing Interface
Handles file uploads and prepares shard data for backend storage.

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
```

## Cover Generation
Dynamic text-based covers with consistent color selection.

```javascript
export const generateCover = (shard) => {
  // Enhanced cover generation with consistent gradients
  const title = shard.data?.languages?.[0]?.movie_name || shard.name
  
  // Create hash for consistent color selection
  let hash = 0
  const str = title || 'default'
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }
  
  // Select gradient from predefined set
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    // ... more gradients
  ]
  
  const selectedGradient = gradients[Math.abs(hash) % gradients.length]
  
  return {
    type: "text",
    title,
    background: selectedGradient,
    textColor: '#ffffff',
    formattedText: formatCoverText(title)
  }
}
```

## Data Structure
- **Languages Array**: Multiple subtitle files per shard
- **File Upload**: FormData handling for subtitle files
- **ID Mapping**: Convert uploaded files to subtitle_id references
- **Metadata**: Movie name, language codes, timestamps
- **Hash-based Colors**: Consistent cover colors per movie title

---

# Content Detector Interface ✅ ENHANCED

## Purpose
Automatic subtitle file detection with confidence scoring and metadata extraction.

## Detection Logic
- **File Extension**: Check for `.srt`, `.vtt`, `.ass`, `.ssa`, `.sub` extensions
- **Content Pattern**: Look for timestamp patterns (`HH:MM:SS,mmm` or `HH:MM:SS.mmm`)
- **Language Detection**: Analyze text content for language identification
- **Movie Info Parsing**: Extract movie name and metadata from filename

## Interface
```javascript
// SubtitleShard.js
export const detect = (filename, buffer) => {
  // Handle both ArrayBuffer (browser) and Buffer (Node.js)
  const content = buffer instanceof ArrayBuffer 
    ? new TextDecoder('utf-8').decode(buffer)
    : buffer.toString("utf8")
  
  // Check file extension and content patterns
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)
  
  // Enhanced metadata extraction
  const metadata = parseMovieInfo(filename)
  
  // Language detection from content
  if (hasExt || hasPattern) {
    const langDetection = detectLanguageWithConfidence(content)
    metadata.language = langDetection.language
    metadata.languageConfidence = langDetection.confidence
    metadata.textLinesCount = langDetection.textLinesCount
  }
  
  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : (hasPattern ? 0.7 : 0.0),
    metadata: {
      ...metadata,
      suggestedName: metadata?.movieName || null
    }
  }
}
```

## Confidence Scoring
- **0.9**: Strong match (correct file extension)
- **0.7**: Medium match (timestamp pattern found)
- **0.0**: No match (neither extension nor pattern)

## Language Detection
- **98+ Languages**: Frequency-based algorithm with confidence scoring
- **Text Analysis**: Count text lines vs total lines for accuracy
- **Fallback**: Filename-based detection if content analysis fails
- **Confidence**: Numeric score for detection reliability

## Movie Info Parsing
- **Filename Analysis**: Extract movie name, year, quality, language codes
- **Clean Names**: Remove common subtitle file artifacts
- **Metadata**: Year, resolution, language hints from filename
- **Suggested Names**: Generate human-readable shard names

---

# Editor Component Interface ✅ MAJOR UX OVERHAUL

## SubtitleShardEditor Interface
Enhanced configuration UI with unified data handling and improved mobile experience.

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

## Major Improvements
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

## Enhanced Mobile UX Components
Reusable components with improved touch interactions and visual feedback.

### LanguageBox Component
```javascript
const LanguageBox = ({ children, isMain, isAddButton, onClick, onLongPress }) => {
  const longPressHandlers = useLongPress(onLongPress, onClick, { delay: 500 })
  
  return (
    <Box {...(!isAddButton ? longPressHandlers.handlers : { onClick })}>
      {/* Styled language container with proper touch feedback */}
    </Box>
  )
}
```

### TruncatedFilename Component
```javascript
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
```

### Long Press Utility Hook
```javascript
// Long press utility hook
export const useLongPress = (onLongPress, onClick, { delay = 500 } = {}) => {
  // Handles both mouse and touch events
  // Prevents context menu on long press
  // Provides consistent gesture recognition
}
```

## Touch Interaction Features
- **Long Press Detection**: 500ms delay for consistent gesture recognition
- **Cross-platform Support**: Handles both mouse and touch events
- **Context Menu Prevention**: Blocks browser context menu during long press
- **Visual Feedback**: Immediate response to touch interactions
- **Tooltip Management**: Auto-hide timers and click-to-show behavior