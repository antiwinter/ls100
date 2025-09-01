import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { parseApkgFile, importApkgData } from './parser/apkgParser.js'
import ankiApi from './core/ankiApi'
import { log } from '../../utils/logger'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

// Media URL replacement - simplified for new architecture  
const replaceMediaUrls = (html, media) => {
  if (!html || !media || Object.keys(media).length === 0) {
    return html
  }

  let result = html
  for (const [filename, mediaData] of Object.entries(media)) {
    if (mediaData.dataUrl) {
      const patterns = [
        new RegExp(`src=["']${filename}["']`, 'gi'),
        new RegExp(`src=${filename}`, 'gi')
      ]
      for (const pattern of patterns) {
        result = result.replace(pattern, `src="${mediaData.dataUrl}"`)
      }
    }
  }
  return result
}

// File detection with confidence scoring
export const detect = (filename, buffer) => {
  log.debug('Detecting Anki file:', filename, 'size:', buffer.byteLength || buffer.length)

  // Check file extension
  const hasExt = /\.apkg$/i.test(filename)

  // For .apkg files, we can be highly confident
  const confidence = hasExt ? 0.95 : 0.0

  // Extract deck name from filename
  const suggestedName = filename.replace(/\.apkg$/i, '').replace(/[-_.]/g, ' ').trim()

  const result = {
    match: hasExt,
    confidence,
    metadata: {
      type: 'anki-deck',
      suggestedName: suggestedName || 'Anki Deck',
      // Store file for later processing
      file: buffer
    }
  }

  log.debug('Anki detection result:', { match: result.match, confidence, suggestedName })
  return result
}

// Parse .apkg file and import to new note+template structure
export const parseAnkiFile = async (file, filename, deckId, shardId) => {
  try {
    log.info('Parsing .apkg file:', filename)

    // Parse the .apkg file
    const parsedData = await parseApkgFile(file)
    
    // Import using new note+template structure
    const importStats = await importApkgData(parsedData, deckId, shardId)
    
    const result = {
      id: deckId,
      name: filename.replace(/\.apkg$/i, ''),
      stats: importStats,
      importedAt: new Date().toISOString()
    }

    log.info(`✅ Successfully imported .apkg file: ${result.name}`)
    log.info(`   📊 ${importStats.noteTypes} note types, ${importStats.notes} notes, ${importStats.cards} cards`)
    
    return result

  } catch (error) {
    log.error('Failed to parse .apkg file:', error)
    throw new Error(`Failed to import Anki deck: ${error.message}`)
  }
}

// Old generateCardSide function removed - now using TemplateEngine

// Generate cover for shard preview
export const generateCover = (shard) => {
  const noteCount = shard.data?.totalNotes || 0
  const cardCount = shard.data?.totalCards || 0

  // Use shard name
  const title = shard.name || 'Anki Shard'

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

// Process shard data - update counts using new architecture
export const processData = async (shard, _apiCall) => {
  if (!shard.id) {
    log.debug('Pre-creation, skipping data processing')
    shard.data = { totalNotes: 0, totalCards: 0 }
    return
  }

  try {
    // Get cards for this shard using new API
    const cards = await ankiApi.getCardsForShard(shard.id)
    const noteIds = [...new Set(cards.map(c => c.noteId))]

    shard.data = {
      totalNotes: noteIds.length,
      totalCards: cards.length
    }

    log.info('Shard data updated:', shard.data)
  } catch (error) {
    log.error('Failed to process shard data:', error)
    // Fallback to default
    shard.data = { totalNotes: 0, totalCards: 0 }
  }
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
