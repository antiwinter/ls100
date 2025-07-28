import * as subtitleData from './data.js'

// Subtitle Engine for server-side processing
export const engine = {
  type: 'subtitle',
  
  // Process shard creation with subtitle-specific logic
  async processCreate(shard, shardData) {
    console.log('📽️ [SubtitleEngine] Processing shard creation:', shard.id)
    console.log('📽️ [SubtitleEngine] Shard data:', shardData)
    
    // Handle initial content (single subtitle from file upload)
    if (shardData.initialContent?.subtitle_id) {
      const subtitleId = shardData.initialContent.subtitle_id
      console.log('🔗 [SubtitleEngine] Linking initial subtitle:', subtitleId, 'as main')
      subtitleData.linkSubtitle(shard.id, subtitleId, true) // Initial subtitle is main
    }
    
    // Handle additional subtitles array (for multi-language shards)
    if (shardData.subtitles && Array.isArray(shardData.subtitles)) {
      console.log('🔗 [SubtitleEngine] Linking additional subtitles:', shardData.subtitles)
      
      for (const subtitle of shardData.subtitles) {
        // Handle both old format (just ID) and new format (object with is_main)
        const subtitleId = typeof subtitle === 'string' ? subtitle : subtitle.subtitle_id
        const isMain = typeof subtitle === 'object' ? subtitle.is_main : false
        
        if (subtitleId) {
          console.log('🔗 [SubtitleEngine] Linking subtitle:', subtitleId, 'isMain:', isMain)
          subtitleData.linkSubtitle(shard.id, subtitleId, isMain)
        }
      }
      
      console.log('✅ [SubtitleEngine] All subtitles linked successfully')
    }
    
    return shard
  },
  
  // Process shard updates with subtitle-specific logic
  async processUpdate(shard, shardData, updateData) {
    console.log('📽️ [SubtitleEngine] Processing shard update:', shard.id)
    console.log('📝 [SubtitleEngine] Desired subtitle IDs:', shardData.subtitles)
    
    // Handle subtitle linking/unlinking if needed
    if (shardData.subtitles && Array.isArray(shardData.subtitles)) {
      // Get currently linked subtitles
      const currentSubtitles = subtitleData.getSubtitles(shard.id)
      const currentSubtitleIds = currentSubtitles.map(s => s.subtitle_id)
      
      // Parse desired subtitles (handle both old and new format)
      const desiredSubtitles = shardData.subtitles.map(subtitle => {
        if (typeof subtitle === 'string') {
          return { subtitle_id: subtitle, is_main: false }
        }
        return subtitle
      }).filter(s => s.subtitle_id)
      
      const desiredSubtitleIds = desiredSubtitles.map(s => s.subtitle_id)
      
      console.log('🔍 [SubtitleEngine] Current subtitle IDs:', currentSubtitleIds)
      console.log('🎯 [SubtitleEngine] Desired subtitles:', desiredSubtitles)
      
      // Find subtitles to unlink (in current but not in desired)
      const toUnlink = currentSubtitleIds.filter(id => !desiredSubtitleIds.includes(id))
      // Find subtitles to link (in desired but not in current)
      const toLink = desiredSubtitles.filter(s => !currentSubtitleIds.includes(s.subtitle_id))
      
      console.log('❌ [SubtitleEngine] Unlinking subtitles:', toUnlink)
      console.log('✅ [SubtitleEngine] Linking new subtitles:', toLink.map(s => s.subtitle_id))
      
      // Unlink removed subtitles
      for (const subtitleId of toUnlink) {
        subtitleData.unlinkSubtitle(shard.id, subtitleId)
      }
      
      // Link/update all desired subtitles with correct is_main flags
      for (const subtitle of desiredSubtitles) {
        console.log('🔗 [SubtitleEngine] Linking/updating subtitle:', subtitle.subtitle_id, 'isMain:', subtitle.is_main)
        subtitleData.linkSubtitle(shard.id, subtitle.subtitle_id, subtitle.is_main)
      }
      
      console.log('🔄 [SubtitleEngine] Subtitle links updated successfully')
    }
    
    return shard
  },
  
  // Validate subtitle-specific shard data
  validateShardData(shardData) {
    if (!shardData) return { valid: true }
    
    if (shardData.subtitles && !Array.isArray(shardData.subtitles)) {
      return { 
        valid: false, 
        error: 'subtitles must be an array of subtitle IDs' 
      }
    }
    
    return { valid: true }
  }
} 