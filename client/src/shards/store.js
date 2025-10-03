import Dexie from 'dexie'
import { genId } from '../utils/idGenerator'
import { log } from '../utils/logger'
import { migrate } from './migrator'

// Unified shard metadata store with BE fallback
const db = new Dexie('ShardMetaDB_v1')

db.version(1).stores({
  shards: 'id, type, owner_id, updated_at, name'
  // Schema: {
  //   id: string,           // genId('shard', ...) - local ID
  //   type: string,         // 'subtitle' | 'anki' | ...
  //   name: string,
  //   owner_id: string,
  //   description: string,
  //   cover: string,        // nvId → oss.js (or empty)
  //   public: boolean,
  //   flag: string,         // 'loading' during migration
  //   meta: object,         // Unified: oldId + BE metadata + data merged
  //   created_at: string,
  //   updated_at: string
  // }
})

// Auto-timestamps
db.shards.hook('creating', (primKey, obj) => {
  if (!obj.created_at) obj.created_at = new Date().toISOString()
  if (!obj.updated_at) obj.updated_at = new Date().toISOString()
})

db.shards.hook('updating', (modifications) => {
  modifications.updated_at = new Date().toISOString()
})

export const shardDb = {
  // READ: local only
  async read(id) {
    const shard = await db.shards.get(id)
    if (shard) {
      log.debug('Shard loaded', { id })
      return shard
    }

    log.warn('Shard not found', { id })
    return null
  },

  // LIST: local + progressive migration
  async list(filters = {}, onProgress = null) {
    log.debug('Loading shards', { filters })

    // Load local shards first
    let localQuery = db.shards.toCollection()

    if (filters.owner_id) {
      localQuery = localQuery.filter(s => s.owner_id === filters.owner_id)
    }
    if (filters.type) {
      localQuery = localQuery.filter(s => s.type === filters.type)
    }

    const localShards = await localQuery.toArray()
    log.debug('Local shards loaded', { count: localShards.length })

    // Notify with local shards immediately
    onProgress?.(localShards)

    // Extract existing oldIds to avoid re-migration
    const existingOldIds = new Set(localShards.map(s => s.meta?.oldId).filter(Boolean))

    // Run migrator to fetch and transform BE shards
    const migratedCount = await migrate(existingOldIds, (shards) => {
      // Save migrated shards to local DB
      for (const shard of shards) {
        db.shards.put(shard).catch(err =>
          log.warn('Failed to save migrated shard', { id: shard.id }, err)
        )
      }

      // Notify progress
      onProgress?.(shards)
    })

    log.info('Migration complete', { migrated: migratedCount })

    // Return combined shards (for non-progressive use)
    const allShards = await localQuery.toArray()
    return allShards
  },

  // CREATE: local first
  async create(shard) {
    const id = genId('shard', Date.now().toString())
    const newShard = {
      ...shard,
      id,
      meta: shard.meta || {}
    }

    await db.shards.add(newShard)
    log.info('Shard created locally', { id, type: shard.type })
    return id
  },

  // UPDATE: local first
  async update(id, updates) {
    await db.shards.update(id, updates)
    log.debug('Shard updated locally', { id })
  },

  // DELETE: local only
  async delete(id) {
    const shard = await db.shards.get(id)
    if (!shard) {
      log.warn('Shard not found for deletion', { id })
      return
    }

    await db.shards.delete(id)
    log.info('Shard deleted', { id })
  },

  // CLEANUP: Remove abandoned draft shards
  async cleanup() {
    try {
      const drafts = await db.shards.where('name').equals('__draft__').toArray()

      if (drafts.length > 0) {
        log.info(`🧹 Cleaning up ${drafts.length} abandoned draft shard(s)`)
        await Promise.all(drafts.map(draft => db.shards.delete(draft.id)))
        return drafts.length
      }

      return 0
    } catch (error) {
      log.warn('Failed to cleanup draft shards', error)
      return 0
    }
  },

  // Get database instance (for advanced usage)
  getDb() {
    return db
  }
}

// Open database with error handling
db.open().then(() => {
  log.debug('ShardMetaDB opened successfully')
}).catch(err => {
  log.error('Failed to open ShardMetaDB:', err)
})

export default shardDb

