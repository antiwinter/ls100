import db from './db.js'
import oss from '../../../utils/oss.js'
import { log } from '../../../utils/logger'
import _ from 'lodash'


// Extract media filenames from fields
async function _findMedia(fields) {
  if (!Array.isArray(fields)) fields = [fields]

  const filenames = []

  for (const field of fields) {
    if (!field) continue

    // Extract filenames from [sound:filename] tags
    const soundMatches = field.match(/\[sound:([^\]]+)\]/g) || []
    for (const match of soundMatches) {
      const filename = match.replace(/\[sound:([^\]]+)\]/, '$1')
      if (filename) {
        filenames.push(filename)
      }
    }

    // Extract filenames from HTML media tags
    const htmlMatches = field.match(/<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi) || []
    for (const match of htmlMatches) {
      const srcMatch = match.match(/\b(?:src|data)=["']?([^"'\s>]+)["']?/)
      if (srcMatch) {
        const filename = srcMatch[1]
        if (filename) {
          filenames.push(filename)
        }
      }
    }

    // Extract filenames from CSS url() declarations
    const cssMatches = field.match(/url\(['"]?([^'")]+)['"]?\)/gi) || []
    for (const match of cssMatches) {
      const urlMatch = match.match(/url\(['"]?([^'")]+)['"]?\)/i)
      if (urlMatch) {
        const filename = urlMatch[1]
        if (filename) {
          filenames.push(filename)
        }
      }
    }
  }

  return [...new Set(filenames)] // Remove duplicates
}

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

// Fuzzy add media - handles _findMedia + _.pick + add pattern
async function fuzzyAdd(bundleId, userId, content, mediaPool = {}) {
  const filenames = await _findMedia(content)
  if (filenames.length === 0) return []

  const mediaObject = _.pick(mediaPool, filenames)
  // log.debug('Fuzzy adding:', filenames, mediaObject)
  if (Object.keys(mediaObject).length > 0) {
    await add(bundleId, userId, mediaObject)
    // log.debug('Fu  zzy added:', filenames)
  }

  return filenames
}

// Fuzzy remove media - handles _findMedia + remove pattern
async function fuzzyRemove(bundleId, userId, content) {
  const filenames = await _findMedia(content)
  if (filenames.length > 0) {
    await remove(bundleId, userId, filenames)
    // log.debug(`Fuzzy removed ${filenames.length} media files`)
  }

  return filenames
}

export default {
  add,
  remove,
  clear,
  fuzzyAdd,
  fuzzyRemove
}
