import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { deckStorage as _deckStorage } from './storage/storageManager.js'
import { parseApkgFile } from './parser/apkgParser.js'
import { parseTemplate } from './parser/templateParser.js'
import { log } from '../../utils/logger'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

// Replace image src references with data URLs for browser access
const replaceMediaUrls = (html, media) => {
  if (!html || !media || Object.keys(media).length === 0) {
    return html
  }

  let result = html
  // Replace img src attributes with data URLs
  for (const [filename, mediaData] of Object.entries(media)) {
    if (mediaData.dataUrl) {
      // Replace both quoted and unquoted src references
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
          question: replaceMediaUrls(generateCardSide(card, card.noteType, 'front'), media),
          answer: replaceMediaUrls(generateCardSide(card, card.noteType, 'back'), media),
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
          question: replaceMediaUrls(generateCardSide(card, card.noteType, 'front'), media),
          answer: replaceMediaUrls(generateCardSide(card, card.noteType, 'back'), media),
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

// Generate card side content using Anki templates
const generateCardSide = (card, noteType, side) => {
  try {
    if (!card.note || !card.note.flds) {
      log.warn('Card missing note or fields:', {
        cardId: card.id,
        hasNote: !!card.note,
        hasFlds: card.note ? !!card.note.flds : false
      })
      return 'Missing card data'
    }

    // Fallback: if no noteType, create a basic template based on field count
    if (!noteType) {
      log.debug('No noteType found, creating fallback template for card:', card.id)

      const fieldCount = card.note.flds.length
      const fields = card.note.flds
      // Simple fallback logic based on field count and content
      if (side === 'front') {
        // For front: show first field, or combine first few fields if they're short
        if (fieldCount >= 2) {
          const field1 = fields[0] || ''
          const field2 = fields[1] || ''
          // If both fields are short, combine them
          if (field1.length < 50 && field2.length < 50) {
            return `<div><strong>${field1}</strong></div><div>${field2}</div>`
          }
        }
        return fields[0] || 'No question'
      } else {
        // For back: show remaining fields
        if (fieldCount >= 3) {
          return fields.slice(2).filter(f => f.trim()).map(f => `<div>${f}</div>`).join('')
        } else if (fieldCount >= 2) {
          return fields[1] || fields[0] || 'No answer'
        }
        return fields[0] || 'No answer'
      }
    }

    // Get the template for this card (card.ord is the template index)
    const cardTemplates = noteType.tmpls || []
    const template = cardTemplates[card.ord] || cardTemplates[0]

    if (!template) {
      log.warn('No template found for card:', {
        cardId: card.id,
        cardOrd: card.ord,
        availableTemplates: cardTemplates.length
      })
      return 'No template available'
    }

    // Build field map from note type field definitions and note field values
    const noteTypeFields = noteType.flds || []
    const noteFieldValues = card.note.flds || []

    const fieldMap = {}
    noteTypeFields.forEach((fieldDef, index) => {
      const fieldName = fieldDef.name
      const fieldValue = noteFieldValues[index] || ''
      fieldMap[fieldName] = fieldValue
    })

    // Use the appropriate template format
    const templateFormat = side === 'front' ? template.qfmt : template.afmt

    // For back side, we might need the front side content
    let frontSideContent = undefined
    if (side === 'back' && template.afmt && template.afmt.includes('{{FrontSide}}')) {
      // Recursively generate front side for {{FrontSide}} substitution
      frontSideContent = generateCardSide(card, noteType, 'front')
    }

    const result = parseTemplate(templateFormat, fieldMap, {
      mode: side === 'front' ? 'question' : 'answer',
      frontSide: frontSideContent
    })

    return result || `No ${side} content`
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

// Process shard data - update deck counts
export const processData = async (shard, _apiCall) => {
  if (!shard.id) {
    log.debug('Pre-creation, skipping deck count')
    shard.data = { totalDecks: 0, totalCards: 0 }
    return
  }

  try {
    const decks = _deckStorage.listDecksByShardId(shard.id)
    const totalCards = Object.values(decks).reduce((sum, deck) => sum + (deck.totalCards || 0), 0)

    shard.data = {
      totalDecks: Object.keys(decks).length,
      totalCards
    }

    log.info('Shard data updated:', shard.data)
  } catch (error) {
    log.error('Failed to process shard data:', error)
    throw error
  }
}

// Cleanup function called when shard is deleted
export const cleanup = async (shard, allShards = []) => {
  try {
    log.info('Cleaning up Anki shard:', shard.id)

    // Clean up this shard's data
    await _deckStorage.cleanupShard(shard.id)

    // Only run orphan cleanup if this is the last shard being deleted
    // (avoid false positives during batch deletions)
    const remainingAnkiShards = allShards.filter(s => s.type === 'anki' && s.id !== shard.id)

    if (remainingAnkiShards.length === 0) {
      // No more Anki shards - clean up any truly orphaned data
      log.info('Last Anki shard deleted, checking for orphaned data')
      const orphansRemoved = await _deckStorage.cleanupOrphans([])
      if (orphansRemoved > 0) {
        log.info('Orphan cleanup:', { orphansRemoved })
      }
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
