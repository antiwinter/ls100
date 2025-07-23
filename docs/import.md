# Import System

## GlobalImport Component

Universal file import handler that automatically detects content type and routes to appropriate shard processor.

### File Location
```
client/src/components/GlobalImport.jsx
```

### Component Interface
```javascript
// GlobalImport.jsx
export const GlobalImport = ({ onComplete }) => {
  const [uploading, setUploading] = useState(false)
  const [detected, setDetected] = useState(null)
  
  const handleFileUpload = async (file) => {
    setUploading(true)
    
    // 1. Run all shard detectors
    const results = await runDetectors(file)
    
    // 2. Pick highest confidence match
    const winner = results.sort((a, b) => b.confidence - a.confidence)[0]
    
    // 3. Use winning shard's processor
    if (winner.confidence > 0.5) {
      const shard = await winner.processor.createShard(file, user)
      onComplete(shard)
    }
    
    setUploading(false)
  }
  
  return (
    <Box>
      {/* File drop zone */}
      {/* Upload progress */}
      {/* Detection results */}
    </Box>
  )
}
```

### Detection Registry
```javascript
// Import all shard detectors
import * as subtitle from '../shards/subtitle'
// import * as deck from '../shards/deck' (future)
// import * as book from '../shards/book' (future)

const detectors = [
  { name: 'subtitle', ...subtitle },
  // { name: 'deck', ...deck },
  // { name: 'book', ...book }
]

export const runDetectors = async (file) => {
  const buffer = await file.arrayBuffer()
  
  return detectors.map(d => ({
    name: d.name,
    processor: d,
    ...d.detect(file.name, buffer)
  }))
}
```

### Usage Flow
```
1. User drops/selects file → GlobalImport.jsx
2. runDetectors() calls all shard type detectors
3. Highest confidence detector wins (>0.5 threshold)
4. Winner's createShard() processes the file
5. onComplete() callback with created shard
6. Navigate to appropriate reader
```

### Error Handling
```javascript
// Handle detection failures
if (winner.confidence < 0.5) {
  // Show "unsupported file type" message
  // Allow manual type selection
}

// Handle upload failures  
catch (error) {
  // Show error message
  // Allow retry
}
``` 