import db from './db.js'
import { log } from '../../../utils/logger'
import { genNvId } from '../../../utils/idGenerator.js'

// Unified KV cache structure:
// key: "filename" (global media)
// value: {
//   dataUrl?: string,     // Generated data URL for templates (hot path)
//   size?: number,        // File size for statistics
//   type?: string,        // MIME type
//   filename?: string,    // Original filename
//   imported?: number,    // Import timestamp
//   data?: any,          // Future extensible field (thumbnails, transforms, etc.)
//   ...                  // Other future extensions
// }
const mediaCache = new Map()

// Get or load media metadata into unified cache (internal)
async function _ensureMetadata(cacheKey, filename) {
  let cached = mediaCache.get(cacheKey)

  // If we have complete metadata, return it
  if (cached?.filename && cached?.size !== undefined) {
    return cached
  }

  // Load from DB and merge with existing cache entry
  try {
    const mediaRecord = await db.media.get(cacheKey)
    if (mediaRecord) {
      const updated = {
        ...cached, // Preserve existing cache (e.g., dataUrl)
        filename: mediaRecord.filename,
        size: mediaRecord.size,
        type: mediaRecord.type,
        imported: mediaRecord.imported
      }
      mediaCache.set(cacheKey, updated)
      return updated
    }
  } catch (error) {
    log.warn('Failed to retrieve media metadata:', filename, error)
  }

  return null
}

// Convert blob to data URL (internal)
async function _blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Get media data URL for template rendering
export async function getMediaDataUrl(filename) {
  if (!filename) return null

  const cacheKey = filename

  // Try memory cache first
  const cached = mediaCache.get(cacheKey)
  if (cached?.dataUrl) {
    return cached.dataUrl
  }

  // Load from database
  try {
    const mediaRecord = await db.media.get(cacheKey)
    if (mediaRecord?.blob) {
      const dataUrl = await _blobToDataUrl(mediaRecord.blob)

      // Cache for future use (merge with existing metadata)
      const updated = { ...cached, dataUrl }
      mediaCache.set(cacheKey, updated)

      return dataUrl
    }
  } catch (error) {
    log.warn('Failed to retrieve media for template:', filename, error)
  }

  return null
}

// Get media metadata for multiple bundles (for statistics)
export async function getBundlesMediaStats(bundleIds) {
  try {
    // Get all media NvIds referenced by bundles
    const mediaIds = new Set()

    // Get media from notes
    const notes = await db.notes.where('bundleId').anyOf(bundleIds).toArray()
    const templates = await db.templates.where('bundleId').anyOf(bundleIds).toArray()

    // Extract NvIds from note fields
    for (const note of notes) {
      for (const field of note.fields) {
        const matches = field.match(/\[sound:([^\]]+)\]/g)
        if (matches) {
          for (const match of matches) {
            const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
            if (nvId) mediaIds.add(nvId)
          }
        }
      }
    }

    // Extract NvIds from template formats
    for (const template of templates) {
      const formats = [template.qfmt, template.afmt].filter(Boolean)
      for (const format of formats) {
        const matches = format.match(/\[sound:([^\]]+)\]/g)
        if (matches) {
          for (const match of matches) {
            const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
            if (nvId) mediaIds.add(nvId)
          }
        }
      }
    }

    if (mediaIds.size === 0) {
      return []
    }

    // Get media records for all referenced NvIds
    const mediaRecords = await db.media.where('id').anyOf([...mediaIds]).toArray()

    // Return metadata without blobs for performance
    return mediaRecords.map(record => ({
      id: record.id,
      filename: record.filename,
      type: record.type,
      size: record.size,
      imported: record.imported
    }))
  } catch (error) {
    log.error('Failed to get bundles media stats:', error)
    return []
  }
}

// Replace media URLs in HTML content
export async function replaceMediaUrls(html) {
  if (!html) return html

  // Replace [sound:filename] with data URLs for browser playback
  return await _replaceAsync(html, /\[sound:([^\]]+)\]/g, async (match, filename) => {
    const dataUrl = await getMediaDataUrl(filename)
    if (dataUrl) {
      // Create audio element with data URL
      return `<audio controls><source src="${dataUrl}" type="audio/mpeg"></audio>`
    }
    return match // Keep original if no media found
  })
}

// Add media files to database and replace content with NvIds
export async function addMedia(content, mediaBlobs) {
  if (!content || !mediaBlobs || Object.keys(mediaBlobs).length === 0) {
    return content
  }

  let processedContent = content

  // Process each media reference
  for (const [filename, blob] of Object.entries(mediaBlobs)) {
    if (!blob) continue

    try {
      // Generate NvId for this media file
      const mediaId = await genNvId('media', filename + blob.size + blob.type)

      // Store media in database
      const mediaRecord = {
        id: mediaId,
        filename,
        blob,
        type: blob.type,
        size: blob.size,
        refCount: 0,
        imported: Date.now()
      }

      await db.media.put(mediaRecord)

      // Replace filename with NvId in content
      const filenameRegex = new RegExp(`\\[sound:${filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`, 'g')
      processedContent = processedContent.replace(filenameRegex, `[sound:${mediaId}]`)

      log.debug('Media processed:', { filename, mediaId, size: blob.size })
    } catch (error) {
      log.error('Failed to process media:', filename, error)
    }
  }

  return processedContent
}

// Remove media references (decrease refCount)
export async function removeMedia(content) {
  if (!content) return

  // Extract all NvIds from content
  const matches = content.match(/\[sound:([^\]]+)\]/g)
  if (!matches) return

  for (const match of matches) {
    const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
    if (!nvId) continue

    try {
      const media = await db.media.get(nvId)
      if (media) {
        const newRefCount = Math.max(0, (media.refCount || 0) - 1)
        if (newRefCount === 0) {
          await db.media.delete(nvId)
          mediaCache.delete(nvId)
          log.debug('Media deleted:', nvId)
        } else {
          await db.media.update(nvId, { refCount: newRefCount })
        }
      }
    } catch (error) {
      log.error('Failed to remove media reference:', nvId, error)
    }
  }
}

// Retain media references (increase refCount)
export async function retainMedia(content) {
  if (!content) return

  // Extract all NvIds from content
  const matches = content.match(/\[sound:([^\]]+)\]/g)
  if (!matches) return

  for (const match of matches) {
    const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
    if (!nvId) continue

    try {
      await db.media.update(nvId, (media) => ({
        ...media,
        refCount: (media.refCount || 0) + 1
      }))
    } catch (error) {
      log.error('Failed to retain media reference:', nvId, error)
    }
  }
}

// Helper for async string replacement (internal)
async function _replaceAsync(str, regex, asyncFn) {
  const promises = []
  let match

  // Reset regex lastIndex to ensure we start from the beginning
  regex.lastIndex = 0

  while ((match = regex.exec(str)) !== null) {
    const promise = asyncFn(match[0], match[1], match.index)
    promises.push(promise)

    // Prevent infinite loop on global regex
    if (!regex.global) break
  }

  const data = await Promise.all(promises)
  let result = str

  // Replace in reverse order to maintain correct indices
  const matches = []
  regex.lastIndex = 0
  while ((match = regex.exec(str)) !== null) {
    matches.push({ match: match[0], index: match.index })
    if (!regex.global) break
  }

  for (let i = matches.length - 1; i >= 0; i--) {
    const { match, index } = matches[i]
    const replacement = data[i]
    result = result.substring(0, index) + replacement + result.substring(index + match.length)
  }

  return result
}

// Remove media for bundles (cleanup)
export async function removeBundlesMedia(bundleIds) {
  try {
    const stats = { mediaFilesRemoved: 0, mediaSizeFreed: 0 }

    // Get all media NvIds that should be removed
    const mediaIdsToRemove = new Set()

    // Get media from notes
    const notes = await db.notes.where('bundleId').anyOf(bundleIds).toArray()
    const templates = await db.templates.where('bundleId').anyOf(bundleIds).toArray()

    // Extract NvIds from note fields
    for (const note of notes) {
      for (const field of note.fields) {
        const matches = field.match(/\[sound:([^\]]+)\]/g)
        if (matches) {
          for (const match of matches) {
            const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
            if (nvId) mediaIdsToRemove.add(nvId)
          }
        }
      }
    }

    // Extract NvIds from template formats
    for (const template of templates) {
      const formats = [template.qfmt, template.afmt].filter(Boolean)
      for (const format of formats) {
        const matches = format.match(/\[sound:([^\]]+)\]/g)
        if (matches) {
          for (const match of matches) {
            const nvId = match.match(/\[sound:([^\]]+)\]/)?.[1]
            if (nvId) mediaIdsToRemove.add(nvId)
          }
        }
      }
    }

    // Remove media records
    for (const nvId of mediaIdsToRemove) {
      const media = await db.media.get(nvId)
      if (media) {
        stats.mediaSizeFreed += media.size || 0
        await db.media.delete(nvId)
        mediaCache.delete(nvId)
        stats.mediaFilesRemoved++
      }
    }

    return stats
  } catch (error) {
    log.error('Failed to remove bundles media:', error)
    return { mediaFilesRemoved: 0, mediaSizeFreed: 0 }
  }
}

// Get media statistics for bundles (wrapper for getBundlesMediaStats)
export async function getMediaStatsForBundles(bundleIds) {
  try {
    const bundlesMedia = await getBundlesMediaStats(bundleIds)

    if (bundlesMedia.length === 0) {
      return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' }
    }

    const totalSize = bundlesMedia.reduce((sum, media) => sum + (media.size || 0), 0)
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)

    return {
      fileCount: bundlesMedia.length,
      totalSize,
      totalSizeMB
    }
  } catch (error) {
    log.error('Failed to get media stats:', error)
    return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' }
  }
}

// Clear cache (for testing)
export function clearCache() {
  mediaCache.clear()
}

// No default export needed - use named exports directly
