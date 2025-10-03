import oss from '../utils/oss'
import { log } from '../utils/logger'

/**
 * File storage abstraction - local OSS only
 * Migration is handled by migrator.js
 */
export const fileStore = {
  /**
   * Get file by nvId from local OSS
   * @param {string} nvId - File nvId (obj_xxx)
   * @returns {Promise<{blob: Blob, nvId: string}>}
   */
  async get(nvId) {
    if (!nvId) {
      log.warn('fileStore.get called with empty nvId')
      return { blob: null, nvId: null }
    }

    const obj = await oss.getObj(nvId)
    if (obj) {
      log.debug('File loaded from OSS', { nvId, size: obj.size })
      return { blob: obj.blob, nvId }
    }

    log.warn('File not found in OSS', { nvId })
    return { blob: null, nvId: null }
  },

  /**
   * Store file in local OSS
   * @param {string} filename - Original filename
   * @param {Blob} blob - File content
   * @param {string} refId - Reference ID for tracking (shard ID)
   * @returns {Promise<string>} nvId of stored file
   */
  async store(filename, blob, refId = 'sys') {
    if (!blob) {
      log.warn('fileStore.store called with empty blob')
      return null
    }

    try {
      const nvId = await oss.blob2NvId(blob)
      await oss.add([{ filename, blob }], refId)
      log.info('File stored in OSS', { filename, nvId, refId, size: blob.size })
      return nvId
    } catch (error) {
      log.error('Failed to store file', { filename, refId }, error)
      throw error
    }
  },

  /**
   * Delete file from local OSS
   * @param {string} nvId - File nvId
   * @param {string} refId - Reference ID
   */
  async delete(nvId, refId = 'sys') {
    if (!nvId) {
      log.warn('fileStore.delete called with empty nvId')
      return
    }

    try {
      await oss.remove(nvId, refId)
      log.debug('File reference removed from OSS', { nvId, refId })
    } catch (error) {
      log.error('Failed to delete file', { nvId, refId }, error)
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

