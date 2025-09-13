import Dexie from 'dexie'
import { log } from './logger'

// Media database - separate from AnkiDB
const db = new Dexie('MediaDB')
db.version(1).stores({
  media: 'id, type, refCount, created'
  // Schema: { id, filename, blob, type, size, refCount, created }
})

// Service Worker registration and URL handling
let swRegistered = false

// Register service worker for /media/* URLs
async function registerSW() {
  if (swRegistered || !navigator.serviceWorker) return

  try {
    // Inline service worker code
    const swCode = `
      self.addEventListener('fetch', event => {
        const url = new URL(event.request.url)
        if (url.pathname.startsWith('/media/')) {
          event.respondWith(handleMediaRequest(url.pathname))
        }
      })
      
      async function handleMediaRequest(pathname) {
        const nvId = pathname.replace('/media/', '')
        if (!nvId) return new Response('Not Found', { status: 404 })
        
        try {
          // Access MediaDB from service worker
          const { default: Dexie } = await import('https://unpkg.com/dexie@3/dist/dexie.mjs')
          const db = new Dexie('MediaDB')
          db.version(1).stores({ media: 'id, type, refCount, created' })
          
          const media = await db.media.get(nvId)
          if (!media?.blob) {
            // Return placeholder
            return new Response('Media Not Found', { 
              status: 404, 
              headers: { 'Content-Type': 'text/plain' }
            })
          }
          
          return new Response(media.blob, {
            headers: { 'Content-Type': media.type || 'application/octet-stream' }
          })
        } catch (error) {
          return new Response('Error: ' + error.message, { status: 500 })
        }
      }
    `

    const blob = new Blob([swCode], { type: 'application/javascript' })
    const swUrl = URL.createObjectURL(blob)

    await navigator.serviceWorker.register(swUrl, { scope: '/' })
    swRegistered = true
    log.debug('Media service worker registered')
  } catch (error) {
    log.error('Failed to register media service worker:', error)
  }
}

// Register service worker on first media operation
async function ensureSW() {
  if (!swRegistered) await registerSW()
}

// Add media to database with refCount management
async function add(mediaArray) {
  if (!Array.isArray(mediaArray)) return

  // Ensure service worker is registered
  await ensureSW()

  for (const { nvId, filename, blob, type, size } of mediaArray) {
    if (!nvId) continue

    try {
      const existing = await db.media.get(nvId)
      if (existing) {
        // Increment refCount
        await db.media.update(nvId, { refCount: (existing.refCount || 0) + 1 })
        log.debug('Media retained:', { nvId, filename, refCount: (existing.refCount || 0) + 1 })
      } else {
        // Create new media
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

    // Categorize by media types
    const byType = {}
    for (const record of mediaRecords) {
      const type = record.type || 'unknown'
      const category = type.split('/')[0] || 'unknown' // e.g., 'image', 'audio', 'video'

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

    // Add totalSizeMB to each category
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
