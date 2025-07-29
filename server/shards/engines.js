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
export const engineProcessCreate = async (shard, data) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.processCreate) {
    console.log(`⚠️ [EngineRegistry] No processCreate method for engine: ${shard.type}`)
    return shard
  }
  
  return await engine.processCreate(shard, data)
}

// Process shard update with engine-specific logic
export const engineProcessUpdate = async (shard, data, updateData) => {
  const engine = getEngine(shard.type)
  
  if (!engine || !engine.processUpdate) {
    console.log(`⚠️ [EngineRegistry] No processUpdate method for engine: ${shard.type}`)
    return shard
  }
  
  return await engine.processUpdate(shard, data, updateData)
}

// Validate shard data with engine-specific logic
export const engineValidateData = (shardType, data) => {
  const engine = getEngine(shardType)
  
  if (!engine || !engine.validateData) {
    return { valid: true }
  }
  
  return engine.validateData(data)
}

// Get engine-specific shard data
export const engineGetData = (shardType, shardId) => {
  const engine = getEngine(shardType)
  
  if (!engine || !engine.getData) {
    return {}
  }
  
  return engine.getData(shardId)
} 