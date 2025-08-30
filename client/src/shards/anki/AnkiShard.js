// import { readAnkiPackage } from 'anki-reader' // Temporarily disabled due to browser compatibility
import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { deckStorage as _deckStorage } from './storage/storageManager.js'
import { log } from '../../utils/logger'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

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

// Parse .apkg file and extract deck data
export const parseAnkiFile = async (file, filename) => {
  try {
    log.info('Parsing .apkg file:', filename)

    // Temporary fallback - anki-reader disabled due to browser compatibility issues
    throw new Error('Anki file parsing is temporarily disabled due to browser compatibility issues. Please check the console for updates on when this will be fixed.')
  } catch (error) {
    log.error('Failed to parse .apkg file:', error)
    throw new Error(`Failed to parse Anki deck: ${error.message}`)
  }
}

// Generate cover for shard preview
export const generateCover = (shard) => {
  const deckCount = shard.data?.decks?.length || 1
  const totalCards = shard.data?.decks?.reduce((sum, deck) => sum + (deck.totalCards || 0), 0) || 0

  // Use shard name or first deck name
  const title = shard.name || shard.data?.decks?.[0]?.name || 'Anki Deck'

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
    subtitle: deckCount > 1
      ? `${deckCount} decks • ${totalCards} cards`
      : `${totalCards} cards`,
    icon: '🧠' // Brain emoji for learning
  }
}

// Shard type metadata
export const shardTypeInfo = {
  name: 'anki',
  displayName: 'Anki Shard',
  color: '#3f51b5' // Anki blue
}

// Process shard data (no-op for frontend-only storage)
export const processData = async (_shard, _apiCall) => {
  // Since we're using frontend-only storage, we don't process data on backend
  // All .apkg parsing and storage happens in the browser
  log.debug('Anki shard processData called - using frontend storage')

  // The shard data is already processed and stored in browser storage
  // via the AnkiShardEditor component, so no backend processing needed
}

// Engine components
export const EditorComponent = AnkiShardEditor
export const ReaderComponent = AnkiReaderComponent

log.debug('Anki shard engine initialized')
