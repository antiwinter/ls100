# Shard Module

## Database Schema

```sql
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
```

## API Endpoints

### GET /api/shards
Get user's shards or public shards.

**Query params:**
- `type=user` (default) - user's own shards
- `type=public` - public shards

**Response:**
```js
{ shards: [{ id, name, owner_id, public, created_at, ... }] }
```

### GET /api/shards/:id  
Get specific shard (if owner or public).

### POST /api/shards
Create new shard.

**Body:**
```js
{
  name: "My Matrix Study",
  description: "Learning with The Matrix",
  subtitles: ["abc123..."],
  public: false
}
```

### PUT /api/shards/:id
Update shard (owner only).

### DELETE /api/shards/:id  
Delete shard (owner only).

## Model Operations

```js
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
```

## Frontend Components

### EditShard Page ✅ IMPLEMENTED
**Location**: `client/src/pages/EditShard.jsx`

Full-page shard creation and editing interface:

**Features**:
- **Modes**: Create new shard or edit existing shard
- **Navigation**: Back button, React Router state passing
- **Form Fields**: Name, description (optional via dialog)
- **Type-Agnostic**: Works with any shard type via engine registry
- **Mobile-Optimized**: Fixed action bar, hidden horizontal scroll
- **Dynamic Editor**: Loads shard-specific editor component

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

**Integration with Engine Registry**:
- `getSuggestedName(detectedInfo)` - Auto-populate shard name
- `getShardTypeInfo(shardType)` - Display type chip and colors  
- `createShard(detectedInfo)` - Handle shard-specific creation
- `getEditorComponent(shardType)` - Load dynamic editor UI

### Shard Creation Flow ✅ STREAMLINED
**Complete Flow**: File Selection → Auto-Detection → EditShard Page → Configuration → Creation

1. **File Upload**: `GlobalImport.jsx` handles file selection and drag-drop
2. **Auto-Detection**: Run shard detectors, pick winner automatically
3. **Direct Navigation**: Skip intermediate dialogs, go straight to EditShard
4. **Configuration**: User configures name, description, type-specific settings
5. **Creation**: Engine-specific `createShard()` called, then generic shard update
6. **Return**: Navigate back to home with new shard visible

### ShardBrowser Integration ✅ DYNAMIC COVERS
**Location**: `client/src/components/ShardBrowser.jsx`

- **Custom Covers**: Load `shard.cover_url` if user uploaded/set custom cover
- **Dynamic Covers**: Generate covers on-the-fly using `generateCoverFromShard(shard)`
- **Fallback Chain**: Custom URL → Dynamic generation → Simple title display
- **Type-Agnostic**: Works with any shard type via engine registry

## Shard Types

### Subtitle Shard
- Links to subtitle files via `shard_subtitles` table
- Contains movie metadata in JSON
- Supports multiple subtitle files per shard
- **Editor**: `SubtitleShardEditor.jsx` with language selection and cover preview
- **Reader**: `SubtitleReader.jsx` with line-by-line navigation

### Future: Deck Shard
- Flashcard collections
- Custom card data

### Future: Book Shard  
- Text/PDF reading
- Chapter structure 