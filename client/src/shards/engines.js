import React from 'react'
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

  if (engine?.CoverComponent) {
    const Cover = engine.CoverComponent
    return React.createElement(Cover, { shard })
  }

  // Fallback simple cover element
  const title = shard?.name || 'SHARD'
  const background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  const textColor = '#ffffff'

  return React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background,
        color: textColor,
        padding: 8,
        lineHeight: 1
      }
    },
    React.createElement(
      'div',
      {
        style: {
          fontSize: 14,
          fontWeight: 900,
          fontFamily: 'Inter, Roboto, Arial Black, sans-serif',
          textShadow: '0 1px 2px rgba(0,0,0,0.7)'
        }
      },
      title.toUpperCase()
    )
  )
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

// Get reader component for specific mode
export const engineGetReader = (shardType) => {
  return getEngine(shardType)?.ReaderComponent
}

// File detection across all engines
export const engineDetect = async (filename, buffer) => {
  const results = []

  // Run detection on all registered engines
  for (const [shardType, engine] of Object.entries(SHARD_ENGINES)) {
    if (engine?.detect) {
      const result = await engine.detect(filename, buffer)
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

// Save data processing - handles file uploads and engine-specific processing
export const engineSaveData = async (shard, transientData) => {
  const engine = getEngine(shard.type)
  if (!engine?.processData) {
    return
  }
  // Signature: processData(shard, data)
  // Engines use shardApi directly for file operations
  await engine.processData(shard, transientData)
}

// Cleanup engine-specific data when shard is deleted
export const engineCleanup = async (shard, allShards = []) => {
  const engine = getEngine(shard.type)
  if (!engine?.cleanup) {
    return
  }
  await engine.cleanup(shard, allShards)
}
