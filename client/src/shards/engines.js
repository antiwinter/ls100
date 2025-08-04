import * as subtitleEngine from './subtitle/SubtitleShard.js'

// Registry of shard engines by type
const SHARD_ENGINES = {
  subtitle: subtitleEngine
  // Future: audio: audioEngine, image: imageEngine, etc.
}

// Get engine for a shard type
export const getEngine = (shardType) => {
  return SHARD_ENGINES[shardType]
}

// Generic cover generation
export const engineGenCover = (shard) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.generateCover) {
    // Fallback for unknown types or engines without cover generation
    return {
      type: 'text',
      title: shard.name,
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      textColor: '#ffffff'
    }
  }
  
  return engine.generateCover(shard)
}

// Get shard type info/tags
export const engineGetTag = (shardType) => {
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

// Get editor component
export const engineGetEditor = (shardType) => {
  const engine = getEngine(shardType)
  return engine?.EditorComponent || null
}

// Get reader component
export const engineGetReader = (shardType) => {
  const engine = getEngine(shardType)
  return engine?.ReaderComponent || null
}

// Save data processing - handles uploads and converts shardData to backend format
export const engineSaveData = async (shard, apiCall) => {
  const engine = getEngine(shard.type)
  if (!engine?.processData) {
    return
  }
  await engine.processData(shard, apiCall)
} 