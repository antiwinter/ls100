import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { parseApkgFile, importApkgData } from './apkg/index.js'
import anki from './core/index.js'
import { log } from '../../utils/logger'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

// File detection with confidence scoring
export const detect = async (filename, buffer) => {
  log.debug('Detecting Anki file:', filename, 'size:', buffer.byteLength || buffer.length)

  // Check file extension
  const hasExt = /\.apkg$/i.test(filename)

  // For .apkg files, we can be highly confident
  const confidence = hasExt ? 0.95 : 0.0

  // Extract bundle name from file content when possible; fallback to filename
  let parsedName = null
  let parsedData = null
  if (hasExt) {
    try {
      parsedData = await parseApkgFile(buffer)
      log.debug('Parsed data:', parsedData)
      parsedName = parsedData.name || null
    } catch (e) {
      log.warn('Bundle name extraction failed during detect; falling back to filename:', e)
    }
  }

  const result = {
    match: hasExt,
    confidence,
    metadata: {
      type: 'anki-bundle',
      suggestedName: parsedName || filename.replace(/\.apkg$/i, '').replace(/[-_.]/g, ' ').trim(),
      // Store file for later processing
      file: buffer,
      // Store parsed data to avoid re-parsing in editor
      parsedData: parsedData
    }
  }

  log.debug('Anki detection result:', { match: result.match, confidence, parsedName })
  return result
}



// Old generateSide function removed - now using TemplateEngine

// Generate cover for shard preview
export const generateCover = (shard) => {
  // Handle case where metadata might not exist yet
  const metadata = shard.metadata || {}
  const noteCount = metadata.totalNotes || 0
  const cardCount = metadata.totalCards || 0

  // Determine title with multiple fallbacks
  let title = metadata.bundleName || shard.name || 'Anki Shard'

  // If no bundleName but we have bundles in metadata (create mode), use first bundle name
  if (!metadata.bundleName && metadata.bundles?.length > 0) {
    title = metadata.bundles[0].name
    // Also update the hash source to use the bundle name for consistent colors
  }

  // Create a hash for consistent color selection
  let hash = 0
  const str = title
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash = hash & hash
  }

  // Anki-themed gradients
  const gradients = [
    'linear-gradient(135deg, #3f51b5 0%, #1a237e 100%)', // Anki blue
    'linear-gradient(135deg, #2196f3 0%, #0d47a1 100%)', // Blue
    'linear-gradient(135deg, #009688 0%, #004d40 100%)', // Teal
    'linear-gradient(135deg, #4caf50 0%, #1b5e20 100%)', // Green
    'linear-gradient(135deg, #ff9800 0%, #e65100 100%)'  // Orange
  ]

  const gradient = gradients[Math.abs(hash) % gradients.length]

  return {
    type: 'text',
    title,
    style: 'anki-card',
    background: gradient,
    textColor: '#ffffff',
    subtitle: noteCount > 0
      ? `${noteCount} notes • ${cardCount} cards`
      : 'No content yet',
    icon: '🧠' // Brain emoji for learning
  }
}

// Shard type metadata
export const shardTypeInfo = {
  name: 'anki',
  displayName: 'Anki Shard',
  color: '#3f51b5' // Anki blue
}

// Process shard data - commit bundle imports and update counts
export const processData = async (shard, _apiCall) => {
  try {
    // Process bundles stored in shard.data.bundles
    if (shard.data?.bundles?.length > 0) {
      let bundleName = null
      const bundleIds = []

      for (const bundle of shard.data.bundles) {
        try {
          // Import parsed APKG data; use returned bundleIds actually created by import
          const result = await importApkgData(bundle)

          // Store the first bundle name for consistent cover colors
          if (!bundleName) {
            bundleName = bundle.name
          }

          // Collect returned bundleIds for metadata
          if (Array.isArray(result?.bundleIds)) {
            bundleIds.push(...result.bundleIds)
          }

          log.info('Committed Anki import:', { bundleIds: result?.bundleIds, name: bundle.name })
        } catch (e) {
          log.error('Failed to commit Anki import:', e)
        }
      }

      // Store bundle info in metadata for lookup
      shard.metadata = {
        ...shard.metadata,
        bundleName,
        bundleIds
      }
    }

    // Get updated counts from IDB using bundleIds
    if (shard.metadata?.bundleIds?.length > 0) {
      const cards = await anki.getCardsForBundles(shard.metadata.bundleIds)
      const noteIds = [...new Set(cards.map(c => c.noteId))]

      // Store persistent counts in metadata
      shard.metadata = {
        ...shard.metadata,
        totalNotes: noteIds.length,
        totalCards: cards.length
      }

      log.info('Shard metadata updated:', { totalNotes: noteIds.length, totalCards: cards.length })
    }

    // Clear data to save bandwidth - backend doesn't need it
    shard.data = {}

  } catch (error) {
    log.error('Failed to process shard data:', error)
    // Keep default fallback
    shard.data = {}
  }
}

// Pending imports system removed - data now stored directly in shardData

// Cleanup function called when shard is deleted
export const cleanup = async (shard, allShards = []) => {
  try {
    log.info('Cleaning up Anki shard:', shard.id)

    // Remove all notes and cards for this shard's bundles
    if (shard.metadata?.bundleIds?.length > 0) {
      await anki.removeBundles(shard.metadata.bundleIds)
    }

    // Check for remaining Anki shards for potential orphan cleanup
    const remainingAnkiShards = allShards.filter(s => s.type === 'anki' && s.id !== shard.id)

    if (remainingAnkiShards.length === 0) {
      log.info('Last Anki shard deleted - deep cleanup could be performed here if needed')
    }

    log.info('Anki shard cleanup completed:', shard.id)
  } catch (error) {
    log.error('Failed to cleanup Anki shard:', error)
  }
}

// Engine components
export const EditorComponent = AnkiShardEditor
export const ReaderComponent = AnkiReaderComponent

log.debug('Anki shard engine initialized')
