# Shard Module

## Database Schema

```sql
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
```

## API Endpoints

### GET /api/shards
Get user's shards or public shards with engine-specific data.

**Query params:**
- `type=user` (default) - user's own shards
- `type=public` - public shards

**Response:**
```js
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
```

### GET /api/shards/:id  
Get specific shard with engine-specific data (if owner or public).

**Response:**
```js
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
```

### POST /api/shards
Create new shard with engine processing.

**Body:**
```js
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
```

### PUT /api/shards/:id
Update shard with engine processing (owner only).

**Body:** Same as POST, all fields optional.

### DELETE /api/shards/:id  
Delete shard and clean up engine-specific data (owner only).

## Model Operations

```js
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
```

## Frontend Components

### EditShard Page ✅ ENHANCED
**Location**: `client/src/pages/EditShard.jsx`

Full-page shard creation and editing interface with unified data handling:

**Features**:
- **Modes**: Create new shard or edit existing shard
- **Navigation**: Back button, React Router state passing
- **Form Fields**: Name, description (optional via dialog), cover preview
- **Type-Agnostic**: Works with any shard type via engine registry
- **Mobile-Optimized**: Fixed action bar, hidden horizontal scroll
- **Dynamic Editor**: Loads shard-specific editor component
- **Cover Management**: Upload, URL, or generated covers with preview
- **Unified Data**: Single `shardData` state for both modes

**Navigation Flow**:
```javascript
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
```

**Engine Integration (Updated)**:
- `engineGetTag(shardType)` - Display type chip and colors  
- `engineGetEditor(shardType)` - Load dynamic editor UI
- `engineSaveData(shardData, apiCall)` - Process uploads and prepare data
- `engineGenCover(shard)` - Generate dynamic cover previews

### Shard Creation Flow ✅ UNIFIED ENGINE PROCESSING
**Complete Flow**: File Selection → Auto-Detection → EditShard Page → Configuration → Engine Processing → Creation

1. **File Upload**: `GlobalImport.jsx` handles file selection and drag-drop
2. **Auto-Detection**: Run shard detectors, pick winner automatically
3. **Direct Navigation**: Skip intermediate dialogs, go straight to EditShard
4. **Configuration**: User configures name, description, type-specific settings
5. **Engine Processing**: `engineSaveData()` handles file uploads and data preparation
6. **API Creation**: Single POST to `/api/shards` with processed data
7. **Return**: Navigate back to home with new shard visible

### ShardBrowser Integration ✅ ENHANCED UX
**Location**: `client/src/components/ShardBrowser.jsx`

**Features**:
- **Custom Covers**: Load `shard.cover` if user uploaded/set custom cover
- **Dynamic Covers**: Generate covers on-the-fly using `engineGenCover(shard)`
- **Fallback Chain**: Custom URL → Dynamic generation → Simple title display
- **Type-Agnostic**: Works with any shard type via engine registry
- **Long Press Support**: Long press to enter edit mode and select shard
- **Privacy Indicators**: Mask icon for private shards (FontAwesome integration)
- **Touch Optimized**: Proper touch feedback and gesture recognition

## Shard Types

### Subtitle Shard ✅ ENGINE-BASED
- **Data Structure**: Engine-managed `data.languages` array with subtitle references
- **Movie Metadata**: Extracted from filename and content analysis
- **Multi-Language**: Support for multiple subtitle files per shard
- **Editor**: `SubtitleShardEditor.jsx` with enhanced language selection and long press UX
- **Reader**: `SubtitleReader.jsx` with line-by-line navigation
- **Cover Generation**: Dynamic movie poster-style covers with consistent gradients

**Data Format**:
```js
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
```

### Future: Deck Shard
- Flashcard collections
- Custom card data
- Engine-based implementation

### Future: Book Shard  
- Text/PDF reading
- Chapter structure
- Engine-based implementation 