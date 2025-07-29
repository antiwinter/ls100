# update docs
_Exported on 7/29/2025 at 20:03:42 GMT+8 from Cursor (1.2.4)_

---

**User**

the recent changes is attached. update docs accordingly. follow @rules.md 

---

**Cursor**

I'll help you update the documentation based on the recent changes. Let me first read the recent changes file and the rules to understand what needs to be updated.

[CODE BLOCK: markdown | ++0 --2]js
{ shards: [{ id, name, owner_id, public, created_at, ... }] }
[CODE BLOCK: text | 5 lines]js
{
  name: "My Matrix Study",
  description: "Learning with The Matrix",
  subtitles: ["abc123..."],
  public: false
}
[CODE BLOCK: text | ++0 --3]js
{ 
  shards: [{ 
    id, 
    name, 
    type, 
    owner_id, 
    public, 
    created_at, 
    data: { /* engine-specific data */ }
  }] 
}
[CODE BLOCK: text | 3 lines]js
{
  shard: {
    id,
    name,
    type,
    description,
    cover,
    public,
    metadata: {},
    data: { /* engine-specific data, e.g. languages for subtitle type */ }
  }
}
[CODE BLOCK: text | 3 lines]js
{
  name: "My Matrix Study",
  description: "Learning with The Matrix",
  type: "subtitle",
  public: false,
  cover: "https://example.com/cover.jpg", // optional custom cover URL
  data: { 
    languages: [
      { 
        code: "en", 
        filename: "matrix.srt",
        movie_name: "The Matrix",
        file: File, // File object for upload
        isMain: true
      }
    ]
  }
}
[CODE BLOCK: text | 5 lines]

[CODE BLOCK: markdown | 1 lines]js
// modules/shard/data.js
export const create = (data) => {
  const shard = {
    id: generateId(),
    type: data.type || 'subtitle',
    name: data.name,
    owner_id: data.owner_id,
    description: data.description || '',
    metadata: JSON.stringify(data.metadata || {}),
    public: data.public || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  return db.prepare('INSERT INTO shards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    shard.id, shard.type, shard.name, shard.owner_id, 
    shard.description, shard.cover, shard.metadata, 
    shard.public, shard.created_at, shard.updated_at
  )
}

export const findByOwner = (userId) => {
  return db.prepare('SELECT * FROM shards WHERE owner_id = ?').all(userId)
}

export const findPublic = () => {
  return db.prepare('SELECT * FROM shards WHERE public = TRUE').all()
}
[CODE BLOCK: text | ++0 --1]js
// modules/shard/data.js
export const create = (data) => {
  const shard = {
    id: generateId(),
    type: data.type, // Required - no default, provided by API layer
    name: data.name,
    owner_id: data.owner_id,
    description: data.description || '',
    cover: data.cover || '', // Custom cover URL
    metadata: JSON.stringify(data.metadata || {}),
    public: data.public || false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  return db.prepare('INSERT INTO shards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    shard.id, shard.type, shard.name, shard.owner_id, 
    shard.description, shard.cover, shard.metadata, 
    shard.public, shard.created_at, shard.updated_at
  )
}

export const findByOwner = (userId) => {
  return db.prepare('SELECT * FROM shards WHERE owner_id = ?').all(userId)
}

export const findPublic = () => {
  return db.prepare('SELECT * FROM shards WHERE public = TRUE').all()
}

// Engine abstraction: subtitle-specific functions moved to server/shards/subtitle/data.js
// Generic shard operations only - engine-specific data handled via engine modules
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | ++0 --6]javascript
// Create flow: Home → GlobalImport → EditShard → Home
navigate('/edit-shard', {
  state: {
    mode: 'create',
    detectedInfo: { file, shardType, metadata, filename }
  }
})

// Edit flow: Home → EditShard → Home  
navigate('/edit-shard', {
  state: {
    mode: 'edit', 
    shardData: existingShard
  }
})
[CODE BLOCK: text | ++0 --13]javascript
// Create flow: Home → GlobalImport → EditShard → Home
navigate('/edit-shard', {
  state: {
    mode: 'create',
    detectedInfo: { file, shardType, metadata, filename }
  }
})

// Edit flow: Home → EditShard → Home  
navigate('/edit-shard', {
  state: {
    mode: 'edit', 
    shardData: existingShard
  }
})
[CODE BLOCK: text | ++0 --4]

[CODE BLOCK: markdown | ++0 --12]

[CODE BLOCK: markdown | ++0 --16]js
{
  type: "subtitle",
  data: {
    languages: [
      {
        code: "en",
        filename: "movie.srt", 
        movie_name: "The Matrix",
        subtitle_id: "sub_1234567890_abc",
        isMain: true
      },
      {
        code: "zh",
        filename: "movie.zh.srt",
        movie_name: "The Matrix", 
        subtitle_id: "sub_1234567890_def",
        isMain: false
      }
    ]
  }
}
[CODE BLOCK: text | ++0 --6]

[CODE BLOCK: markdown | 0 lines]sql
-- Shards table
CREATE TABLE shards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'subtitle',
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  metadata TEXT DEFAULT '{}',  -- JSON
  public BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Shard-Subtitle links (many-to-many)
CREATE TABLE shard_subtitles (
  shard_id TEXT NOT NULL,
  subtitle_id TEXT NOT NULL,
  PRIMARY KEY (shard_id, subtitle_id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE,
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(subtitle_id)
);

-- Progress tracking
CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  shard_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  words TEXT DEFAULT '[]',      -- JSON array
  bookmarks TEXT DEFAULT '[]', -- JSON array
  study_time INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, shard_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_shards_owner ON shards(owner_id);
CREATE INDEX idx_shards_public ON shards(public);
CREATE INDEX idx_progress_user ON progress(user_id);
[CODE BLOCK: text | ++0 --1]sql
-- Core shards table (engine-agnostic)
CREATE TABLE shards (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- Engine type: 'subtitle', 'deck', 'book', etc.
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  description TEXT DEFAULT '',
  cover TEXT DEFAULT '', -- Custom cover URL (optional)
  metadata TEXT DEFAULT '{}',  -- JSON
  public BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Engine-specific linking tables (managed by engine modules)
-- For subtitle engine: server/shards/subtitle/data.js manages shard_subtitles
-- Each engine manages its own linking tables and data associations

-- Progress tracking (engine-agnostic)
CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  shard_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  words TEXT DEFAULT '[]',      -- JSON array
  bookmarks TEXT DEFAULT '[]', -- JSON array
  study_time INTEGER DEFAULT 0,
  completion_rate REAL DEFAULT 0.0,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, shard_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_shards_owner ON shards(owner_id);
CREATE INDEX idx_shards_public ON shards(public);
CREATE INDEX idx_shards_type ON shards(type);
CREATE INDEX idx_progress_user ON progress(user_id);
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 3 lines]
client/src/shards/subtitle/
├── SubtitleShard.js         # Core logic (detector, shard management, engine interface)
├── SubtitleShardEditor.jsx  # Configuration UI for EditShard page
├── SubtitleReader.jsx       # Reading UI component  
└── index.js                 # Export all functionality
[CODE BLOCK: text | ++0 --1]
client/src/shards/subtitle/
├── SubtitleShard.js         # Engine logic (detector, data processing, cover generation)
├── SubtitleShardEditor.jsx  # Enhanced configuration UI with long press & tooltips
├── SubtitleReader.jsx       # Reading UI component  
└── index.js                 # Export all functionality

server/shards/subtitle/
├── data.js                  # Server-side engine data operations
├── engine.js                # Server-side engine processing logic
└── migration.sql            # Engine-specific database tables
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 1 lines]javascript
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
[CODE BLOCK: text | ++0 --1]javascript
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
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 1 lines]javascript
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
[CODE BLOCK: text | ++0 --1]javascript
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
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 1 lines]javascript
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
[CODE BLOCK: text | ++0 --7]javascript
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
[CODE BLOCK: text | ++0 --1]javascript
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
[CODE BLOCK: text | ++0 --10]javascript
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
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 1 lines]javascript
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
[CODE BLOCK: text | ++0 --1]javascript
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
[CODE BLOCK: text | ++0 --4]

[CODE BLOCK: markdown | 1 lines]javascript
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
[CODE BLOCK: text | ++0 --1]javascript
// index.js - Re-export all functionality
export { 
  detect, 
  processData,
  generateCover,
  shardTypeInfo,
  EditorComponent,
  ReaderComponent
} from './SubtitleShard.js'
[CODE BLOCK: text | 1 lines]javascript
// server/shards/subtitle/engine.js - Backend engine processing
export const getEngineData = (shardId) => {
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
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | 3 lines]javascript
// Central registry mapping shard types to their engines
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: audio: audioEngine, image: imageEngine
}

// Generic functions that delegate to appropriate engine
export const getSuggestedName = (detectedInfo) => { ... }
export const getShardTypeInfo = (shardType) => { ... }
export const createShard = async (detectedInfo) => { ... }
export const getEditorComponent = (shardType) => { ... }
export const getReaderComponent = (shardType) => { ... }
export const generateCoverFromShard = (shard) => { ... }
[CODE BLOCK: text | ++0 --4]javascript
export const detect = (filename, buffer) => { ... }
export const getSuggestedName = (detectedInfo) => { ... }
export const createShard = async (file, options) => { ... }
export const generateCoverFromShard = (shard) => { ... }
export const shardTypeInfo = { name, displayName, color }
export const EditorComponent = YourShardEditor
export const ReaderComponent = YourShardReader
[CODE BLOCK: text | ++0 --1]javascript
// Client-side engine registry (client/src/shards/engines.js)
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: deck: deckEngine, book: bookEngine
}

// Generic functions that delegate to appropriate engine
export const engineGetTag = (shardType) => { ... }
export const engineGetEditor = (shardType) => { ... }
export const engineGetReader = (shardType) => { ... }
export const engineGenCover = (shard) => { ... }
export const engineSaveData = async (shard, apiCall) => { ... }

// Server-side engine processing (server/shards/engines.js)
export const engineProcessCreate = async (shard, data) => { ... }
export const engineProcessUpdate = async (shard, data, updates) => { ... }
export const engineValidateData = (type, data) => { ... }
export const engineGetData = (type, shardId) => { ... }
[CODE BLOCK: text | ++0 --4]javascript
// Client-side (SubtitleShard.js)
export const detect = (filename, buffer) => { ... }
export const processData = async (shard, apiCall) => { ... }
export const generateCover = (shard) => { ... }
export const shardTypeInfo = { name, displayName, color }
export const EditorComponent = YourShardEditor
export const ReaderComponent = YourShardReader

// Server-side (server/shards/subtitle/engine.js)
export const getEngineData = (shardId) => { ... }
export const processCreate = async (shard, data) => { ... }
export const processUpdate = async (shard, data) => { ... }
export const validateData = (data) => { ... }
[CODE BLOCK: text | 0 lines]

[CODE BLOCK: markdown | ++0 --13]

[CODE BLOCK: markdown | ++0 --1]

[CODE BLOCK: markdown | 2 lines]js
const storage = new Storage({ type: 'local', basePath: './data/subtitles' })
[CODE BLOCK: text | 1 lines]js
const storage = new Storage({ 
  type: 'minio', 
  endpoint: 'localhost:9000',
  bucket: 'subtitles'
})
[CODE BLOCK: text | ++0 --1]js
const storage = new Storage({ type: 'local', basePath: './data/subtitles' })
[CODE BLOCK: text | 1 lines]js
const storage = new Storage({ 
  type: 'minio', 
  endpoint: 'localhost:9000',
  bucket: 'subtitles'
})
[CODE BLOCK: text | 5 lines]js
// server/shards/subtitle/engine.js
export const getEngineData = (shardId) => {
  // Return languages array with subtitle references
  return { 
    languages: [
      {
        code: "en",
        filename: "movie.srt",
        movie_name: "The Matrix", 
        subtitle_id: "sub_1234567890_abc",
        isMain: true
      }
    ]
  }
}

export const processCreate = async (shard, data) => {
  // Link subtitle files to shard via shard_subtitles table
  if (data.languages) {
    for (const language of data.languages) {
      if (language.subtitle_id) {
        linkSubtitle(shard.id, language.subtitle_id)
      }
    }
  }
  return shard
}

export const validateData = (data) => {
  // Validate languages array structure
  if (!data.languages || !Array.isArray(data.languages)) {
    return { valid: false, error: 'Languages array required' }
  }
  return { valid: true }
}
[CODE BLOCK: text | 1 lines]sql
-- Engine-specific linking table (managed by subtitle engine)
CREATE TABLE shard_subtitles (
  shard_id TEXT NOT NULL,
  subtitle_id TEXT NOT NULL,
  is_main BOOLEAN DEFAULT FALSE, -- Main language for learning
  PRIMARY KEY (shard_id, subtitle_id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE,
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(subtitle_id)
);
[CODE BLOCK: text | ++0 --4]

## Documentation Updates Complete ✅

I have successfully updated the documentation based on the recent changes, following the rules in `@rules.md`. Here's a summary of what was updated:

### Updated Files:

**1. `docs/shard.md` - Complete Engine System Overhaul**
- Updated API endpoints to reflect new engine-based data processing
- Modified database schema to show engine abstraction
- Enhanced EditShard page documentation with unified data handling
- Updated creation flow to show engine processing steps
- Enhanced ShardBrowser with long press and privacy features
- Added new subtitle shard data format examples

**2. `docs/shard-subtitle.md` - Major UX and Engine Improvements**  
- Restructured as "Engine" module vs just "Component"
- Enhanced content detector with language detection
- Updated from legacy `createShard()` to unified `processData()` approach
- Documented major UX overhaul with long press, tooltips, and better mobile UI
- Added server-side engine module documentation
- Updated engine interface with cleaner function names

**3. `docs/design.md` - Architecture Updates**
- Enhanced Shard Engine Registry System with client-server architecture
- Added "Recent Major Updates" section documenting UI/UX enhancements
- Updated engine interface to reflect actual implementation
- Added new key decision about Engine Abstraction

**4. `docs/subtitle.md` - Engine Integration**
- Added new "Engine Integration" section
- Documented server-side engine module structure
- Added engine-specific database schema
- Documented integration points with shard API

### Key Improvements Documented:

**Engine System:**
- Unified client-server data processing
- Clean API with `engine*` function prefixes  
- Server-side engine validation and operations
- Better abstraction for extensible shard types

**UI/UX Enhancements:**
- Long press support with custom `useLongPress()` hook
- FontAwesome integration (mask icons for privacy)
- Enhanced edit flow with unified data handling
- Touch optimizations and better feedback systems
- Component extraction for reusability

**Data Flow:**
- Single POST/PUT flow instead of multi-step creation
- Engine-managed data structures (`data.languages` format)
- Better validation and error handling
- Consistent API patterns across shard types

The documentation now accurately reflects the current codebase and follows the modular approach specified in the rules, with each component and system properly documented in its appropriate file.

---

**User**

subtitle.md is a basic module that manages subtitle, not related to shard, you've got wrong content into it.

---

**Cursor**

You're absolutely right! I made a mistake by adding engine integration content to `docs/subtitle.md`. That file documents the basic subtitle module that manages subtitle files, storage, and operations - it's not related to shard engines.

Let me fix this by removing the incorrect content:

[CODE BLOCK: markdown | 5 lines]js
// server/shards/subtitle/engine.js
export const getEngineData = (shardId) => {
  // Return languages array with subtitle references
  return { 
    languages: [
      {
        code: "en",
        filename: "movie.srt",
        movie_name: "The Matrix", 
        subtitle_id: "sub_1234567890_abc",
        isMain: true
      }
    ]
  }
}

export const processCreate = async (shard, data) => {
  // Link subtitle files to shard via shard_subtitles table
  if (data.languages) {
    for (const language of data.languages) {
      if (language.subtitle_id) {
        linkSubtitle(shard.id, language.subtitle_id)
      }
    }
  }
  return shard
}

export const validateData = (data) => {
  // Validate languages array structure
  if (!data.languages || !Array.isArray(data.languages)) {
    return { valid: false, error: 'Languages array required' }
  }
  return { valid: true }
}
[CODE BLOCK: text | 1 lines]sql
-- Engine-specific linking table (managed by subtitle engine)
CREATE TABLE shard_subtitles (
  shard_id TEXT NOT NULL,
  subtitle_id TEXT NOT NULL,
  is_main BOOLEAN DEFAULT FALSE, -- Main language for learning
  PRIMARY KEY (shard_id, subtitle_id),
  FOREIGN KEY (shard_id) REFERENCES shards(id) ON DELETE CASCADE,
  FOREIGN KEY (subtitle_id) REFERENCES subtitles(subtitle_id)
);
[CODE BLOCK: text | ++0 --5]

[CODE BLOCK: markdown | ++0 --1]

You're absolutely right! I've corrected the mistake by removing the engine integration content from `docs/subtitle.md`. 

The `docs/subtitle.md` file should only document the basic subtitle module (`server/modules/subtitle/`) which handles:
- Subtitle file upload and storage
- Two-table storage architecture (oss_files + subtitles)
- Language detection and movie name parsing
- Lightning upload features
- Storage abstraction

The engine integration content I incorrectly added belongs in the shard documentation (which is properly documented in `docs/shard.md` and `docs/shard-subtitle.md`), not in the basic subtitle module documentation.

Thanks for catching that - I was mixing concerns between the basic subtitle module and the shard engine system.

