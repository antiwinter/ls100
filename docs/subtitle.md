# Subtitle Module

## Database Schema

```sql
-- Subtitles table
CREATE TABLE subtitles (
  subtitle_id TEXT PRIMARY KEY,  -- SHA256 hash
  filename TEXT NOT NULL,
  movie_name TEXT NOT NULL,
  language TEXT NOT NULL,
  duration TEXT NOT NULL,
  ref_count INTEGER DEFAULT 1,
  first_uploaded TEXT NOT NULL
);

CREATE INDEX idx_subtitles_movie ON subtitles(movie_name);
```

## Two-Layer Storage Architecture

### Layer 1: Abstract Storage (OSS-like)

```js
// utils/storage.js - Abstract storage operations
export class Storage {
  constructor(config) {
    this.type = config.type // 'local' | 'minio' | 's3'
    this.basePath = config.basePath
  }

  async put(key, data) {
    if (this.type === 'local') {
      return this.putLocal(key, data)
    }
    // Future: this.putOSS(key, data)
  }

  async get(key) {
    if (this.type === 'local') {
      return this.getLocal(key)
    }
    // Future: this.getOSS(key)
  }

  async exists(key) {
    if (this.type === 'local') {
      return this.existsLocal(key)
    }
    // Future: this.existsOSS(key)
  }

  async delete(key) {
    if (this.type === 'local') {
      return this.deleteLocal(key)
    }
    // Future: this.deleteOSS(key)
  }

  // Local file system implementation
  putLocal(key, data) {
    const filePath = path.join(this.basePath, key)
    return fs.writeFile(filePath, data)
  }

  getLocal(key) {
    const filePath = path.join(this.basePath, key)
    return fs.readFile(filePath)
  }

  existsLocal(key) {
    const filePath = path.join(this.basePath, key)
    return fs.access(filePath).then(() => true).catch(() => false)
  }

  deleteLocal(key) {
    const filePath = path.join(this.basePath, key)
    return fs.unlink(filePath)
  }
}
```

### Layer 2: Subtitle Storage Logic

```js
// modules/subtitle/storage.js - Business logic layer  
import { Storage } from '../../utils/storage.js'

const storage = new Storage({
  type: 'local',
  basePath: path.join(__dirname, '../data/subtitles')
})

export const computeHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

export const uploadSubtitle = async (hash, buffer, metadata) => {
  // Check if exists
  const existing = await findByHash(hash)
  if (existing) {
    await incrementRef(hash)
    return { subtitle_id: hash, lightning: true, metadata: existing }
  }

  // Store file via abstract storage
  const filename = `${hash}.srt`
  await storage.put(filename, buffer)

  // Parse subtitle content
  const content = buffer.toString('utf8')
  const parsed = parseSrt(content)

  // Store metadata in database
  const subtitleData = {
    subtitle_id: hash,
    filename,
    movie_name: metadata.movie_name || 'Unknown Movie',
    language: metadata.language || 'en',
    duration: parsed.duration,
    ref_count: 1,
    first_uploaded: new Date().toISOString()
  }

  await create(subtitleData)
  return { subtitle_id: hash, lightning: false, metadata: subtitleData }
}

export const getSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  return await storage.get(filename)
}

export const deleteSubtitle = async (hash) => {
  const filename = `${hash}.srt`
  await storage.delete(filename)
  await remove(hash)
}
```

## API Endpoints

## Auto-Detection Features

### Movie Name Detection (from filename)
Parses common subtitle filename patterns to extract movie information:

```js
// Examples of supported patterns:
"The.Matrix.1999.720p.BluRay.x264-SPARKS.en.srt"
"[Group] Movie Name (2023) [720p].zh-CN.srt" 
"Movie.Name.2023.1080p.en.srt"

// Returns:
{
  movieName: "The Matrix",
  language: "en", 
  year: 1999
}
```

### Language Detection (from content)
Uses the **franc** library for highly accurate language detection:
- **Industry-standard accuracy**: Supports 400+ languages with statistical analysis
- **N-gram based**: Advanced pattern recognition using trigrams
- **High confidence scoring**: Professional-grade detection confidence (0.0 - 1.0)

**Supported Languages:** (All major languages including)
- **European**: English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Norwegian, Danish, Finnish, Polish, Czech, Hungarian, Turkish, etc.
- **East Asian**: Chinese (Mandarin), Japanese, Korean  
- **Other**: Arabic, Russian, Hindi, Thai, Hebrew, Vietnamese, Indonesian, Ukrainian, Bulgarian, Romanian, Croatian, Serbian, etc.
- **Total**: 400+ languages supported by franc

### Dual Language Detection
Detects subtitles containing multiple languages in the same file:

```js
// Example dual language subtitle:
1
00:00:01,000 --> 00:00:04,000
Hello, world!
你好世界！

// Detection result:
{
  isDual: true,
  confidence: 0.85,
  detectedBlocks: 8
}
```

## API Endpoints

### POST /api/subtitles/upload
Upload subtitle with auto-detection and lightning deduplication.

**Form data:**
- `subtitle`: SRT file (required)
- `movie_name`: Movie title (optional - auto-detected from filename)
- `language`: Language code (optional - auto-detected from content)
- `auto_detect`: Enable auto-detection (default: true)

**Response:**
```js
{
  subtitle_id: "abc123...",
  lightning: true/false,  // true = existing file
  metadata: { movie_name, language, duration, filename, auto_detected: {...} },
  suggestions: {
    movie_name: "The Matrix",
    language: {
      from_filename: "en",
      from_content: {
        language: "en", 
        confidence: 0.95,
        detected_as: "English"
      }
    },
    year: 1999
  }
}
```

### POST /api/subtitles/analyze  
Analyze subtitle file without uploading (get detection suggestions).

**Form data:**
- `subtitle`: SRT file

**Response:**
```js
{
  filename: "movie.en.srt",
  hash: "abc123...",
  existing: { movie_name, language, ref_count } || null,
  suggestions: {
    movie_name: "Movie Title",
    language: { from_filename: "en", from_content: {...} },
    year: 2023
  }
}
```

## Model Operations

```js
// modules/subtitle/data.js
export const create = (data) => {
  return db.prepare(`
    INSERT INTO subtitles VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.subtitle_id, data.filename, data.movie_name,
    data.language, data.duration, data.ref_count, data.first_uploaded
  )
}

export const findByHash = (hash) => {
  return db.prepare('SELECT * FROM subtitles WHERE subtitle_id = ?').get(hash)
}

export const incrementRef = (hash) => {
  return db.prepare('UPDATE subtitles SET ref_count = ref_count + 1 WHERE subtitle_id = ?').run(hash)
}

export const decrementRef = (hash) => {
  return db.prepare('UPDATE subtitles SET ref_count = ref_count - 1 WHERE subtitle_id = ?').run(hash)
}
```

## SRT Parsing

```js
import subtitle from 'subtitle'

export const parseSrt = (content) => {
  try {
    const parsed = subtitle.parse(content)
    
    const lines = parsed.length
    const firstTime = parsed[0]?.start || 0
    const lastTime = parsed[parsed.length - 1]?.end || 0
    const duration = Math.floor((lastTime - firstTime) / 1000)
    
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60
    const durationStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    
    return { lines, duration: durationStr, parsed }
  } catch (error) {
    throw new Error('Failed to parse SRT content')
  }
}
```

## Auto-Detection Implementation

### Filename Parsing (`modules/subtitle/detect.js`)
```js
export const parseMovieInfo = (filename) => {
  // Extract language from patterns: .en.srt, [zh-CN], etc.
  // Clean movie name: remove year, quality markers, group tags
  // Extract year: match 4-digit years (1900-2099)
  // Return: { movieName, language, year }
}
```

### Content Language Detection (`modules/subtitle/detect.js`)
```js
import { franc } from 'franc'

export const detectLanguageFromContent = (content) => {
  // Filter subtitle text (skip numbers, timestamps)
  // Use franc library for statistical language detection
  // Convert ISO 639-3 codes to ISO 639-1 (2-letter codes)
  // Return: { primary, confidence, detectedAs, francCode }
}
```

### Dual Language Detection (`modules/subtitle/detect.js`)
```js
export const detectDualLanguage = (content) => {
  // Count subtitle blocks with multiple writing systems
  // Return: { isDual, confidence, detectedBlocks }
}
```

## Lightning Upload Flow

1. **Auto-detect metadata**: Parse filename + analyze content
2. **Frontend uploads**: POST with file + optional overrides  
3. **Check existence**: Query database for hash
4. **If exists**: Increment ref_count, return instant response
5. **If new**: Store via abstract storage + save metadata with detection info

## Storage Migration Path

### Current: Local Files
```js
const storage = new Storage({ type: 'local', basePath: './data/subtitles' })
```

### Future: MinIO/S3
```js
const storage = new Storage({ 
  type: 'minio', 
  endpoint: 'localhost:9000',
  bucket: 'subtitles'
})
```

Same business logic, different storage backend. 