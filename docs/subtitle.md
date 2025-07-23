# Subtitle Module

Backend subtitle management system with two-table storage architecture.

## Two-Table Storage Architecture

### Problem Solved
Previous architecture used file hash as subtitle_id, causing metadata conflicts when same content had different filenames/metadata.

### Solution: Separation of Content and Metadata

#### OSS Files Table (`server/utils/oss-files.js`)
```sql
CREATE TABLE oss_files (
  oss_id TEXT PRIMARY KEY,        -- SHA256 hash of file content
  ref_count INTEGER DEFAULT 1,    -- Number of subtitle records referencing this
  file_size INTEGER NOT NULL,     -- File size in bytes  
  created_at TEXT NOT NULL,       -- When first uploaded
  updated_at TEXT NOT NULL        -- Last reference update
);
```

**Purpose**: Content deduplication by hash
- One record per unique file content
- Reference counting for cleanup
- Shared across multiple subtitle records

#### Subtitles Table (`server/modules/subtitle/data.js`)
```sql
CREATE TABLE subtitles (
  subtitle_id TEXT PRIMARY KEY,   -- Unique ID (sub_timestamp_random)
  filename TEXT NOT NULL,         -- Original filename
  movie_name TEXT NOT NULL,       -- Parsed/provided movie name
  language TEXT NOT NULL,         -- Detected language (en, zh, etc.)
  duration TEXT NOT NULL,         -- Parsed duration (HH:MM:SS)
  oss_id TEXT NOT NULL,          -- References oss_files.oss_id
  created_at TEXT NOT NULL,       -- When created
  updated_at TEXT NOT NULL        -- Last updated
);
```

**Purpose**: Unique metadata per upload
- Each upload gets unique subtitle_id
- Same content can have different metadata
- Links to OSS file via oss_id

### OSS Files Management

The OSS files are managed by a separate utility module at `server/utils/oss-files.js` with operations:

```js
// OSS file operations
import * as ossModel from '../../utils/oss-files.js'

ossModel.create(oss_id, file_size)     // Create new OSS file record
ossModel.findById(oss_id)              // Find OSS file by hash
ossModel.incrementRef(oss_id)          // Add reference when subtitle created
ossModel.decrementRef(oss_id)          // Remove reference when subtitle deleted
ossModel.getOrphanedFiles()            // Get files with ref_count = 0 for cleanup
ossModel.remove(oss_id)                // Remove OSS file record after physical deletion
```

## Legacy Storage Implementation (Reference)

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

export const uploadSubtitle = async (oss_id, buffer, metadata) => {
  // Check for exact duplicate (same content + same metadata)
  const duplicate = findDuplicate(
    metadata.filename,
    metadata.movie_name,
    metadata.language,
    oss_id
  )
  
  if (duplicate) {
    // Exact same subtitle already exists - lightning upload
    return { subtitle_id: duplicate.subtitle_id, lightning: true, metadata: duplicate }
  }

  // Check if OSS file already exists
  let ossFile = ossModel.findById(oss_id)
  if (!ossFile) {
    // New file content - store it
    const filename = `${oss_id}.srt`
    await storage.put(filename, buffer)
    
    // Create OSS file record
    ossFile = ossModel.create(oss_id, buffer.length)
  } else {
    // File content exists, increment reference
    ossFile = ossModel.incrementRef(oss_id)
  }

  // Parse subtitle content for duration
  const content = buffer.toString('utf8')
  const parsed = parseSrt(content)

  // Create new subtitle record with unique metadata
  const subtitleData = {
    filename: metadata.filename,
    movie_name: metadata.movie_name || 'Unknown Movie',
    language: metadata.language || 'en',
    duration: parsed.duration,
    oss_id: oss_id
  }

  const subtitle = create(subtitleData)
  
  // Lightning if file content existed (but different metadata)
  const isLightning = ossFile.ref_count > 1
  
  return { 
    subtitle_id: subtitle.subtitle_id, 
    lightning: isLightning, 
    metadata: subtitle 
  }
}

export const getSubtitle = async (oss_id) => {
  const filename = `${oss_id}.srt`
  return await storage.get(filename)
}

export const deleteSubtitle = async (subtitle_id) => {
  const subtitle = findById(subtitle_id)
  if (!subtitle) return
  
  // Decrement OSS file reference
  const ossResult = ossModel.decrementRef(subtitle.oss_id)
  
  // If no more references, delete physical file
  if (ossResult.shouldDelete) {
    const filename = `${subtitle.oss_id}.srt`
    await storage.delete(filename)
    ossModel.remove(subtitle.oss_id)
  }
  
  // Remove subtitle record
  remove(subtitle_id)
}
```

## Upload Flow (Updated Architecture)

1. **File Upload**: POST `/api/subtitles/upload`
2. **Hash Computation**: SHA256 of file content → oss_id
3. **Duplicate Check**: Check for exact metadata match (filename + movie + language + oss_id)
4. **Auto-Detection**: Parse movie name from filename, detect language from content
5. **Storage Decision**:
   - **Exact duplicate**: Reuse existing subtitle record (true lightning)
   - **Same content, different metadata**: Create new subtitle record, reuse OSS file
   - **New content**: Create both OSS file and subtitle record
6. **Response**: Return subtitle_id and lightning status

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

#### Problem: Franc Library Explosion
Original per-line detection returned 98+ languages for English subtitles.

#### Solution: Frequency-Based Algorithm
1. **Process all lines**: Detect language for each text line
2. **Count frequencies**: Build histogram of detected languages  
3. **Top language**: Always include most frequent
4. **90% threshold**: Include secondary only if count ≥ 90% of top
5. **Franc mapping**: Convert 3-letter codes (cmn→zh, eng→en)

```javascript
// Example results:
// eng: 754 lines (24.5%)
// sco: 410 lines (13.3%) → 13.3/24.5 = 54.3% < 90% → exclude
// Result: ["en"]
```

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
  subtitle_id: "sub_175324998459_7rdkklck",  // Unique subtitle ID
  lightning: true/false,  // true = exact duplicate or content reuse
  metadata: { movie_name, language, duration, filename, oss_id, created_at, updated_at },
  suggestions: {
    movie_name: "The Matrix",
    language: {
      from_content: ["en"]  // Frequency-based detection result
    }
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
  existing_files: 2,  // Number of subtitle records using this content
  existing_samples: [
    { movie_name: "Movie Title", language: "en", filename: "movie.en.srt" },
    { movie_name: "Movie Title", language: "zh", filename: "movie.zh.srt" }
  ],
  suggestions: {
    language: {
      from_content: ["en"]  // Frequency-based detection result
    }
  }
}
```

## Model Operations

```js
// modules/subtitle/data.js
const generateId = () => {
  return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export const create = (subtitleData) => {
  const subtitle = {
    subtitle_id: generateId(),
    filename: subtitleData.filename,
    movie_name: subtitleData.movie_name,
    language: subtitleData.language,
    duration: subtitleData.duration,
    oss_id: subtitleData.oss_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  db.prepare(`
    INSERT INTO subtitles VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subtitle.subtitle_id, subtitle.filename, subtitle.movie_name,
    subtitle.language, subtitle.duration, subtitle.oss_id,
    subtitle.created_at, subtitle.updated_at
  )
  
  return subtitle
}

export const findById = (subtitle_id) => {
  return db.prepare('SELECT * FROM subtitles WHERE subtitle_id = ?').get(subtitle_id)
}

export const findByOssId = (oss_id) => {
  return db.prepare('SELECT * FROM subtitles WHERE oss_id = ?').all(oss_id)
}

export const findDuplicate = (filename, movie_name, language, oss_id) => {
  return db.prepare(`
    SELECT * FROM subtitles 
    WHERE filename = ? AND movie_name = ? AND language = ? AND oss_id = ?
  `).get(filename, movie_name, language, oss_id)
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