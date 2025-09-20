import Dexie from 'dexie'
import { log } from './logger.js'
import { genNvId } from './idGenerator.js'
import { lookup } from 'mrmime'

// Obj database - separate from AnkiDB
const db = new Dexie('OssDB')
db.version(1).stores({
  obj: 'id, type, created'
  // Schema: { id, filename, blob, type, size, users[], created }
})

// Generate nvId from blob content (deterministic)
async function blob2NvId(blob) {
  if (!blob) return null

  // Get bytes from Blob (we know it's always a proper Blob from JSZip)
  const ab = await blob.arrayBuffer()
  const bytes = new Uint8Array(ab)

  // Create content signature: size + type + first 1KB + last 1KB
  const firstBytes = bytes.slice(0, Math.min(1024, bytes.length))
  const lastBytes = bytes.length > 1024 ? bytes.slice(-1024) : new Uint8Array()

  const signature = blob.size + blob.type +
    Array.from(firstBytes).join(',') +
    Array.from(lastBytes).join(',')

  return genNvId('obj', signature)
}

// Add obj to database with users management
async function add(objArray, user = 'sys') {
  if (!Array.isArray(objArray)) return

  for (const { filename, blob } of objArray) {
    try {
      // Calculate or use provided nvId
      const nvId = await blob2NvId(blob)
      const existing = await db.obj.get(nvId)
      if (existing) {
        // Obj already exists, add user if not already present
        const users = existing.users || []
        if (!users.includes(user)) {
          users.push(user)
          await db.obj.update(nvId, { users })
          log.debug('Obj user added:', { nvId, filename, user, userCount: users.length })
        }
      } else if (blob) {
        // New obj with blob data
        await db.obj.put({
          id: nvId,
          filename,
          blob,
          type: lookup(filename) || blob.type,
          size: blob.size,
          users: [user],
          created: Date.now()
        })
        // log.debug('Obj added:', { nvId, filename, mimeType: lookup(filename) })
      } else {
        // Obj doesn't exist and no blob to create it
        log.warn('Cannot reference non-existent obj without blob:', { nvId, filename })
      }
    } catch (error) {
      log.error('Failed to add obj:', { filename }, error)
    }
  }
}

// Remove obj by nvIds with users management
async function remove(nvIds, user = 'sys') {
  if (!Array.isArray(nvIds)) nvIds = [nvIds]

  for (const nvId of nvIds) {
    if (!nvId) continue

    try {
      const obj = await db.obj.get(nvId)
      if (obj) {
        const users = obj.users || []
        const userIndex = users.indexOf(user)

        if (userIndex !== -1) {
          users.splice(userIndex, 1)

          if (users.length === 0) {
            await db.obj.delete(nvId)
            // log.debug('Obj deleted:', nvId)
          } else {
            await db.obj.update(nvId, { users })
            log.debug('Obj user removed:', { nvId, user, userCount: users.length })
          }
        }
      }
    } catch (error) {
      log.error('Failed to remove obj:', nvId, error)
    }
  }
}

// Get obj statistics categorized by types
async function getStats() {
  try {
    const objRecords = await db.obj.toArray()

    const totalSize = objRecords.reduce((sum, m) => sum + (m.size || 0), 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

    const byType = {}
    for (const record of objRecords) {
      const type = record.type || 'sys'
      const category = type.split('/')[0] || 'sys'

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
        users: record.users || [],
        created: record.created
      })
    }

    Object.keys(byType).forEach(category => {
      byType[category].totalSizeMB = (byType[category].totalSize / (1024 * 1024)).toFixed(2)
    })

    return {
      fileCount: objRecords.length,
      totalSize,
      totalSizeMB,
      byType
    }
  } catch (error) {
    log.error('Failed to get obj stats:', error)
    return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00', byType: {} }
  }
}

export default {
  blob2NvId,
  add,
  remove,
  getStats,
  // Test-helper & maintenance: clear all obj records
  async clear() {
    try {
      await db.obj.clear()
      log.debug('Obj database cleared')
    } catch (error) {
      log.error('Failed to clear obj database:', error)
    }
  }
}
