import db from './db.js'
import oss from '../../../utils/oss.js'
import { log } from '../../../utils/logger'

// Add media and track references for cleanup
async function add(bundleId, userId, media) {
  if (!bundleId || userId == null || !media || typeof media !== 'object') {
    log.warn('Invalid parameters for media add:', { bundleId, userId, media })
    return
  }

  for (const [filename, blob] of Object.entries(media)) {
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
        bundleId,
        userId,
        filename,
        created: Date.now()
      }

      await db.media.put(mediaRef)
      // log.debug('Media reference added:', { nvId, filename, bundleId, userId })

    } catch (error) {
      log.error('Failed to add media:', { filename }, error)
    }
  }
}

// Remove media references and cleanup OSS if no more references
async function remove(bundleId, userId, filenames) {
  if (!bundleId || userId == null) {
    log.warn('Invalid parameters for media remove:', { bundleId, userId })
    return
  }

  if (!Array.isArray(filenames)) filenames = [filenames]

  for (const filename of filenames) {
    if (!filename) continue

    try {
      // Build query to find references by filename, bundleId and userId
      const query = db.media
        .where('filename').equals(filename)
        .and(ref => ref.bundleId === bundleId && ref.userId === userId)

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
          // log.debug('Media removed from OSS:', { filename, nvId })
        } else {
          // log.debug('Media reference removed:', { filename, nvId, remaining })
        }
      }

    } catch (error) {
      log.error('Failed to remove media:', filename, error)
    }
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
  clear
}
