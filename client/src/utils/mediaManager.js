import Dexie from 'dexie'
import { log } from './logger'
import { genNvId } from './idGenerator.js'

// Media database - separate from AnkiDB
const db = new Dexie('MediaDB')
db.version(1).stores({
  media: 'id, type, refCount, created'
  // Schema: { id, filename, blob, type, size, refCount, created }
})

// Generate nvId from blob content (single source of truth)
async function blob2NvId(blob) {
  if (!blob) return null

  // Normalize to Uint8Array for hashing; support multiple runtimes
  let bytes
  try {
    if (typeof blob.arrayBuffer === 'function') {
      const ab = await blob.arrayBuffer()
      bytes = new Uint8Array(ab)
    } else if (typeof blob.text === 'function') {
      const text = await blob.text()
      bytes = new TextEncoder().encode(text)
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer !== 'undefined' && globalThis.Buffer.isBuffer?.(blob)) {
      bytes = new Uint8Array(blob)
    } else if (blob instanceof Uint8Array) {
      bytes = blob
    } else if (ArrayBuffer.isView(blob)) {
      bytes = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength)
    } else if (blob instanceof ArrayBuffer) {
      bytes = new Uint8Array(blob)
    } else {
      // Last-resort: try constructing a Blob from the input and read as text
      const fallback = new Blob([blob])
      const text = await fallback.text()
      bytes = new TextEncoder().encode(text)
    }
  } catch {
    // As an absolute fallback, stringify
    const text = String(blob)
    bytes = new TextEncoder().encode(text)
  }

  const type = blob.type || 'application/octet-stream'
  const size = blob.size || bytes.length

  // Create content signature: size + type + first 1KB + last 1KB
  const firstBytes = bytes.slice(0, Math.min(1024, bytes.length))
  const lastBytes = bytes.length > 1024 ? bytes.slice(-1024) : new Uint8Array()

  const signature = size + type +
    Array.from(firstBytes).join(',') +
    Array.from(lastBytes).join(',')

  return genNvId('media', signature)
}

// Add media to database with refCount management
async function add(mediaArray) {
  if (!Array.isArray(mediaArray)) return

  for (const { nvId: _nvid, filename, blob } of mediaArray) {
    try {
      // Calculate or use provided nvId
      const nvId = await blob2NvId(blob) || _nvid

      // Warn if provided nvId doesn't match calculated one
      if (!nvId || _nvid !== nvId) {
        log.warn('Invalid media entry:', { filename, _nvid, nvId, blob })
        continue
      }

      const existing = await db.media.get(nvId)
      if (existing) {
        // Media already exists, just increment refCount
        await db.media.update(nvId, { refCount: (existing.refCount || 0) + 1 })
        log.debug('Media retained:', { nvId, filename, refCount: (existing.refCount || 0) + 1 })
      } else if (blob) {
        // New media with blob data
        await db.media.put({
          id: nvId,
          filename,
          blob,
          type: blob.type,
          size: blob.size,
          refCount: 1,
          created: Date.now()
        })
        log.debug('Media added:', { nvId, filename })
      } else {
        // Media doesn't exist and no blob to create it
        log.warn('Cannot reference non-existent media without blob:', { nvId, filename })
      }
    } catch (error) {
      log.error('Failed to add media:', { nvId: _nvid, filename }, error)
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
  blob2NvId,
  add,
  remove,
  getStats,
  // Test-helper & maintenance: clear all media records
  async clear() {
    try {
      await db.media.clear()
      log.debug('Media database cleared')
    } catch (error) {
      log.error('Failed to clear media database:', error)
    }
  }
}
