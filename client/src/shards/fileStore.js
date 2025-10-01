import oss from '../utils/oss'
import { apiCall } from '../config/api'
import { log } from '../utils/logger'

/**
 * File storage abstraction with local-first approach
 * - Tries local OSS (IndexedDB) first
 * - Falls back to backend API
 * - Auto-migrates BE files to local on access
 */
export const fileStore = {
  /**
   * Get file by ID - tries local OSS first, falls back to BE subtitle API
   * @param {string} id - nvId (local) or subtitle_id (backend)
   * @param {string} filename - Original filename for reference
   * @returns {Promise<{blob: Blob, nvId: string}>}
   */
  async get(id, filename = 'file') {
    if (!id) {
      log.warn('fileStore.get called with empty id')
      return { blob: null, nvId: null }
    }

    // Try local OSS first (assumes id is nvId)
    const obj = await oss.getObj(id)
    if (obj) {
      log.debug('File loaded from local OSS', { nvId: id, size: obj.size })
      return { blob: obj.blob, nvId: id }
    }

    // Fallback to BE subtitle API (id is subtitle_id)
    try {
      log.debug('File not in local, fetching from BE subtitle API', { subtitle_id: id })

      const response = await apiCall(`/api/subtitles/${id}/content`)

      // apiCall returns text for content endpoint, convert to blob
      const blob = new Blob([response], { type: 'text/plain; charset=utf-8' })

      // Cache locally
      const nvId = await oss.blob2NvId(blob)
      await oss.add([{ filename, blob }], nvId)

      log.info('File fetched from BE and cached', { subtitle_id: id, nvId, size: blob.size })

      return { blob, nvId }
    } catch (error) {
      log.error('Failed to load file from BE', { id }, error)
      return { blob: null, nvId: null }
    }
  },

  /**
   * Store file locally in OSS
   * @param {string} filename - Original filename
   * @param {Blob} blob - File content
   * @param {string} userId - User/shard ID for reference tracking
   * @returns {Promise<string>} nvId of stored file
   */
  async store(filename, blob, userId = 'sys') {
    if (!blob) {
      log.warn('fileStore.store called with empty blob')
      return null
    }

    try {
      const nvId = await oss.blob2NvId(blob)
      await oss.add([{ filename, blob }], userId)
      log.info('File stored in local OSS', { filename, nvId, userId, size: blob.size })
      return nvId
    } catch (error) {
      log.error('Failed to store file', { filename, userId }, error)
      throw error
    }
  },

  /**
   * Delete file from local OSS
   * @param {string} nvId - File nvId
   * @param {string} userId - User/shard ID for reference tracking
   */
  async delete(nvId, userId = 'sys') {
    if (!nvId) {
      log.warn('fileStore.delete called with empty nvId')
      return
    }

    try {
      await oss.remove(nvId, userId)
      log.debug('File reference removed from OSS', { nvId, userId })
    } catch (error) {
      log.error('Failed to delete file', { nvId, userId }, error)
    }
  },

  /**
   * Get file stats (for debugging/admin)
   */
  async getStats() {
    return await oss.getStats()
  }
}

export default fileStore

