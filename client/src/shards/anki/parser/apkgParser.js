import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import ankiApi from '../core/ankiApi'
import noteManager from '../core/noteManager'
import { log } from '../../../utils/logger'

// Browser-compatible .apkg parser using sql.js + jszip
// Updated to work with new note+template architecture

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

    // Get colSample for noteTypes extraction
    const colSampleStmt = db.prepare('SELECT * FROM col LIMIT 1')
    const colSample = colSampleStmt.step() ? colSampleStmt.getAsObject() : null
    colSampleStmt.free()

    // Parse collection info
    const collection = parseCollection(db)

    // Use the models data we already extracted (workaround for parseNoteTypes db access issue)
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

// Parse note types (templates) - fallback function (currently has db access issues)
const parseNoteTypes = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    const models = JSON.parse(row.models || '{}')
    return models
  } catch (error) {
    log.warn('Failed to parse note types:', error)
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

        // Create data URL for browser access
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })

        media[originalName] = {
          filename: originalName,
          blob: blob,
          dataUrl: dataUrl,
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

// Convert parsed Anki data to new note+template structure and import
export const importApkgData = async (parsedData, deckId, shardId) => {
  try {
    log.info('Converting Anki data to new note+template structure...')

    const { noteTypes, notes: ankiNotes, media } = parsedData
    const createdNotes = []

    // 1. Create NoteTypes and Templates
    for (const [modelId, model] of Object.entries(noteTypes)) {
      const noteTypeId = `anki-${modelId}`

      // Extract field names
      const fields = model.flds.map(field => field.name)

      // Create noteType
      await noteManager.createType(noteTypeId, model.name, fields)
      log.debug(`Created noteType: ${model.name}`)

      // Create templates
      for (const template of model.tmpls) {
        await noteManager.createTemplate(
          noteTypeId,
          template.name,
          template.qfmt,
          template.afmt,
          template.ord
        )
        log.debug(`Created template: ${template.name}`)
      }
    }

    // 2. Import Notes
    for (const ankiNote of ankiNotes) {
      const noteTypeId = `anki-${ankiNote.mid}`

      const result = await ankiApi.createNote(
        noteTypeId,
        ankiNote.flds,
        ankiNote.tags,
        deckId,
        shardId
      )

      createdNotes.push(result)
    }

    // 3. Store media files
    if (Object.keys(media).length > 0) {
      // TODO: Import media files to media store
      log.debug(`Media files found: ${Object.keys(media).length}`)
    }

    log.info('✅ Import complete:')
    log.info(`   • NoteTypes: ${Object.keys(noteTypes).length}`)
    log.info(`   • Notes: ${createdNotes.length}`)
    log.info(`   • Cards: ${createdNotes.reduce((sum, n) => sum + n.cards.length, 0)}`)

    return {
      noteTypes: Object.keys(noteTypes).length,
      notes: createdNotes.length,
      cards: createdNotes.reduce((sum, n) => sum + n.cards.length, 0),
      media: Object.keys(media).length
    }

  } catch (error) {
    log.error('Failed to import Anki data:', error)
    throw error
  }
}

export default {
  parseApkgFile,
  importApkgData
}
