# Local-First Architecture Implementation

## Overview

Implemented a hybrid local-first architecture for shard storage that keeps data primarily in IndexedDB with seamless backend fallback for backward compatibility.

## Architecture Layers

### 1. Storage Foundation (`client/src/shards/`)

#### `store.js` - Shard Metadata Store
- **Database**: `ShardMetaDB_v1` (Dexie/IndexedDB)
- **Schema**: `{ id, oldId, type, name, owner_id, description, cover, meta, public, created_at, updated_at }`
- **Operations**:
  - `read(id)`: Local → BE fallback → cache
  - `list(filters)`: Combines local + BE shards, deduplicates by `oldId`
  - `create(shard)`: Local first with `genId('shard', ...)`
  - `update(id, updates)`: Local only
  - `delete(id)`: Both FE (local) and BE (if has `oldId`)

**Key Feature**: `oldId` tracks backend shard IDs to prevent duplicates after migration

#### `fileStore.js` - File Storage Wrapper
- **Wraps**: `utils/oss.js` (OSS IndexedDB)
- **Operations**:
  - `get(nvIdOrUrl, filename)`: Local OSS → BE URL → cache
  - `store(filename, blob, userId)`: Directly to OSS
  - `delete(nvId, userId)`: OSS ref count management
- **Auto-migration**: Fetches BE URLs on first access, caches as nvId

#### `progress.js` - Progress Tracking
- **Database**: `ProgressDB_v1` (Dexie/IndexedDB)
- **Schema**: `{ id, shard_id, words[], bookmarks[], currentLine, study_time, completion_rate }`
- **Migration**: Falls back to BE subtitle progress API for old data

#### `migrator.js` - Transparent Migration
- **Functions**:
  - `needsMigration(shard)`: Detects old BE format
  - `migrateShard(shard)`: Converts covers & files to local nvIds
  - `migrateIfNeeded(shard)`: Auto-migration wrapper
  - `migrateAll()`: Batch migration utility

---

## Data Model

### Unified `meta` Field

**Before** (Backend):
```javascript
{
  id, type, name, owner_id, description, cover,
  metadata: {},  // Generic metadata
  data: {}       // Engine-specific data
}
```

**After** (Frontend):
```javascript
{
  id: genId('shard', ...),   // Local ID
  oldId: 'shard_xyz',        // BE ID for dedup
  type: 'subtitle',
  name: 'The Matrix',
  owner_id: 'user_123',
  description: '',
  cover: 'obj_nvid_xyz',     // nvId → oss.js
  public: false,
  meta: {                     // UNIFIED metadata + engine data
    ...metadata,
    ...data
  },
  created_at: '...',
  updated_at: '...'
}
```

---

## Component Updates

### `Home.jsx`
- ✅ Uses `shardDb.list()` instead of `apiCall('/api/shards')`
- ✅ Local sorting by `updated_at`, `name`, or `created_at`
- ✅ Delete with `shardDb.delete()` (handles BE cleanup)
- ✅ Public/private with `shardDb.update()`

### `EditShard.jsx`
- ✅ Loads with `shardDb.read()` (BE fallback)
- ✅ Auto-migration on edit via `migrator.migrateIfNeeded()`
- ✅ Cover upload via `fileStore.store()` → local OSS
- ✅ Save with `shardDb.create/update()` (no BE calls)
- ✅ Uses `meta` field for all engine data

### `SubtitleShard.js`
- ✅ `processData()` uses `fileStore` instead of `apiCall`
- ✅ Subtitle files stored as `file_nvId` in local OSS
- ✅ Supports both `meta` and old `data` fields during migration

---

## Migration Strategy

### Automatic Migration
1. **On First Access**: `shardDb.read()` fetches from BE, caches locally
2. **On Edit**: `migrator.migrateIfNeeded()` converts files to local
3. **On File Access**: `fileStore.get()` fetches BE URLs, caches as nvId
4. **Progressive**: Old shards migrate as they're used

### Deduplication
- `oldId` field tracks original BE shard ID
- `shardDb.list()` filters out BE shards already in local (by `oldId`)
- Prevents duplicate shards after migration

---

## Key Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **ID Generation** | `genId('shard', ...)` | Unified format, no prefix needed |
| **Deletion** | Both FE + BE | Prevent orphaned data |
| **Progress** | Local (ProgressDB) | All updates local-first |
| **Anki** | Metadata in shardDb, cards in AnkiDB | Separation of concerns |
| **Engine Data** | Single `meta` field | Simpler than metadata + data |
| **BE Unreachable** | Graceful degradation | Show local shards only |
| **Merge Strategy** | BE priority with `oldId` dedup | Avoid duplicates |

---

## Benefits

✅ **Instant CRUD**: No API calls for local operations
✅ **Offline-First**: Works without network
✅ **Backward Compatible**: Seamless BE fallback
✅ **Progressive Migration**: Automatic, no manual steps
✅ **Storage Efficient**: OSS deduplicates files by content hash
✅ **Future-Ready**: Easy to add sync for subscriptions

---

## Future: Subscription Sync (Not Implemented)

When ready to add sync:

1. Add sync queue to `shardDb`:
   ```javascript
   syncQueue: '++id, shard_id, operation, timestamp, synced'
   ```

2. Create `syncManager.js`:
   - Background sync every 60s
   - Upload local changes to BE
   - Pull BE changes to local
   - Conflict resolution (timestamp-based)

3. Enable/disable based on user subscription:
   ```javascript
   if (user.hasSubscription) {
     syncManager.start()
   }
   ```

---

## Testing Checklist

- [ ] Create new shard (local only)
- [ ] Edit existing BE shard (auto-migration)
- [ ] Delete shard (local + BE cleanup)
- [ ] List shards (combined local + BE)
- [ ] Offline mode (local only)
- [ ] File migration (cover + subtitle files)
- [ ] Progress migration (subtitle progress)
- [ ] Anki shard compatibility

---

## Files Modified

### New Files
- `client/src/shards/store.js`
- `client/src/shards/fileStore.js`
- `client/src/shards/progress.js`
- `client/src/shards/migrator.js`

### Updated Files
- `client/src/pages/Home.jsx`
- `client/src/pages/EditShard.jsx`
- `client/src/shards/subtitle/SubtitleShard.js`

### Unchanged (Reused)
- `client/src/utils/oss.js` (already had local storage)
- `client/src/shards/anki/core/db.js` (already local-first)

---

## Next Steps

1. ✅ Phase 1: Foundation files created
2. ✅ Phase 2: Component integration (Home, EditShard)
3. ✅ Phase 3: Engine updates (SubtitleShard)
4. 🔄 Phase 3: Anki metadata integration
5. ⏳ Phase 4: Testing & validation
6. 🔮 Future: Subscription sync layer

todo:
## Remaining Tasks

### Critical Path (Must Complete)
- [ ] wire to files where apiCall is still called
- [ ] **Cover URL Fetching**: EditShard - when user provides external URL, fetch and save to OSS as nvId
- [ ] **Cover Display**: Update `ShardBrowser` and `EditShard` to handle covers correctly (always `/oss/{nvId}`)
- [ ] **Shard ID Timing**: Fix `shard.id` allocation - must be valid before `oss.add()` calls (not 'temp')
- [ ] **Subtitle Parsing**: Install 'subtitle' package and implement local parsing in `useSubtitleGroups.js`
- [ ] **Subtitle Reader**: Update `useSubtitleGroups` to support both `subtitle_id` (old) and `nvId` (new)

### Nice to Have
- [ ] Anki integration: Register Anki shard metadata in `shardDb`
- [ ] Sync indicator UI: blue (synced, private), green (synced, public), red (not synced)

### Notes
- ✅ Progress/bookmarks/wordlist stay in `useSessionStore` (local Zustand persist) - no BE sync needed
- ✅ `migrator.js` deleted - lazy migration via `fileStore.get()` is cleaner
- ✅ `progress.js` deleted - `useSessionStore` is sufficient
