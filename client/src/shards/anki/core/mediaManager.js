import db from '../storage/db.js'
import { log } from '../../../utils/logger'
import { genNvId } from '../../../utils/idGenerator.js'

// Media file management for Anki cards
export class MediaManager {
  constructor() {
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
    this.mediaCache = new Map()
  }

  // Get or load media metadata into unified cache
  async _ensureMetadata(cacheKey, filename) {
    let cached = this.mediaCache.get(cacheKey)

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
        this.mediaCache.set(cacheKey, updated)
        return updated
      }
    } catch (error) {
      log.warn('Failed to retrieve media metadata:', filename, error)
    }

    return null
  }

  // Convert blob to data URL on demand
  async _blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  // Get data URL for media (with caching) - primary method for template rendering
  async getMediaDataUrl(filename) {
    const cacheKey = filename

    // Check if dataUrl already cached
    let cached = this.mediaCache.get(cacheKey)
    if (cached?.dataUrl) {
      return cached.dataUrl
    }

    // Generate dataUrl from blob and cache it
    try {
      const mediaRecord = await db.media.get(cacheKey)
      if (mediaRecord?.blob) {
        const dataUrl = await this._blobToDataUrl(mediaRecord.blob)

        // Update unified cache with dataUrl (preserve existing metadata if any)
        const updated = {
          ...cached,
          dataUrl,
          // Also cache metadata while we have it
          filename: mediaRecord.filename,
          size: mediaRecord.size,
          type: mediaRecord.type,
          imported: mediaRecord.imported
        }
        this.mediaCache.set(cacheKey, updated)
        return dataUrl
      }
    } catch (error) {
      log.warn('Failed to retrieve media for data URL:', filename, error)
    }

    return null
  }

  // Get media metadata for statistics (returns metadata without blobs)
  async getBundleMediaStats(bundleId) {
    try {
      // Delegate to getBundlesMediaStats for consistency
      return await this.getBundlesMediaStats([bundleId])
    } catch (error) {
      log.error('Failed to get bundle media stats:', error)
      return []
    }
  }

  // Get media metadata for multiple bundles (for statistics)
  async getBundlesMediaStats(bundleIds) {
    try {
      // Get all media NvIds referenced by bundles
      const mediaIds = new Set()

      // Get NvIds from notes and templates for these bundles
      const notes = await db.notes.where('bundleId').anyOf(bundleIds).toArray()
      const templates = await db.templates.where('bundleId').anyOf(bundleIds).toArray()

      // Extract media references from note fields
      for (const note of notes) {
        for (const field of note.fields || []) {
          const refs = this.extractMediaReferences(field)
          refs.forEach(ref => mediaIds.add(ref))
        }
      }

      // Extract media references from template formats
      for (const template of templates) {
        const qRefs = this.extractMediaReferences(template.qfmt || '')
        const aRefs = this.extractMediaReferences(template.afmt || '')
        qRefs.forEach(ref => mediaIds.add(ref))
        aRefs.forEach(ref => mediaIds.add(ref))
      }

      // Get media records for these NvIds
      const mediaRecords = await db.media.where('id').anyOf([...mediaIds]).toArray()

      return mediaRecords.map(record => {
        // Update cache with metadata while we have it
        const cached = this.mediaCache.get(record.id)
        const metadata = {
          filename: record.filename,
          size: record.size,
          type: record.type,
          imported: record.imported
        }
        this.mediaCache.set(record.id, { ...cached, ...metadata })
        return metadata
      })
    } catch (error) {
      log.error('Failed to get bundles media stats:', error)
      return []
    }
  }

  // Replace media URLs in HTML content
  async replaceMediaUrls(html) {
    if (!html || typeof html !== 'string') {
      return html
    }

    // Find all media references in the HTML
    const mediaReferences = this.extractMediaReferences(html)
    if (mediaReferences.length === 0) {
      return html
    }

    let processedHtml = html

    // Replace each media reference
    for (const filename of mediaReferences) {
      const dataUrl = await this.getMediaDataUrl(filename)
      if (dataUrl) {
        // Replace src attributes with data URL
        const patterns = [
          new RegExp(`src=["']${this.escapeRegExp(filename)}["']`, 'gi'),
          new RegExp(`src=${this.escapeRegExp(filename)}(?=\\s|>)`, 'gi')
        ]

        for (const pattern of patterns) {
          processedHtml = processedHtml.replace(pattern, `src="${dataUrl}"`)
        }

        log.debug(`Replaced media reference: ${filename}`)
      } else {
        log.warn(`Media file not found: ${filename}`)
        // Could optionally replace with placeholder image
      }
    }

    return processedHtml
  }

  // Extract media NvIds from cooked HTML content
  extractMediaReferences(html) {
    const nvIds = new Set()
    if (!html || typeof html !== 'string') {
      return []
    }

    // Match src attributes containing NvIds (format: prefix-hash where hash is 64 hex chars)
    const srcPattern = /src=["']?([a-zA-Z0-9]+-[a-f0-9]{64})["']?/gi
    let match

    while ((match = srcPattern.exec(html)) !== null) {
      const possibleNvId = match[1]
      // NvId validation: prefix-64charHexHash format
      if (/^[a-zA-Z0-9]+-[a-f0-9]{64}$/.test(possibleNvId)) {
        nvIds.add(possibleNvId)
      }
    }

    return Array.from(nvIds)
  }

  // Helper: Escape special regex characters
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Add media from raw content with blob context (Raw → Cooked)
  async addMedia(content, mediaBlobs) {
    if (!content || typeof content !== 'string') return content
    if (!mediaBlobs) {
      throw new Error('mediaBlobs required for addMedia - cannot add media without blob data')
    }

    let cookedContent = content

    // Extract filenames and replace with NvIds
    const srcPattern = /src=["']?([^"'\s>]+\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|mp4|webm))["']?/gi

    cookedContent = await this._replaceAsync(cookedContent, srcPattern, async (match, filename) => {
      if (!mediaBlobs[filename]) {
        throw new Error(`Media blob not found for filename: ${filename}`)
      }

      // Generate NvId from blob content
      const mediaData = mediaBlobs[filename]
      const nvId = await genNvId('media', mediaData.blob)

      // Upsert media record
      const existingMedia = await db.media.get(nvId)
      if (existingMedia) {
        // Media exists: increment refCount
        await db.media.where('id').equals(nvId).modify(media => {
          media.refCount = (media.refCount || 0) + 1
        })
      } else {
        // New media: create record
        await db.media.put({
          id: nvId,
          filename,
          blob: mediaData.blob,
          size: mediaData.size,
          type: mediaData.type,
          refCount: 1,
          imported: Date.now()
        })
      }

      // Replace filename with NvId
      return match.replace(filename, nvId)
    })

    return cookedContent
  }

  // Remove media references from cooked content (decrement refCount, auto-cleanup)
  async removeMedia(content) {
    if (!content || typeof content !== 'string') return []

    const nvIds = this.extractMediaReferences(content)
    for (const nvId of nvIds) {
      // Decrement refCount
      await db.media.where('id').equals(nvId).modify(media => {
        media.refCount = Math.max(0, (media.refCount || 1) - 1)
      })

      // Auto-cleanup if refCount reaches 0
      const media = await db.media.get(nvId)
      if (media && media.refCount <= 0) {
        await db.media.delete(nvId)
        this.mediaCache.delete(nvId)
        log.info(`🗑️ Auto-removed unused media: ${nvId}`)
      }
    }
    return nvIds
  }

  // Retain media references from cooked content (increment refCount for existing NvIds)
  async retainMedia(content) {
    if (!content || typeof content !== 'string') return []

    const nvIds = this.extractMediaReferences(content)
    for (const nvId of nvIds) {
      await db.media.where('id').equals(nvId).modify(media => {
        media.refCount = (media.refCount || 0) + 1
      })
    }
    return nvIds
  }

  // Helper: Async string replacement
  async _replaceAsync(str, regex, asyncFn) {
    const promises = []
    const matches = []

    // Collect all matches first
    str.replace(regex, (match, ...args) => {
      matches.push({ match, args })
      return match
    })

    // Process matches with async function
    for (const { match, args } of matches) {
      promises.push(asyncFn(match, ...args))
    }

    const replacements = await Promise.all(promises)

    // Apply replacements
    let result = str
    let index = 0
    result = result.replace(regex, () => replacements[index++])

    return result
  }

  // Clear cache for memory management
  clearCache() {
    this.mediaCache.clear()
    log.debug('Media cache cleared')
  }

  // Remove media files for multiple bundles (cleanup)
  async removeBundlesMedia(bundleIds) {
    try {
      const mediaIds = new Set()

      // Get NvIds from notes and templates for these bundles
      const notes = await db.notes.where('bundleId').anyOf(bundleIds).toArray()
      const templates = await db.templates.where('bundleId').anyOf(bundleIds).toArray()

      // Extract media references from note fields
      for (const note of notes) {
        for (const field of note.fields || []) {
          const refs = this.extractMediaReferences(field)
          refs.forEach(ref => mediaIds.add(ref))
        }
      }

      // Extract media references from template formats
      for (const template of templates) {
        const qRefs = this.extractMediaReferences(template.qfmt || '')
        const aRefs = this.extractMediaReferences(template.afmt || '')
        qRefs.forEach(ref => mediaIds.add(ref))
        aRefs.forEach(ref => mediaIds.add(ref))
      }

      // Remove media files by decrementing refCount (auto-cleanup will handle deletion)
      let removedCount = 0
      for (const mediaId of mediaIds) {
        const media = await db.media.get(mediaId)
        if (media) {
          await this.removeMedia(`<img src="${mediaId}">`) // Trigger refCount decrement
          removedCount++
        }
      }

      log.debug(`Processed ${removedCount} media files for bundles: ${bundleIds.join(', ')}`)
      return removedCount
    } catch (error) {
      log.error('Failed to remove bundles media:', error)
      return 0
    }
  }

  // Get storage usage statistics for multiple bundles
  async getMediaStatsForBundles(bundleIds) {
    try {
      const bundlesMedia = await this.getBundlesMediaStats(bundleIds)
      const totalSize = bundlesMedia.reduce((sum, media) => sum + (media.size || 0), 0)

      return {
        fileCount: bundlesMedia.length,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      }
    } catch (error) {
      log.error('Failed to get media stats:', error)
      return { fileCount: 0, totalSize: 0, totalSizeMB: '0.00' }
    }
  }
}

// Singleton instance
export const mediaManager = new MediaManager()
export default mediaManager
