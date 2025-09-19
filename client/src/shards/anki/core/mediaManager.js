import db from './db.js'
import oss from '../../../utils/oss.js'
import { log } from '../../../utils/logger'

// Add media and track references for cleanup
async function add(mediaArray, context = {}) {
  if (!Array.isArray(mediaArray)) return

  for (const { filename, blob } of mediaArray) {
    try {
      if (!filename || !blob) {
        log.warn('Invalid media entry:', { filename, blob })
        continue
      }

      // Calculate nvId from blob content
      const nvId = await oss.blob2NvId(blob)
      if (!nvId) {
        log.warn('Failed to generate nvId for:', filename)
        continue
      }

      // Store blob in OSS (idempotent - won't duplicate if already exists)
      await oss.add([{ filename, blob }], 'anki')

      // Track reference locally
      const mediaRef = {
        nvId,
        bundleId: context.bundleId || null,
        templateOrd: context.templateOrd ?? null,
        noteId: context.noteId || null,
        filename,
        created: Date.now()
      }

      await db.media.put(mediaRef)
      log.debug('Media reference added:', { nvId, filename, context })

    } catch (error) {
      log.error('Failed to add media:', { filename }, error)
    }
  }
}

// Remove media references and cleanup OSS if no more references
async function remove(filenames, context = {}) {
  if (!Array.isArray(filenames)) filenames = [filenames]

  for (const filename of filenames) {
    if (!filename) continue

    try {
      // Build query to find references by filename and context
      let query = db.media.where('filename').equals(filename)

      if (context.bundleId) {
        query = query.and(ref => ref.bundleId === context.bundleId)
        if (context.templateOrd !== undefined) {
          query = query.and(ref => ref.templateOrd === context.templateOrd)
        }
      }

      if (context.noteId) {
        query = query.and(ref => ref.noteId === context.noteId)
      }

      // Get nvIds of matching references before deletion
      const refsToRemove = await query.toArray()
      const nvIdsToCheck = [...new Set(refsToRemove.map(ref => ref.nvId))]

      // Remove matching references
      await query.delete()

      // Check each nvId for cleanup
      for (const nvId of nvIdsToCheck) {
        const remaining = await db.media.where('nvId').equals(nvId).count()
        if (remaining === 0) {
          // No more references - remove from OSS
          await oss.remove([nvId], 'anki')
          log.debug('Media removed from OSS:', { filename, nvId })
        } else {
          log.debug('Media reference removed:', { filename, nvId, remaining })
        }
      }

    } catch (error) {
      log.error('Failed to remove media:', filename, error)
    }
  }
}

// Get media statistics
async function getStats() {
  try {
    const mediaRefs = await db.media.toArray()

    // Group by nvId to get unique media count
    const uniqueMedia = new Map()
    let totalRefs = 0

    for (const ref of mediaRefs) {
      totalRefs++
      if (!uniqueMedia.has(ref.nvId)) {
        uniqueMedia.set(ref.nvId, {
          nvId: ref.nvId,
          filename: ref.filename,
          created: ref.created,
          refs: []
        })
      }
      uniqueMedia.get(ref.nvId).refs.push({
        bundleId: ref.bundleId,
        templateOrd: ref.templateOrd,
        noteId: ref.noteId
      })
    }

    return {
      uniqueMediaCount: uniqueMedia.size,
      totalReferences: totalRefs,
      mediaList: Array.from(uniqueMedia.values())
    }
  } catch (error) {
    log.error('Failed to get media stats:', error)
    return { uniqueMediaCount: 0, totalReferences: 0, mediaList: [] }
  }
}

// Clear all media references (for testing)
async function clear() {
  try {
    await db.media.clear()
    log.debug('Media references cleared')
  } catch (error) {
    log.error('Failed to clear media references:', error)
  }
}

export default {
  add,
  remove,
  getStats,
  clear
}
