import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { parseApkgFile, importApkgData } from './parser/apkgParser.js'
import ankiApi from './core/ankiApi'
import { log } from '../../utils/logger'
import { genId } from '../../utils/idGenerator.js'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

// Media URL replacement now handled by MediaManager in TemplateRenderer

// File detection with confidence scoring
export const detect = async (filename, buffer) => {
  log.debug('Detecting Anki file:', filename, 'size:', buffer.byteLength || buffer.length)

  // Check file extension
  const hasExt = /\.apkg$/i.test(filename)

  // For .apkg files, we can be highly confident
  const confidence = hasExt ? 0.95 : 0.0

  // Extract deck name from file content when possible; fallback to filename
  let parsedName = null
  let parsedData = null
  if (hasExt) {
    try {
      parsedData = await parseApkgFile(buffer)
      log.debug('Parsed data:', parsedData)
      parsedName = parsedData.name || null
    } catch (e) {
      log.warn('Deck name extraction failed during detect; falling back to filename:', e)
    }
  }

  const result = {
    match: hasExt,
    confidence,
    metadata: {
      type: 'anki-deck',
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



// Old generateCardSide function removed - now using TemplateEngine

// Generate cover for shard preview
export const generateCover = (shard) => {
  const noteCount = shard.data?.totalNotes || 0
  const cardCount = shard.data?.totalCards || 0

  // Prefer deckName from metadata; fallback to shard name
  const title = shard.metadata?.deckName || shard.name || 'Anki Shard'

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

// Process shard data - commit imports and update counts
export const processData = async (shard, _apiCall) => {
  // Set default data structure
  shard.data = { totalNotes: 0, totalCards: 0 }

  // For create mode: process pending imports and store deck info in metadata
  if (!shard.id) {
    log.debug('Pre-creation mode: storing deck metadata')

    // Store deck information in metadata for frontend display
    if (pendingImports.length > 0) {
      const decks = await Promise.all(pendingImports.map(async item => ({
        id: await genId('deck', item.filename + item.parsedData.name),
        name: item.parsedData.name,
        filename: item.filename,
        totalCards: item.parsedData.cards?.length || 0
      })))

      shard.metadata = { ...shard.metadata, decks }
      log.info('Stored deck metadata for create mode:', decks.length, 'decks')
    }
    return
  }

  try {
    // Commit pending imports (edit mode or post-creation)
    if (pendingImports.length > 0) {
      for (const item of pendingImports) {
        try {
          const deckId = await genId('deck', item.filename + item.parsedData.name)
          await importApkgData(item.parsedData, deckId, shard.id)
          log.info('Committed Anki import:', { deckId, name: item.parsedData.name })
        } catch (e) {
          log.error('Failed to commit pending Anki import:', e)
        }
      }
      clearQueue()

      // Clear pending metadata since we've committed the imports
      if (shard.metadata?.decks) {
        shard.metadata = { ...shard.metadata, decks: [] }
      }
    }

    // Then get updated counts from IDB
    const cards = await ankiApi.getCardsForShard(shard.id)
    const noteIds = [...new Set(cards.map(c => c.noteId))]

    shard.data = {
      totalNotes: noteIds.length,
      totalCards: cards.length
    }

    log.info('Shard data updated:', shard.data)
  } catch (error) {
    log.error('Failed to process shard data:', error)
    // Keep default fallback
  }
}

// Get pending imports from editor module scope
let pendingImports = []
export const queueImport = (parsedData, filename) => {
  pendingImports.push({ parsedData, filename })
}
export const clearQueue = () => {
  pendingImports = []
}

// Cleanup function called when shard is deleted
export const cleanup = async (shard, allShards = []) => {
  try {
    log.info('Cleaning up Anki shard:', shard.id)

    // Remove all notes and cards for this shard
    await ankiApi.cleanupShard(shard.id)

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
