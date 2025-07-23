# Subtitle Shard Component

Frontend shard component for subtitle-type content learning.

## File Structure
```
client/src/shards/subtitle/
├── SubtitleShard.js      # Logic (detector, shard management)
├── SubtitleReader.jsx    # UI (reader component)  
└── index.js              # Export all functionality
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

## Export Interface
```javascript
// index.js
export { detect, createShard, generateCover } from './SubtitleShard.js'
export { SubtitleReader } from './SubtitleReader.jsx'
``` 