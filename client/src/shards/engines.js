import * as subtitleEngine from './subtitle/SubtitleShard.js'
import * as ankiEngine from './anki/AnkiShard.js'

// Registry of shard engines by type
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  anki: ankiEngine
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

// File detection across all engines
export const engineDetect = async (filename, buffer) => {
  const results = []

  // Run detection on all registered engines
  for (const [shardType, engine] of Object.entries(SHARD_ENGINES)) {
    if (engine?.detect) {
      const result = engine.detect(filename, buffer)
      results.push({
        name: shardType,
        processor: engine,
        ...result
      })
    }
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence)

  // Return highest confidence result
  const winner = results[0]
  return winner?.match && winner.confidence >= 0.5 ? winner : null
}

// Save data processing - handles uploads and converts shardData to backend format
export const engineSaveData = async (shard, apiCall) => {
  const engine = getEngine(shard.type)
  if (!engine?.processData) {
    return
  }
  await engine.processData(shard, apiCall)
}
