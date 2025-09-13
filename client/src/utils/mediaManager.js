import Dexie from 'dexie'
import { log } from './logger'

// Media database - separate from AnkiDB
const db = new Dexie('MediaDB')
db.version(1).stores({
  media: 'id, type, refCount, created'
  // Schema: { id, filename, blob, type, size, refCount, created }
})

// Add media to database with refCount management
async function add(mediaArray) {
  if (!Array.isArray(mediaArray)) return

  for (const { nvId, filename, blob, type, size } of mediaArray) {
    if (!nvId) continue

    try {
      const existing = await db.media.get(nvId)
      if (existing) {
        await db.media.update(nvId, { refCount: (existing.refCount || 0) + 1 })
        log.debug('Media retained:', { nvId, filename, refCount: (existing.refCount || 0) + 1 })
      } else {
        await db.media.put({
          id: nvId,
          filename,
          blob,
          type,
          size,
          refCount: 1,
          created: Date.now()
        })
        log.debug('Media added:', { nvId, filename })
      }
    } catch (error) {
      log.error('Failed to add media:', nvId, error)
    }
  }
}

// Remove media by nvIds with refCount management
async function remove(nvIds) {
  if (!Array.isArray(nvIds)) nvIds = [nvIds]

  for (const nvId of nvIds) {
    if (!nvId) continue

    try {
      const media = await db.media.get(nvId)
      if (media) {
        const newRefCount = Math.max(0, (media.refCount || 0) - 1)
        if (newRefCount === 0) {
          await db.media.delete(nvId)
          log.debug('Media deleted:', nvId)
        } else {
          await db.media.update(nvId, { refCount: newRefCount })
          log.debug('Media refCount decreased:', { nvId, refCount: newRefCount })
        }
      }
    } catch (error) {
      log.error('Failed to remove media:', nvId, error)
    }
  }
}

// Get media statistics categorized by types
async function getStats() {
  try {
    const mediaRecords = await db.media.toArray()

    const totalSize = mediaRecords.reduce((sum, m) => sum + (m.size || 0), 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

    const byType = {}
    for (const record of mediaRecords) {
      const type = record.type || 'unknown'
      const category = type.split('/')[0] || 'unknown'

      if (!byType[category]) {
        byType[category] = {
          fileCount: 0,
          totalSize: 0,
          files: []
        }
      }

      byType[category].fileCount++
      byType[category].totalSize += record.size || 0
      byType[category].files.push({
        id: record.id,
        filename: record.filename,
        type: record.type,
        size: record.size,
        refCount: record.refCount,
        created: record.created
      })
    }

    Object.keys(byType).forEach(category => {
      byType[category].totalSizeMB = (byType[category].totalSize / (1024 * 1024)).toFixed(2)
    })

    return {
      fileCount: mediaRecords.length,
      totalSize,
      totalSizeMB,
      byType
    }
  } catch (error) {
    log.error('Failed to get media stats:', error)
    return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00', byType: {} }
  }
}

export default {
  add,
  remove,
  getStats
}
