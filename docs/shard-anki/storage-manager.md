# Storage Manager Module

The Storage Manager provides a simplified storage interface for the new Note+Template architecture, managing IndexedDB for note data and localStorage for progress tracking.

## Purpose

Provides unified storage operations for notes, templates, cards, and progress data while supporting the refCount system for cross-shard note sharing.

## Storage Architecture

### Data Distribution
- **Backend**: Shard metadata only (via global shard API)
- **IndexedDB**: Notes, templates, cards, media files
- **localStorage**: FSRS progress data, user preferences

### Storage Philosophy
- **Notes as Source**: Single source of truth for content
- **Cards as References**: Lightweight pointers to note+template
- **Dynamic Rendering**: Content generated when needed
- **RefCount Management**: Automatic cleanup of unused notes

## IndexedDB Schema (v3)

### Database Structure
```javascript
{
  database: 'AnkiShardDB',
  version: 3,
  stores: {
    notes: { 
      keyPath: 'id',
      indexes: ['typeId', 'refCount', 'modified']
    },
    noteTypes: {
      keyPath: 'id', 
      indexes: ['name']
    },
    templates: {
      keyPath: 'id',
      indexes: ['typeId', 'idx']
    },
    cards: {
      keyPath: 'id',
      indexes: ['noteId', 'deckId', 'shardId', 'due']
    },
    media: {
      keyPath: 'id'
    }
  }
}
```

### Notes Store
Stores note content with refCount for sharing:
```javascript
{
  id: string,
  typeId: string,
  fields: string[],       // Raw field data
  tags: string[],
  refCount: number,       // Cross-shard sharing counter
  created: timestamp,
  modified: timestamp
}
```

### Templates Store  
Rendering templates linked to note types:
```javascript
{
  id: string,
  typeId: string,         // Links to noteTypes
  name: string,
  qfmt: string,           // Question template
  afmt: string,           // Answer template  
  idx: number             // Template ordinal
}
```

### Cards Store
Lightweight references with scheduling:
```javascript
{
  id: string,
  noteId: string,         // Reference to note
  templateIdx: number,    // Which template to use
  deckId: string,
  shardId: string,
  due: timestamp,         // FSRS scheduling data
  interval: number,
  ease: number,
  reps: number,
  lapses: number
}
```

## Core Operations

### IndexedDB Interface
Simplified async operations:
```javascript
// Basic CRUD
idb.get(store, key) → Promise<object>
idb.put(store, data) → Promise<key>
idb.delete(store, key) → Promise<void>
idb.getAll(store) → Promise<object[]>
idb.query(store, index, value) → Promise<object[]>
```

### Note Operations
Through noteManager module:
```javascript
noteManager.create(typeId, fields, tags) → Promise<note>
noteManager.get(noteId) → Promise<note>
noteManager.update(noteId, fields, tags) → Promise<note>
noteManager.addRef(noteId, shardId) → Promise<void>    // refCount++
noteManager.removeRef(noteId, shardId) → Promise<void> // refCount--, cleanup if 0
```

### Card Operations
Through cardGen module:
```javascript
cardGen.genCardsForNote(noteId, deckId, shardId) → Promise<card[]>
cardGen.renderCard(cardId) → Promise<{question, answer}>
cardGen.getCardsForDeck(deckId) → Promise<card[]>
cardGen.getCardsForShard(shardId) → Promise<card[]>
```

## RefCount System

### Cross-Shard Sharing
Notes can be referenced by multiple shards:
```javascript
// Note shared across 3 shards
{
  id: "note123",
  fields: ["France", "Paris"],
  refCount: 3  // Referenced by 3 different shards
}
```

### Automatic Cleanup
When refCount reaches 0, note is automatically deleted:
```javascript
await noteManager.removeRef(noteId, shardId)
// If this was the last reference (refCount becomes 0):
// - Note is deleted from IndexedDB
// - Associated cards are cleaned up
// - No manual cleanup needed
```

### Lifecycle Management
```javascript
// Adding note to new shard
await noteManager.addRef(noteId, shardId)  // refCount: 1 → 2

// Removing shard  
await noteManager.removeRef(noteId, shardId)  // refCount: 2 → 1

// Last shard removed
await noteManager.removeRef(noteId, lastShardId)  // refCount: 1 → 0 (auto-delete)
```

## Progress Storage (localStorage)

### Structure
```javascript
{
  'anki_progress_${deckId}': {
    [cardId]: {
      due: timestamp,
      stability: number,     // FSRS parameters
      difficulty: number,
      elapsed_days: number,
      scheduled_days: number,
      reps: number,
      lapses: number,
      state: string,         // new|learning|review|relearning
      last_review: timestamp
    }
  },
  'anki_preferences': {
    studySettings: object,
    uiPreferences: object
  }
}
```

### Progress Operations
```javascript
Progress is stored directly on each card record under `card.fsrs` and mirrored `card.due` for queries.
```

## Storage Status & Monitoring

### Storage Information
```javascript
getStorageInfo() → {
  quota: number,           // Browser storage limit
  usage: number,           // Current usage
  percentUsed: string      // Usage percentage
}
```

### Debug Interface
Development tools exposed on window:
```javascript
window.debugAnkiStorage = {
  listNotes() → Promise<note[]>,
  listCards() → Promise<card[]>, 
  listNoteTypes() → Promise<noteType[]>,
  clearAll() → Promise<void>      // Complete data wipe
}
```

## Performance Optimization

### Efficient Queries
- **Indexed Access**: All queries use proper IndexedDB indexes
- **Batch Operations**: Multiple operations grouped in transactions
- **Lazy Loading**: Large datasets loaded on demand

### Memory Management
- **Minimal Storage**: Only essential data in IndexedDB
- **Dynamic Content**: Cards rendered when accessed
- **Automatic Cleanup**: RefCount prevents orphaned data

### Transaction Patterns
```javascript
// Efficient batch creation
const notes = await Promise.all([
  noteManager.create(typeId1, fields1, tags1),
  noteManager.create(typeId2, fields2, tags2),
  noteManager.create(typeId3, fields3, tags3)
])
```

## Error Handling

### Storage Errors
- **Quota Exceeded**: Graceful degradation with user notification
- **Corruption**: Data validation on read with repair attempts
- **Network Issues**: Offline-first design with sync capabilities

### Data Integrity
- **Validation**: All data validated before storage
- **Consistency**: RefCount maintained across all operations
- **Recovery**: Automatic repair of inconsistent states

## Migration Strategy

### Schema Upgrades
IndexedDB onupgradeneeded handles version transitions:
```javascript
// v2 → v3 migration example
if (oldVersion < 3) {
  // Remove old stores
  if (db.objectStoreNames.contains('decks')) {
    db.deleteObjectStore('decks')
  }
  
  // Create new stores
  const noteStore = db.createObjectStore('notes', {keyPath: 'id'})
  noteStore.createIndex('refCount', 'refCount')
}
```

### Data Migration
- **Clean Slate**: New architecture assumes fresh import
- **No Legacy Support**: Old deckStorage data not migrated
- **Fresh Start**: Users re-import .apkg files

## Integration Points

### AnkiApi Module
Primary consumer of storage operations:
```javascript
ankiApi.createNote() → noteManager.create() + cardGen.genCardsForNote()
ankiApi.cleanupShard() → cardGen.deleteCards() + noteManager.removeRefs()
```

### Import/Export
Direct IndexedDB access for bulk operations:
```javascript
importApkgData() → idb.put() batch operations
parseApkgFile() → Direct IndexedDB writes for performance
```

### UI Components
- **BrowseMode**: Queries notes with idb.query()
- **StudyMode**: Renders cards with cardGen.renderCard()
- **Editor**: Imports data with bulk operations

## Future Enhancements

### Advanced Features
- **Compression**: Large note fields compressed in storage
- **Encryption**: Sensitive data encrypted at rest
- **Sync Preparation**: Structure ready for cloud synchronization
- **Analytics**: Storage usage analytics and optimization

### Performance Improvements
- **Caching Layer**: Frequently accessed data cached
- **Background Sync**: Progress synced in background
- **Intelligent Prefetch**: Predictive loading of upcoming cards
- **Storage Optimization**: Automatic cleanup policies