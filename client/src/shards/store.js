import Dexie from 'dexie'
import { genId } from '../utils/idGenerator'
import { apiCall } from '../config/api'
import { log } from '../utils/logger'

// Unified shard metadata store with BE fallback
const db = new Dexie('ShardMetaDB_v1')

db.version(1).stores({
  shards: 'id, type, owner_id, updated_at, oldId, name'
  // Schema: {
  //   id: string,           // genId('shard', ...) - local ID
  //   oldId: string,        // BE shard ID (for dedup after migration)
  //   type: string,         // 'subtitle' | 'anki' | ...
  //   name: string,
  //   owner_id: string,
  //   description: string,
  //   cover: string,        // nvId → oss.js (or empty)
  //   public: boolean,
  //   meta: object,         // Unified: BE metadata + data merged
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

// Transform BE shard format to FE format (structure only, no file migration)
function transformBeShard(beShard) {
  return {
    id: genId('shard', beShard.id),
    oldId: beShard.id,
    type: beShard.type,
    name: beShard.name,
    owner_id: beShard.owner_id,
    description: beShard.description || '',
    cover: beShard.cover || '',  // Keep as-is (URL or nvId), fileStore.get() handles migration
    public: beShard.public || false,
    meta: {
      ...(beShard.metadata || {}),  // Generic metadata
      ...(beShard.data || {})       // Engine-specific data
    },
    created_at: beShard.created_at,
    updated_at: beShard.updated_at
  }
}

export const shardDb = {
  // READ: local → BE fallback → cache
  async read(id) {
    // Try local first
    let shard = await db.shards.get(id)
    if (shard) {
      log.debug('Shard loaded from local', { id })
      return shard
    }

    // Check if this is an oldId (BE ID)
    shard = await db.shards.where('oldId').equals(id).first()
    if (shard) {
      log.debug('Shard found by oldId', { id, newId: shard.id })
      return shard
    }

    // Fallback to BE
    try {
      log.debug('Loading shard from BE', { id })
      const beData = await apiCall(`/api/shards/${id}`)

      // Transform BE format to FE format (structure only)
      shard = transformBeShard(beData.shard || beData)

      // Cache locally
      await db.shards.put(shard)

      log.info('Shard loaded from BE and cached', { id: shard.id, oldId: shard.oldId })
      return shard
    } catch (error) {
      log.error('Failed to load shard from BE', { id }, error)
      return null
    }
  },

  // LIST: local + BE combined, dedupe by oldId
  async list(filters = {}) {
    log.debug('Loading shards', { filters })

    // Get local shards
    let localQuery = db.shards.toCollection()

    if (filters.owner_id) {
      localQuery = localQuery.filter(s => s.owner_id === filters.owner_id)
    }
    if (filters.type) {
      localQuery = localQuery.filter(s => s.type === filters.type)
    }

    const localShards = await localQuery.toArray()
    log.debug('Local shards loaded', { count: localShards.length })

    // Try to get BE shards (graceful fail)
    let beShards = []
    try {
      const queryParams = new URLSearchParams()
      if (filters.sort) queryParams.append('sort', filters.sort)

      const beData = await apiCall(`/api/shards?${queryParams}`)
      beShards = beData.shards || []
      log.debug('BE shards loaded', { count: beShards.length })
    } catch (error) {
      log.warn('BE unavailable, showing local shards only', error)
    }

    // Dedupe: skip BE shards already in local (via oldId)
    const localOldIds = new Set(localShards.map(s => s.oldId).filter(Boolean))
    const localIds = new Set(localShards.map(s => s.id))

    const newBeShards = beShards.filter(bs =>
      !localOldIds.has(bs.id) && !localIds.has(bs.id)
    )

    // Transform new BE shards to FE format (structure only)
    const transformedBeShards = newBeShards.map(transformBeShard)

    // Cache new BE shards
    for (const shard of transformedBeShards) {
      try {
        await db.shards.put(shard)
      } catch (error) {
        log.warn('Failed to cache BE shard', { id: shard.id }, error)
      }
    }

    // Combine and return
    const allShards = [...localShards, ...transformedBeShards]
    log.debug('Total shards', {
      local: localShards.length,
      newBe: transformedBeShards.length,
      total: allShards.length
    })

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

  // DELETE: both FE and BE
  async delete(id) {
    const shard = await db.shards.get(id)
    if (!shard) {
      log.warn('Shard not found for deletion', { id })
      return
    }

    // Delete from local
    await db.shards.delete(id)
    log.info('Shard deleted from local', { id })

    // Also delete from BE if has oldId
    // if (shard.oldId) {
    //   try {
    //     await apiCall(`/api/shards/${shard.oldId}`, { method: 'DELETE' })
    //     log.info('Shard deleted from BE', { oldId: shard.oldId })
    //   } catch (error) {
    //     log.warn('Failed to delete shard from BE', { oldId: shard.oldId }, error)
    //   }
    // }
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

