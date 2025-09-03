import { idb } from '../storage/storageManager'
import { log } from '../../../utils/logger'

// Media file management for Anki cards
export class MediaManager {
  constructor() {
    this.mediaCache = new Map() // Cache for frequently accessed media
  }

  // Get media file for a specific deck
  async getMedia(filename, deckId) {
    const cacheKey = `${deckId}-${filename}`

    // Check cache first
    if (this.mediaCache.has(cacheKey)) {
      return this.mediaCache.get(cacheKey)
    }

    // Query IndexedDB
    try {
      const mediaRecord = await idb.get('media', cacheKey)
      if (mediaRecord) {
        // Cache the result
        this.mediaCache.set(cacheKey, mediaRecord)
        return mediaRecord
      }
    } catch (error) {
      log.warn('Failed to retrieve media:', filename, error)
    }

    return null
  }

  // Get all media files for a deck
  async getDeckMedia(deckId) {
    try {
      const allMedia = await idb.getAll('media')
      return allMedia.filter(media => media.deckId === deckId)
    } catch (error) {
      log.error('Failed to get deck media:', error)
      return []
    }
  }

  // Get all media files for multiple decks
  async getDecksMedia(deckIds) {
    try {
      const allMedia = await idb.getAll('media')
      return allMedia.filter(media => deckIds.includes(media.deckId))
    } catch (error) {
      log.error('Failed to get decks media:', error)
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
      const mediaRecord = await this.getMedia(filename, deckId)
      if (mediaRecord && mediaRecord.dataUrl) {
        // Replace src attributes with data URL
        const patterns = [
          new RegExp(`src=["']${this.escapeRegExp(filename)}["']`, 'gi'),
          new RegExp(`src=${this.escapeRegExp(filename)}(?=\\s|>)`, 'gi')
        ]

        for (const pattern of patterns) {
          processedHtml = processedHtml.replace(pattern, `src="${mediaRecord.dataUrl}"`)
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
      const decksMedia = await this.getDecksMedia(deckIds)

      for (const media of decksMedia) {
        await idb.delete('media', media.id)
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
      const decksMedia = await this.getDecksMedia(deckIds)
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
