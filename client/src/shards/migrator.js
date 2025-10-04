import { apiCall } from '../config/api'
import { genId } from '../utils/idGenerator'
import { log } from '../utils/logger'
import oss from '../utils/oss'
import { shardApi } from './shardApi'
// Reusable KV migration: move a legacy localStorage key into Dexie kv under unified key
async function migrateKv(topic, shardId, oldKey) {
  try {
    const db = shardApi.getDb()
    const newKey = ['ls100', topic, shardId].filter(Boolean).join('-')
    const existing = await db.kv.get(newKey)
    if (existing)
    {
      log.debug('migrateKv already exists', { topic, shardId, oldKey })
      return true
    }

    const payload = localStorage.getItem(oldKey)
    if (!payload)
    {
      log.debug('migrateKv not found', { topic, shardId, oldKey })
      return false
    }

    await db.kv.put({
      id: newKey,
      data: payload,
      topic,
      shardId: shardId || null,
      version: 0
    })

    // localStorage.removeItem(oldKey)
    return true
  } catch (e) {
    log.warn('migrateKv failed', { topic, shardId, oldKey }, e)
    return false
  }
}


/**
 * Migrate BE shards to local FE storage
 * Called by shardApi.list() to progressively load and transform BE shards
 */

// Transform BE shard format to FE format
function transformShard(beShard) {
  return {
    id: genId('shard', beShard.id),
    type: beShard.type,
    name: beShard.name,
    owner_id: beShard.owner_id,
    description: beShard.description || '',
    cover: beShard.cover || '',
    public: beShard.public || false,
    meta: {
      oldId: beShard.id,  // Store oldId in meta
      ...(beShard.metadata || {}),
      ...(beShard.data || {})
    },
    created_at: beShard.created_at,
    updated_at: beShard.updated_at
  }
}

// Migrate subtitle files from BE to local OSS
async function migrateSubtitleFiles(shard) {
  const languages = shard.meta?.languages
  if (!languages || !Array.isArray(languages)) {
    return shard
  }

  log.info('🔄 Migrating subtitle files', { shardId: shard.id, count: languages.length })

  for (const lang of languages) {
    // Skip if already has nvId (shouldn't happen in migration, but be safe)
    if (!lang.subtitle_id || lang.subtitle_id.startsWith('obj_')) {
      continue
    }

    const oldSubtitleId = lang.subtitle_id

    try {
      // Fetch subtitle content from BE
      const url = `/api/subtitles/${oldSubtitleId}/content`
      const token = localStorage.getItem('token')
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const text = await response.text()
      const blob = new Blob([text], { type: 'text/plain; charset=utf-8' })

      // Save to local OSS
      const nvId = await oss.blob2NvId(blob)
      await oss.add([{ filename: lang.filename || 'subtitle.srt', blob }], shard.id)

      // Replace subtitle_id with nvId
      lang.subtitle_id = nvId

      log.info('✅ File migrated', { oldId: oldSubtitleId, nvId, lang: lang.code })
    } catch (error) {
      log.error('❌ Failed to migrate file', { oldId: oldSubtitleId, lang: lang.code }, error)
      throw error // Fail entire shard migration if any file fails
    }
  }

  return shard
}

// Migrate cover image from BE URL to local OSS
async function migrateCover(shard) {
  if (!shard.cover || shard.cover.startsWith('obj_')) {
    return shard
  }

  try {
    log.debug('🔄 Migrating cover', { cover: shard.cover })

    // Fetch cover from URL
    const response = await fetch(shard.cover)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const blob = await response.blob()
    const nvId = await oss.blob2NvId(blob)
    await oss.add([{ filename: 'cover.jpg', blob }], shard.id)

    shard.cover = nvId
    log.info('✅ Cover migrated', { nvId })
  } catch (error) {
    log.warn('Failed to migrate cover, keeping URL', { cover: shard.cover }, error)
    // Don't fail shard migration if cover fails
  }

  return shard
}

/**
 * Main migration function
 * @param {Set<string>} existingOldIds - Set of oldIds already in local storage
 * @param {Function} onProgress - Callback: (shards) => void
 * @returns {Promise<number>} Number of successfully migrated shards
 */
export async function migrate(existingOldIds, onProgress = null) {
  try {
    // Migrate old global subtitle prefs key once
    await migrateKv('subtitle-prefs', null, 'ls100-settings-subtitle-shard')

    // Fetch all BE shards
    const beData = await apiCall('/api/shards')
    const beShards = beData.shards || []

    log.info('🔄 Starting migration', {
      total: beShards.length,
      existing: existingOldIds.size
    })

    // Filter: skip shards already migrated
    const newShards = beShards.filter(s => !existingOldIds.has(s.id))

    log.debug('Migration filtering', {
      beTotal: beShards.length,
      beIds: beShards.map(s => s.id),
      existingOldIds: Array.from(existingOldIds),
      newCount: newShards.length,
      newIds: newShards.map(s => s.id)
    })

    if (newShards.length === 0) {
      log.info('✅ No new shards to migrate')
      return 0
    }

    log.info(`🔄 Migrating ${newShards.length} new shard(s)`)

    // PHASE 1: Transform all (fast)
    const shards = []
    for (const beShard of newShards) {
      try {
        const shard = transformShard(beShard)
        // Mark subtitle shards as loading
        if (shard.type === 'subtitle') {
          shard.flag = 'loading'
        }
        // Per-shard migration: subtitle session key rename
        await migrateKv('subtitle-session', shard.id, `ls100-session-${beShard.id}`)
        shards.push(shard)
      } catch (error) {
        log.error('❌ Failed to transform shard', {
          id: beShard.id,
          type: beShard.type,
          name: beShard.name
        }, error)
      }
    }

    // Notify all transformed shards at once
    if (shards.length > 0) {
      log.info(`📤 Notifying ${shards.length} transformed shard(s)`)
      onProgress?.(shards)
    }

    // PHASE 2: Migrate content one by one
    let migratedCount = 0
    for (const shard of shards) {
      try {
        // Migrate files for subtitle shards
        if (shard.type === 'subtitle') {
          await migrateSubtitleFiles(shard)
          delete shard.flag
        }

        // Migrate cover if it's a URL
        await migrateCover(shard)

        // Notify completion
        onProgress?.([shard])
        migratedCount++

        log.info('✅ Shard migrated', { id: shard.id, type: shard.type, name: shard.name })
      } catch (error) {
        log.error('❌ Failed to migrate content', {
          id: shard.id,
          type: shard.type,
          name: shard.name
        }, error)
        // Skip this shard, will retry next time
      }
    }

    log.info('✅ Migration complete', { migrated: migratedCount, total: shards.length })
    return migratedCount
  } catch (error) {
    log.error('❌ Migration failed', error)
    return 0
  }
}

export default { migrate }

