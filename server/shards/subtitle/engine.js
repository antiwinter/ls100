import * as subtitleData from './data.js'
import { log } from '../../utils/logger.js'

// Subtitle Engine for server-side processing
export const engine = {
  type: 'subtitle',
  
  // Process shard creation with subtitle-specific logic
  async processCreate(shard, data) {
    log.info({ shardId: shard.id }, 'Processing shard creation')
    return this._processSubtitles(shard, data, true)
  },
  
  // Process shard updates with subtitle-specific logic
  async processUpdate(shard, data, updateData) {
    log.info({ shardId: shard.id }, 'Processing shard update')
    return this._processSubtitles(shard, data, false)
  },
  
  // Internal: Handle subtitle linking logic (shared between create/update)
  _processSubtitles(shard, data, isCreate) {
    log.debug({ data, isCreate }, 'Processing subtitles')
    
    // Handle initial content (single subtitle from file upload) - create only
    if (isCreate && data.initialContent?.subtitle_id) {
      const subtitleId = data.initialContent.subtitle_id
      log.debug({ subtitleId }, 'Linking initial subtitle as main')
      subtitleData.linkSubtitle(shard.id, subtitleId, true)
    }
    
    // Handle languages array (consistent with frontend format)
    if (data.languages && Array.isArray(data.languages)) {
      if (isCreate) {
        // Create: Just link all languages
        log.debug({ languages: data.languages }, 'Linking languages for creation')
        for (const language of data.languages) {
          if (language.subtitle_id) {
            subtitleData.linkSubtitle(shard.id, language.subtitle_id, language.isMain || false)
          }
        }
      } else {
        // Update: Compare current vs desired and sync
        const currentSubtitles = subtitleData.getSubtitles(shard.id)
        const currentIds = currentSubtitles.map(s => s.subtitle_id)
        
        const desiredLanguages = data.languages.filter(lang => lang.subtitle_id)
        const desiredIds = desiredLanguages.map(lang => lang.subtitle_id)
        
        // Unlink removed, link new, update is_main flags
        const toUnlink = currentIds.filter(id => !desiredIds.includes(id))
        
        log.debug({ toUnlink, desiredIds }, 'Updating subtitle links')
        
        for (const subtitleId of toUnlink) {
          subtitleData.unlinkSubtitle(shard.id, subtitleId)
        }
        
        for (const language of desiredLanguages) {
          subtitleData.linkSubtitle(shard.id, language.subtitle_id, language.isMain || false)
        }
      }
      
      log.info('Subtitle processing completed')
    }
    
    return shard
  },
  
  // Validate subtitle-specific data
  validateData(data) {
    if (!data) return { valid: true }
    
    if (data.languages && !Array.isArray(data.languages)) {
      return { 
        valid: false, 
        error: 'languages must be an array of language objects' 
      }
    }
    
    return { valid: true }
  },
  
  // Get engine-specific data for shard (unified frontend format)
  getData(shardId) {
    const subtitles = subtitleData.getSubtitles(shardId)
    return {
      languages: subtitles.map(sub => ({
        code: sub.language,
        filename: sub.filename,
        movie_name: sub.movie_name,
        subtitle_id: sub.subtitle_id,
        isMain: !!sub.is_main
      }))
    }
  }
} 