import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { log } from '../../../utils/logger'

// Browser-compatible .apkg parser using sql.js + jszip
// Replaces anki-reader for better browser compatibility

let SQL = null

const initSQL = async () => {
  if (!SQL) {
    // Initialize sql.js with WASM file
    SQL = await initSqlJs({
      // Use CDN for WASM file to avoid bundling issues
      locateFile: file => `https://sql.js.org/dist/${file}`
    })
  }
  return SQL
}

// Parse .apkg file (ZIP containing SQLite database + media)
export const parseApkgFile = async (file) => {
  try {
    log.debug('Starting .apkg parsing with sql.js + jszip')

    // Initialize SQL.js
    await initSQL()

    // Parse ZIP file
    const zip = new JSZip()
    const zipData = await zip.loadAsync(file)

    log.debug('ZIP contents:', Object.keys(zipData.files))

    // Extract collection.anki2 (SQLite database)
    const dbFile = zipData.files['collection.anki2']
    if (!dbFile) {
      throw new Error('collection.anki2 not found in .apkg file')
    }

    const dbBuffer = await dbFile.async('uint8array')
    const db = new SQL.Database(dbBuffer)

    log.debug('SQLite database loaded successfully')

    // Debug: Check what tables exist in the database
    const tablesStmt = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\'')
    const tables = []
    while (tablesStmt.step()) {
      tables.push(tablesStmt.getAsObject())
    }
    tablesStmt.free()

    log.debug('Available SQLite tables:', {
      tables: tables.map(t => t.name),
      totalTables: tables.length
    })

    // Debug: Check if there's a separate models table
    if (tables.some(t => t.name === 'models')) {
      const modelsTableStmt = db.prepare('SELECT * FROM models LIMIT 5')
      const modelsTableData = []
      while (modelsTableStmt.step()) {
        modelsTableData.push(modelsTableStmt.getAsObject())
      }
      modelsTableStmt.free()
      log.debug('Found separate models table:', modelsTableData)
    }

    // Debug: Check all columns and sample data from col table
    const colSampleStmt = db.prepare('SELECT * FROM col LIMIT 1')
    const colSample = colSampleStmt.step() ? colSampleStmt.getAsObject() : null
    colSampleStmt.free()

    if (colSample) {
      log.debug('Col table sample data:', {
        allColumns: Object.keys(colSample),
        modelsFieldType: typeof colSample.models,
        modelsFieldValue: colSample.models,
        confFieldType: typeof colSample.conf,
        confFieldExists: !!colSample.conf
      })
    }

    // Parse collection info
    const collection = parseCollection(db)

    // TEMPORARY FIX: Use the models data we already extracted
    log.debug('Using models data from colSample for noteTypes')
    const noteTypes = colSample && colSample.models
      ? JSON.parse(colSample.models)
      : parseNoteTypes(db)

    // Parse decks
    const decks = parseDecks(db)

    // Parse notes and cards
    const notes = parseNotes(db)
    const cards = parseCards(db, notes, noteTypes)

    // Extract media files
    const media = await parseMedia(zipData)

    db.close()

    const result = {
      collection,
      noteTypes,
      decks,
      notes,
      cards,
      media
    }

    log.debug('Parsing complete:', {
      decks: Object.keys(decks).length,
      notes: notes.length,
      cards: cards.length,
      media: Object.keys(media).length
    })

    return result

  } catch (error) {
    log.error('Failed to parse .apkg file:', error)
    throw new Error(`Failed to parse Anki deck: ${error.message}`)
  }
}

// Parse collection metadata
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
      crt: row.crt, // creation time
      mod: row.mod, // last modified
      scm: row.scm, // schema modification time
      ver: row.ver, // version
      dty: row.dty, // dirty (needs sync)
      usn: row.usn, // update sequence number
      ls: row.ls, // last sync
      conf: config,
      models: models,
      decks: decks,
      dconf: JSON.parse(row.dconf || '{}'),
      tags: JSON.parse(row.tags || '{}')
    }
  } catch (error) {
    log.warn('Failed to parse collection:', error)
    return {}
  }
}

// Parse note types (templates)
const parseNoteTypes = (db) => {
  try {
    log.debug('parseNoteTypes: Starting to parse note types')

    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    log.debug('parseNoteTypes - Raw row data:', {
      availableColumns: Object.keys(row),
      hasModels: !!row.models,
      modelsType: typeof row.models,
      modelsLength: row.models ? row.models.length : 0,
      modelsPreview: row.models ? row.models.substring(0, 200) : null,
      rawModelsValue: row.models
    })

    if (!row.models) {
      log.warn('parseNoteTypes: No models field in database row')
      return {}
    }

    let models
    try {
      models = JSON.parse(row.models)
      log.debug('parseNoteTypes - JSON parsing successful:', {
        modelCount: Object.keys(models).length,
        modelIds: Object.keys(models),
        sampleModel: Object.keys(models).length > 0 ? {
          id: Object.keys(models)[0],
          name: Object.values(models)[0]?.name,
          fieldCount: Object.values(models)[0]?.flds?.length,
          templateCount: Object.values(models)[0]?.tmpls?.length
        } : null
      })
    } catch (jsonError) {
      log.error('parseNoteTypes: JSON parsing failed:', {
        error: jsonError.message,
        modelsString: row.models?.substring(0, 500)
      })
      return {}
    }

    return models
  } catch (error) {
    log.warn('parseNoteTypes: Failed to parse note types:', error)
    return {}
  }
}

// Parse decks
const parseDecks = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    const decks = JSON.parse(row.decks || '{}')
    return decks
  } catch (error) {
    log.warn('Failed to parse decks:', error)
    return {}
  }
}

// Parse notes
const parseNotes = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM notes')
    const notes = []

    while (stmt.step()) {
      const row = stmt.getAsObject()
      notes.push({
        id: row.id,
        guid: row.guid,
        mid: row.mid, // model id (note type)
        mod: row.mod, // modification time
        usn: row.usn, // update sequence number
        tags: row.tags.split(' ').filter(t => t.trim()),
        flds: row.flds.split('\x1f'), // field separator
        sfld: row.sfld, // sort field
        csum: row.csum, // checksum
        flags: row.flags,
        data: row.data
      })
    }

    stmt.free()
    return notes
  } catch (error) {
    log.warn('Failed to parse notes:', error)
    return []
  }
}

// Parse cards
const parseCards = (db, notes, noteTypes) => {
  try {
    const stmt = db.prepare('SELECT * FROM cards')
    const cards = []
    const noteMap = new Map(notes.map(n => [n.id, n]))

    while (stmt.step()) {
      const row = stmt.getAsObject()
      const note = noteMap.get(row.nid)

      if (note) {
        const noteType = noteTypes[note.mid]

        // Debug noteType lookup
        if (!noteType) {
          const hasNoteTypes = Object.keys(noteTypes).length > 0
          const firstNoteType = hasNoteTypes ? Object.values(noteTypes)[0] : null
          log.debug('NoteType lookup failed:', {
            noteMid: note.mid,
            noteTypesKeys: Object.keys(noteTypes),
            noteTypesStructure: firstNoteType ? Object.keys(firstNoteType) : []
          })
        }

        cards.push({
          id: row.id,
          nid: row.nid, // note id
          did: row.did, // deck id
          ord: row.ord, // card template ordinal
          mod: row.mod, // modification time
          usn: row.usn, // update sequence number
          type: row.type, // 0=new, 1=learning, 2=review, 3=relearning
          queue: row.queue, // -3=user buried, -2=sched buried, -1=suspended,
          // 0=new, 1=learning, 2=review
          due: row.due, // due date
          ivl: row.ivl, // interval
          factor: row.factor, // ease factor
          reps: row.reps, // repetitions
          lapses: row.lapses, // lapses
          left: row.left, // learning steps left
          odue: row.odue, // original due (for filtered decks)
          odid: row.odid, // original deck id
          flags: row.flags,
          data: row.data,
          // Additional computed fields
          note: note,
          noteType: noteType
        })
      }
    }

    stmt.free()
    return cards
  } catch (error) {
    log.warn('Failed to parse cards:', error)
    return []
  }
}

// Parse media files
const parseMedia = async (zipData) => {
  try {
    const media = {}

    // Check for media.json (file mapping)
    let mediaMap = {}
    const mediaFile = zipData.files['media']
    if (mediaFile) {
      const mediaText = await mediaFile.async('text')
      mediaMap = JSON.parse(mediaText || '{}')
    }

    // Extract numbered media files (0, 1, 2, etc.)
    for (const filename of Object.keys(zipData.files)) {
      if (/^\d+$/.test(filename)) {
        const file = zipData.files[filename]
        const originalName = mediaMap[filename] || filename
        const blob = await file.async('blob')

        media[originalName] = {
          filename: originalName,
          blob: blob,
          size: blob.size,
          type: blob.type
        }
      }
    }

    return media
  } catch (error) {
    log.warn('Failed to parse media:', error)
    return {}
  }
}

export default {
  parseApkgFile
}
