import * as subtitleEngine from './subtitle/SubtitleShard.js'

// Registry of shard engines by type
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: audio: audioEngine, image: imageEngine, etc.
}

// Get engine for a shard type
export const getEngine = (shardType) => {
  return SHARD_ENGINES[shardType]
}

// Generic cover generation - delegates to appropriate shard engine
export const generateCoverFromShard = (shard) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.generateCoverFromShard) {
    // Fallback for unknown types or engines without cover generation
    return {
      type: "text",
      title: shard.name,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff'
    }
  }
  
  return engine.generateCoverFromShard(shard)
}

// Get suggested shard name from detected info
export const getSuggestedName = (detectedInfo) => {
  const engine = getEngine(detectedInfo.shardType)
  
  if (!engine || !engine.getSuggestedName) {
    return detectedInfo.filename?.replace(/\.[^/.]+$/, '') || 'Untitled Shard'
  }
  
  return engine.getSuggestedName(detectedInfo)
}

// Get shard type info
export const getShardTypeInfo = (shardType) => {
  const engine = getEngine(shardType)
  
  if (!engine || !engine.shardTypeInfo) {
    return {
      name: shardType,
      displayName: `${shardType} Shard`,
      color: '#667eea'
    }
  }
  
  return engine.shardTypeInfo
}

// Create shard using engine
export const createShard = async (detectedInfo) => {
  const engine = getEngine(detectedInfo.shardType)
  
  if (!engine || !engine.createShard) {
    throw new Error(`No createShard method for engine: ${detectedInfo.shardType}`)
  }
  
  return engine.createShard(detectedInfo.file, {})
}

// Get editor component for shard type
export const getEditorComponent = (shardType) => {
  const engine = getEngine(shardType)
  return engine?.EditorComponent || null
}

// Generic engine content creation
export const createShardContent = async (engineType, detectedInfo) => {
  const engine = getEngine(engineType)
  if (!engine?.createContent) {
    throw new Error(`Engine ${engineType} does not support content creation`)
  }
  return await engine.createContent(detectedInfo)
}

// Generic engine data processing
export const processEngineData = async (engineType, engineData, apiCall) => {
  const engine = getEngine(engineType)
  if (!engine?.processData) {
    return engineData
  }
  return await engine.processData(engineData, apiCall)
}

// Process raw shard data from API into engine format
export const processShardData = (engineType, rawData) => {
  const engine = getEngine(engineType)
  return engine?.processShardData?.(rawData) || rawData
}

// Get reader component for shard type  
export const getReaderComponent = (shardType) => {
  const engine = getEngine(shardType)
  return engine?.ReaderComponent || null
} 