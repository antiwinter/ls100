import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import * as engine21b from './engine-21b.js'
import { log } from '../../../utils/logger'

// Import all engines
const engines = [
  engine21b
  // Future engines will be added here
]

// Default engine for versions 2 and 21 (JSON-based)
const defaultEngine = {
  name: 'default',

  compatible: (zipData) => {
    return zipData.files['collection.anki21'] || zipData.files['collection.anki2']
  },

  getCollectionFile: (zipData) => {
    if (zipData.files['collection.anki21']) return zipData.files['collection.anki21']
    if (zipData.files['collection.anki2']) return zipData.files['collection.anki2']
    return null
  },

  processDbBuffer: (buffer) => buffer, // no processing needed

  parseNotetypes: (db) => {
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
          log.debug(`Default engine - JSON parse error: ${error.message}`)
          return {}
        }
      } else {
        log.debug('Default engine - no models data found in col table')
        return {}
      }
    } catch (error) {
      log.debug('Default engine - failed to parse notetypes:', error.message)
      return {}
    }
  },

  parseMedia: async (zipData) => {
    try {
      const mediaFile = zipData.files['media']
      if (!mediaFile) return {}

      const mediaText = await mediaFile.async('text')
      return JSON.parse(mediaText || '{}')
    } catch (error) {
      log.warn('Default engine - failed to parse media file:', error.message)
      return {}
    }
  }
}

// Browser-compatible .apkg parser using sql.js + jszip
// Supports multiple Anki versions with engine-based architecture

let SQL = null

const initSQL = async () => {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    })
  }
  return SQL
}


// Parse decks (shared across versions)
const parseDecks = (db) => {
  try {
    const stmt = db.prepare('SELECT decks FROM col LIMIT 1')
    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()

      const decksJson = row.decks
      if (decksJson && typeof decksJson === 'string') {
        return JSON.parse(decksJson)
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

// Parse notes (shared across versions)
const parseNotes = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM notes')
    const notes = []

    while (stmt.step()) {
      const row = stmt.getAsObject()
      notes.push({
        id: row.id,
        guid: row.guid,
        mid: row.mid, // model id
        mod: row.mod, // modification time
        usn: row.usn, // update sequence number
        tags: row.tags,
        flds: row.flds.split('\x1f'), // fields separated by \x1f
        sfld: row.sfld, // sort field
        csum: row.csum, // checksum
        flags: row.flags,
        data: row.data
      })
    }

    stmt.free()
    log.debug(`Parsed ${notes.length} notes`)
    return notes
  } catch (error) {
    log.warn('Failed to parse notes:', error.message)
    return []
  }
}

// Parse cards (shared across versions)
const parseCards = (db, notes, bundles) => {
  try {
    const stmt = db.prepare('SELECT * FROM cards')
    const cards = []

    // Create lookup maps
    const noteMap = new Map(notes.map(note => [note.id, note]))

    while (stmt.step()) {
      const row = stmt.getAsObject()
      const note = noteMap.get(row.nid)
      const bundle = note ? bundles[note.mid] : null

      if (note && bundle) {
        cards.push({
          id: row.id,
          nid: row.nid, // note id
          did: row.did, // deck id
          ord: row.ord, // template ordinal
          mod: row.mod, // modification time
          usn: row.usn,
          type: row.type, // 0=new, 1=learning, 2=due
          queue: row.queue, // queue status
          due: row.due, // due date
          ivl: row.ivl, // interval
          factor: row.factor, // ease factor
          reps: row.reps,
          lapses: row.lapses,
          left: row.left,
          odue: row.odue,
          odid: row.odid,
          flags: row.flags,
          data: row.data,
          note: note,
          bundle: bundle
        })
      }
    }

    stmt.free()
    log.debug(`Parsed ${cards.length} cards`)
    return cards
  } catch (error) {
    log.warn('Failed to parse cards:', error.message)
    return []
  }
}

// Find compatible engine for the given zipData
const selectEngine = (zipData) => {
  const files = Object.keys(zipData.files)
  const collectionFiles = files.filter(f => f.startsWith('collection.'))
  log.debug(`Collection files found: ${collectionFiles.join(', ')}`)

  // Try specialized engines first
  for (const engine of engines) {
    if (engine.compatible && engine.compatible(zipData)) {
      return engine
    }
  }

  // Fall back to default engine
  if (defaultEngine.compatible(zipData)) {
    return defaultEngine
  }

  throw new Error('No compatible engine found for this Anki package')
}

// Main parsing function
export const parseApkgFile = async (file) => {
  try {
    log.debug('Starting .apkg parsing')

    await initSQL()

    // Parse ZIP
    const zip = new JSZip()
    const zipData = await zip.loadAsync(file)

    // Select compatible engine
    const engine = selectEngine(zipData)
    log.debug(`Selected engine: ${engine.name}`)

    // Extract and process database
    const dbFile = engine.getCollectionFile(zipData)
    if (!dbFile) {
      throw new Error('No collection database found in .apkg file')
    }

    const dbBuffer = await dbFile.async('uint8array')
    const processedBuffer = await engine.processDbBuffer(dbBuffer)

    // Initialize database
    const db = new SQL.Database(processedBuffer)

    // Parse shared data - only what's truly shared
    const decks = parseDecks(db)
    const notes = parseNotes(db)

    // Engine-specific parsing - clean interface
    const bundles = engine.parseNotetypes(db)
    const media = await engine.parseMedia(zipData)
    const cards = parseCards(db, notes, bundles)

    db.close()

    // Determine deck name
    const deckNames = Object.values(decks || {})
      .filter(d => d.name && d.name !== 'Default')
      .map(d => d.name)

    const deckName = deckNames.length > 0 ? deckNames[0] : 'Imported Deck'

    log.debug(`Parsing complete: { decks: ${Object.keys(decks).length}, notes: ${notes.length}, cards: ${cards.length}, media: ${Object.keys(media).length} }`)

    return {
      bundles,
      decks,
      notes,
      cards,
      media,
      deckName
    }
  } catch (error) {
    log.error('Failed to parse .apkg file:', error.message)
    throw new Error(`Failed to parse Anki deck: ${error.message}`)
  }
}
