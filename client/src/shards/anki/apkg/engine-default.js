import { log } from '../../../utils/logger'

// Default engine for Anki versions 2 and 21 (JSON-based format)

export const name = 'default'

// Check if this engine is compatible with the package
export const compatible = (zipData) => {
  return zipData.files['collection.anki21'] || zipData.files['collection.anki2']
}

// Get the collection file from the package
export const getCollectionFile = (zipData) => {
  // When multiple collection files exist, prefer the one with more data (usually anki2)
  const files = []
  if (zipData.files['collection.anki21']) files.push({ name: 'collection.anki21', file: zipData.files['collection.anki21'] })
  if (zipData.files['collection.anki2']) files.push({ name: 'collection.anki2', file: zipData.files['collection.anki2'] })

  if (files.length === 0) return null

  // If only one file, use it
  if (files.length === 1) return files[0].file

  // If multiple files, log and prefer anki2 for better compatibility
  log.debug('Multiple collection files found, preferring collection.anki2 for default engine')
  return zipData.files['collection.anki2'] || files[0].file
}

// Process database buffer (no processing needed for legacy formats)
export const processDbBuffer = (buffer) => buffer

// Parse notetypes from col.models JSON
export const parseNotetypes = (db) => {
  try {
    // Parse models from col table
    // Note: Using explicit field selection because SELECT * sometimes doesn't
    // return all fields properly
    const modelsStmt = db.prepare('SELECT models FROM col')
    modelsStmt.step()
    const modelsRow = modelsStmt.getAsObject()
    modelsStmt.free()

    if (modelsRow.models) {
      try {
        const models = JSON.parse(modelsRow.models)
        log.debug(`Default engine - parsed ${Object.keys(models).length} models from col.models`)
        return models
      } catch (error) {
        log.error(`Default engine - JSON parse error: ${error.message}`)
        throw new Error(`Invalid APKG: Failed to parse models JSON - ${error.message}`)
      }
    } else {
      log.error('Default engine - no models data found in col table')
      throw new Error('Invalid APKG: No models data found in collection')
    }
  } catch (error) {
    log.error('Default engine - failed to parse notetypes:', error.message)
    throw new Error(`Invalid APKG: Failed to parse notetypes - ${error.message}`)
  }
}

// Parse media files from media mapping JSON
export const parseMedia = async (zipData) => {
  try {
    const mediaFile = zipData.files['media']
    if (!mediaFile) return {}

    const mediaText = await mediaFile.async('text')
    const mediaMapping = JSON.parse(mediaText || '{}')

    // Create media blobs: descriptive filename -> blob data
    const media = {}
    for (const [key, filename] of Object.entries(mediaMapping)) {
      const file = zipData.files[key]
      if (file) {
        const blob = await file.async('arraybuffer')
        media[filename] = blob
      }
    }

    return media
  } catch (error) {
    log.warn('Default engine - failed to parse media file:', error.message)
    // Media parsing failure is not critical - return empty object
    return {}
  }
}

// Parse decks from col.decks JSON
export const parseDecks = (db) => {
  try {
    const stmt = db.prepare('SELECT decks FROM col')
    while (stmt.step()) {
      const row = stmt.getAsObject()
      if (row.decks) {
        const decks = JSON.parse(row.decks)
        log.debug(`Default engine parsed ${Object.keys(decks).length} decks from col.decks`)
        return decks
      }
    }
    stmt.free()
    log.warn('No decks data found in database')
    return {}
  } catch (error) {
    log.warn('Failed to parse decks:', error.message)
    return {}
  }
}

// Parse review history from revlog table
export const parseReviewHistory = (db) => {
  try {
    // Check if revlog table exists
    const tablesStmt = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'revlog\'')
    if (!tablesStmt.step()) {
      log.debug('Default engine - no revlog table found')
      return {}
    }
    tablesStmt.free()

    const stmt = db.prepare('SELECT * FROM revlog ORDER BY id')
    const reviewsByCard = {}

    while (stmt.step()) {
      const row = stmt.getAsObject()
      const cardId = row.cid

      if (!reviewsByCard[cardId]) {
        reviewsByCard[cardId] = []
      }

      // Convert Anki review to FSRS-compatible format
      reviewsByCard[cardId].push({
        rating: row.ease, // Anki rating (1-4)
        response_time: row.time || 0, // Review time in milliseconds
        due: row.id + (row.ivl || 0) * 24 * 60 * 60 * 1000, // Calculate due time
        stability: Math.max(row.ivl || 0, 0.1), // Use interval as stability approximation
        difficulty: Math.max(0.1, Math.min(10,
          (4000 - (row.factor || 2500)) / 200)), // Convert ease to difficulty
        elapsed_days: row.lastIvl || 0, // Previous interval
        scheduled_days: row.ivl || 0, // Current interval
        reps: 1, // Each entry is one review
        lapses: row.type === 0 ? 1 : 0, // Type 0 is learn/relearn
        state: row.type === 0 ? 'Learning' :
          row.type === 1 ? 'Review' :
            row.type === 2 ? 'Relearn' : 'New',
        last_review: new Date(row.id).toISOString()
      })
    }

    stmt.free()
    log.debug(`Default engine - parsed review history for ${Object.keys(reviewsByCard).length} cards`)
    return reviewsByCard
  } catch (error) {
    log.warn('Default engine - failed to parse review history:', error.message)
    return {}
  }
}
