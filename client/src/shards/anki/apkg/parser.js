import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import * as engine21b from './engine-21b.js'
import { log } from '../../../utils/logger'

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

// Parse collection metadata (shared across versions)
const parseCollection = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    const config = JSON.parse(row.conf || '{}')
    const models = JSON.parse(row.models || '{}')
    const decks = JSON.parse(row.decks || '{}')

    return {
      id: row.id,
      crt: row.crt,
      mod: row.mod,
      scm: row.scm,
      ver: row.ver,
      dty: row.dty,
      usn: row.usn,
      ls: row.ls,
      config,
      models,
      decks,
      tags: row.tags
    }
  } catch (error) {
    log.warn('Failed to parse collection:', error.message)
    return {}
  }
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

// Detect version and select appropriate engine
const selectEngine = (zipData) => {
  // Check for modern format first
  if (zipData.files['collection.anki21b']) {
    log.debug('Detected modern Anki format (21b)')
    return engine21b
  }

  // For now, use 21b engine as fallback (handles legacy formats too)
  log.debug('Using 21b engine for legacy format')
  return engine21b
}

// Main parsing function
export const parseApkgFile = async (file) => {
  try {
    log.debug('Starting .apkg parsing')

    await initSQL()

    // Parse ZIP
    const zip = new JSZip()
    const zipData = await zip.loadAsync(file)

    // Select appropriate engine
    const engine = selectEngine(zipData)

    // Extract database
    const dbFile = engine.getDbFile(zipData)
    if (!dbFile) {
      throw new Error('No collection database found in .apkg file')
    }

    const dbBuffer = await dbFile.async('uint8array')
    const processedBuffer = await engine.processDbBuffer(dbBuffer)

    // Initialize database
    const db = new SQL.Database(processedBuffer)

    // Parse using engine + shared functions
    const collection = parseCollection(db)

    // Use engine for version-specific parsing
    const bundles = collection.models && Object.keys(collection.models).length > 0
      ? collection.models : engine.parseNotetypes(db)

    const decks = parseDecks(db)
    const notes = parseNotes(db)
    const cards = parseCards(db, notes, bundles)
    const media = await engine.parseMedia(zipData)

    db.close()

    // Determine deck name
    const deckNames = Object.values(decks || {})
      .filter(d => d.name && d.name !== 'Default')
      .map(d => d.name)

    const deckName = deckNames.length > 0 ? deckNames[0] : 'Imported Deck'

    log.debug(`Parsing complete: { decks: ${Object.keys(decks).length}, notes: ${notes.length}, cards: ${cards.length}, media: ${Object.keys(media).length} }`)

    return {
      collection,
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
