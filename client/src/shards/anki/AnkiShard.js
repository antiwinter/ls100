import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { deckStorage as _deckStorage } from './storage/storageManager.js'
import { parseApkgFile } from './parser/apkgParser.js'
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

    // Use browser-compatible sql.js + jszip parser
    const { collection, noteTypes, decks, notes: _notes, cards, media } = await parseApkgFile(file)

    log.debug('Parsed data:', {
      decksCount: Object.keys(decks).length,
      deckIds: Object.keys(decks),
      cardsCount: cards.length,
      cardDeckIds: [...new Set(cards.map(c => c.did))]
    })

    // Convert to our internal format
    let deckList = Object.values(decks).map(deck => {
      const deckCards = cards.filter(card => card.did === deck.id)

      return {
        id: deck.id,
        name: deck.name,
        description: deck.desc || '',
        cards: deckCards.map(card => ({
          id: card.id,
          nid: card.nid,
          question: generateCardSide(card, card.noteType, 'front'),
          answer: generateCardSide(card, card.noteType, 'back'),
          tags: card.note?.tags || [],
          due: card.due,
          interval: card.ivl,
          factor: card.factor,
          reps: card.reps,
          lapses: card.lapses,
          type: card.type,
          queue: card.queue
        })),
        noteTypes: noteTypes,
        totalCards: deckCards.length,
        newCards: deckCards.filter(c => c.type === 0).length,
        learningCards: deckCards.filter(c => c.type === 1).length,
        reviewCards: deckCards.filter(c => c.type === 2).length
      }
    })

    // Fallback: if no decks found but cards exist, create a default deck
    if (deckList.length === 0 && cards.length > 0) {
      log.info('No decks found, creating default deck with all cards')
      const defaultDeck = {
        id: 1, // Default deck ID in Anki
        name: filename.replace(/\.apkg$/i, ''), // Use filename as deck name
        description: 'Imported from .apkg file',
        cards: cards.map(card => ({
          id: card.id,
          nid: card.nid,
          question: generateCardSide(card, card.noteType, 'front'),
          answer: generateCardSide(card, card.noteType, 'back'),
          tags: card.note?.tags || [],
          due: card.due,
          interval: card.ivl,
          factor: card.factor,
          reps: card.reps,
          lapses: card.lapses,
          type: card.type,
          queue: card.queue
        })),
        noteTypes: noteTypes,
        totalCards: cards.length,
        newCards: cards.filter(c => c.type === 0).length,
        learningCards: cards.filter(c => c.type === 1).length,
        reviewCards: cards.filter(c => c.type === 2).length
      }
      deckList = [defaultDeck]
    }

    // Store media files
    for (const [filename, mediaInfo] of Object.entries(media)) {
      // Media will be stored separately in IndexedDB
      log.debug('Media file found:', filename, mediaInfo.size + ' bytes')
    }

    const result = {
      id: `deck_${Date.now()}`,
      name: filename.replace(/\.apkg$/i, ''),
      decks: deckList,
      media: media,
      collection: collection,
      importedAt: new Date().toISOString()
    }

    log.info('Successfully parsed .apkg file:', result.name, `(${deckList.length} decks, ${cards.length} cards)`)
    return result

  } catch (error) {
    log.error('Failed to parse .apkg file:', error)
    throw new Error(`Failed to parse Anki deck: ${error.message}`)
  }
}

// Generate card side content from templates
const generateCardSide = (card, noteType, side) => {
  try {
    log.debug('Generating card side:', {
      cardId: card.id,
      side,
      hasNoteType: !!noteType,
      hasNote: !!card.note,
      cardKeys: Object.keys(card),
      cardStructure: card,
      noteStructure: card.note ? Object.keys(card.note) : null,
      noteHasFlds: card.note ? !!card.note.flds : false,
      noteFlds: card.note ? card.note.flds : null
    })

    if (!card.note || !card.note.flds) {
      log.warn('Card missing note data:', {
        cardId: card.id,
        hasNote: !!card.note,
        noteKeys: card.note ? Object.keys(card.note) : null
      })
      return 'Missing note data'
    }

    const fields = card.note.flds
    log.debug('Card fields detail:', {
      cardId: card.id,
      fields: fields.map((f, i) => `Field ${i}: ${f?.substring(0, 50)}...`),
      fieldsLength: fields.length
    })

    // Based on Anki screenshots, the structure should be:
    // Field 0: Category (e.g., "2×2 PBL")
    // Field 1: Case (e.g., "Diag Adj")
    // Field 2: Algorithm (e.g., "R2 U R2 U' R2 U R2 U' R2")
    // Field 3: Image (HTML img tag)
    // Field 4: Description (e.g., "2×2 PBL case. 2 algorithm(s) available...")

    const category = fields[0] || ''
    const caseName = fields[1] || ''
    const algorithm = fields[2] || ''
    const image = fields[3] || ''
    const description = fields[4] || ''

    if (side === 'front') {
      // Front: Category + Case + Image + Question
      let frontContent = ''
      if (category) frontContent += `<div><strong>${category}</strong></div>`
      if (caseName) frontContent += `<div>${caseName}</div>`
      if (image) frontContent += `<div>${image}</div>`
      frontContent += '<div><em>What is the algorithm?</em></div>'
      return frontContent || 'No question content'
    } else {
      // Back: Category + Case + Image + Algorithm + Description
      let backContent = ''
      if (category) backContent += `<div><strong>${category}</strong></div>`
      if (caseName) backContent += `<div>${caseName}</div>`
      if (image) backContent += `<div>${image}</div>`
      if (algorithm) {
        const algorithmStyle = 'background: #f0f0f0; padding: 10px; margin: 10px 0; font-family: monospace;'
        backContent += `<div style="${algorithmStyle}">${algorithm}</div>`
      }
      if (description) {
        const descStyle = 'margin-top: 10px; font-size: 0.9em; color: #666;'
        backContent += `<div style="${descStyle}">${description}</div>`
      }
      return backContent || 'No answer content'
    }
  } catch (error) {
    log.warn('Failed to generate card side:', error)
    return `Error: ${error.message}`
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
export const processData = async (shard, _apiCall) => {
  log.debug('Anki shard processData called - updating shard with deck IDs')

  try {
    // Get available deck IDs from IndexedDB storage
    const availableDecks = _deckStorage.listDecks()
    const deckIds = Object.keys(availableDecks).map(id => parseInt(id, 10))

    log.debug('Available deck IDs for shard:', deckIds)

    // Update shard data with deck IDs so the reader can find them
    if (!shard.data) {
      shard.data = {}
    }

    shard.data.deckIds = deckIds
    shard.data.totalDecks = deckIds.length
    shard.data.totalCards = Object.values(availableDecks)
      .reduce((sum, deck) => sum + (deck.totalCards || 0), 0)

    log.info('Updated shard data:', {
      deckIds: shard.data.deckIds,
      totalDecks: shard.data.totalDecks,
      totalCards: shard.data.totalCards
    })

  } catch (error) {
    log.error('Failed to process Anki shard data:', error)
    throw new Error(`Failed to process Anki shard: ${error.message}`)
  }
}

// Engine components
export const EditorComponent = AnkiShardEditor
export const ReaderComponent = AnkiReaderComponent

log.debug('Anki shard engine initialized')
