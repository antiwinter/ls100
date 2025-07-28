import { engine as subtitleEngine } from './subtitle/engine.js'

// Registry of shard engines by type
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: audio: audioEngine, image: imageEngine, etc.
}

// Get engine for a shard type (returns default engine if no type specified)
export const getEngine = (shardType) => {
  // If no type specified, return the first available engine as default
  if (!shardType) {
    const defaultType = Object.keys(SHARD_ENGINES)[0]
    return defaultType ? SHARD_ENGINES[defaultType] : null
  }
  
  return SHARD_ENGINES[shardType]
}

// Get all available engine types (for migrations, etc.)
export const getEngineTypes = () => {
  return Object.keys(SHARD_ENGINES)
}

// Get the default engine type
export const getDefaultEngineType = () => {
  return Object.keys(SHARD_ENGINES)[0] || null
}

// Process shard creation with engine-specific logic
export const processShardCreate = async (shard, shardData) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.processCreate) {
    console.log(`⚠️ [EngineRegistry] No processCreate method for engine: ${shard.type}`)
    return shard
  }
  
  return await engine.processCreate(shard, shardData)
}

// Process shard update with engine-specific logic
export const processShardUpdate = async (shard, shardData, updateData) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.processUpdate) {
    console.log(`⚠️ [EngineRegistry] No processUpdate method for engine: ${shard.type}`)
    return shard
  }
  
  return await engine.processUpdate(shard, shardData, updateData)
}

// Validate shard data with engine-specific logic
export const validateShardData = (shardType, shardData) => {
  const engine = getEngine(shardType)
  
  if (!engine || !engine.validateShardData) {
    return { valid: true }
  }
  
  return engine.validateShardData(shardData)
} 