import db from '../storage/db.js'
import { log } from '../../../utils/logger'

// Media file management for Anki cards
export class MediaManager {
  constructor() {
    // Unified KV cache structure:
    // key: "deckId-filename"
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
  async _ensureMetadata(cacheKey, filename, _deckId) {
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
  async getMediaDataUrl(filename, deckId) {
    const cacheKey = `${deckId}-${filename}`

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
  async getDeckMediaStats(deckId) {
    try {
      const mediaRecords = await db.media.where('deckId').equals(deckId).toArray()
      return mediaRecords.map(record => {
        const cacheKey = `${deckId}-${record.filename}`
        // Update cache with metadata while we have it
        const cached = this.mediaCache.get(cacheKey)
        const metadata = {
          filename: record.filename,
          size: record.size,
          type: record.type,
          imported: record.imported
        }
        this.mediaCache.set(cacheKey, { ...cached, ...metadata })
        return metadata
      })
    } catch (error) {
      log.error('Failed to get deck media stats:', error)
      return []
    }
  }

  // Get media metadata for multiple decks (for statistics)
  async getDecksMediaStats(deckIds) {
    try {
      const mediaRecords = await db.media.where('deckId').anyOf(deckIds).toArray()
      return mediaRecords.map(record => {
        const cacheKey = `${record.deckId}-${record.filename}`
        // Update cache with metadata while we have it
        const cached = this.mediaCache.get(cacheKey)
        const metadata = {
          filename: record.filename,
          size: record.size,
          type: record.type,
          imported: record.imported
        }
        this.mediaCache.set(cacheKey, { ...cached, ...metadata })
        return metadata
      })
    } catch (error) {
      log.error('Failed to get decks media stats:', error)
      return []
    }
  }

  // Replace media URLs in HTML content
  async replaceMediaUrls(html, deckId) {
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
      const dataUrl = await this.getMediaDataUrl(filename, deckId)
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

  // Extract media file references from HTML
  extractMediaReferences(html) {
    const references = new Set()

    // Match src attributes in img, audio, video tags
    const srcPattern = /src=["']?([^"'\s>]+\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|mp4|webm))["']?/gi
    let match

    while ((match = srcPattern.exec(html)) !== null) {
      const filename = match[1]
      // Only include relative paths (Anki media files)
      if (!filename.startsWith('http') && !filename.startsWith('data:') && !filename.startsWith('/')) {
        references.add(filename)
      }
    }

    return Array.from(references)
  }

  // Helper: Escape special regex characters
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Clear cache for memory management
  clearCache() {
    this.mediaCache.clear()
    log.debug('Media cache cleared')
  }

  // Remove media files for multiple decks (cleanup)
  async removeDecksMedia(deckIds) {
    try {
      // Get all media records for deletion
      const decksMedia = await db.media.where('deckId').anyOf(deckIds).toArray()

      for (const media of decksMedia) {
        await db.media.delete(media.id)
        // Clear cache entry
        this.mediaCache.delete(media.id)
      }

      log.debug(`Removed ${decksMedia.length} media files for decks: ${deckIds.join(', ')}`)
      return decksMedia.length
    } catch (error) {
      log.error('Failed to remove decks media:', error)
      return 0
    }
  }

  // Get storage usage statistics for multiple decks
  async getMediaStatsForDecks(deckIds) {
    try {
      const decksMedia = await this.getDecksMediaStats(deckIds)
      const totalSize = decksMedia.reduce((sum, media) => sum + (media.size || 0), 0)

      return {
        fileCount: decksMedia.length,
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
