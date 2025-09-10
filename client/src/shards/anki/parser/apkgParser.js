import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import ankiApi from '../core/ankiApi'
import noteManager from '../core/noteManager'
import mediaManager from '../core/mediaManager'
import { log } from '../../../utils/logger'
import { genNvId, genId } from '../../../utils/idGenerator.js'

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

    // Extract collection database (try multiple formats like real Anki)
    // Order: collection.anki21b (latest) → collection.anki21 (legacy2) → collection.anki2 (legacy1)
    let dbFile = zipData.files['collection.anki21b'] ||
                 zipData.files['collection.anki21'] ||
                 zipData.files['collection.anki2']

    if (!dbFile) {
      throw new Error('No collection database found in .apkg file (tried collection.anki21b, collection.anki21, collection.anki2)')
    }

    const dbBuffer = await dbFile.async('uint8array')
    const db = new SQL.Database(dbBuffer)

    // Get colSample for bundles extraction
    const colSampleStmt = db.prepare('SELECT * FROM col LIMIT 1')
    const colSample = colSampleStmt.step() ? colSampleStmt.getAsObject() : null
    colSampleStmt.free()

    // Parse collection info
    const collection = parseCollection(db)

    // Use the models data we already extracted (workaround for parseNoteTypes db access issue)
    const bundles = colSample && colSample.models
      ? JSON.parse(colSample.models)
      : parseNoteTypes(db)

    // Parse decks
    const decks = parseDecks(db)

    // Parse notes and cards
    const notes = parseNotes(db)
    const cards = parseCards(db, notes, bundles)

    // Extract media files
    const media = await parseMedia(zipData)

    db.close()

    // Determine deck name: prefer deck that contains cards
    const deckNames = Object.values(decks || {})
      .filter(d => d.name && d.name !== 'Default')
      .map(d => d.name)

    const result = {
      collection,
      bundles,
      decks,
      name: deckNames[0] || genId('Anki'),
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
    const stmt = db.prepare('SELECT decks FROM col LIMIT 1')

    if (stmt.step()) {
      const row = stmt.getAsObject()
      stmt.free()

      const decksJson = row.decks
      if (decksJson && typeof decksJson === 'string') {
        const decks = JSON.parse(decksJson)
        return decks
      }
    }

    stmt.free()
    log.warn('No decks data found in database')
    return {}
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
const parseCards = (db, notes, bundles) => {
  try {
    const stmt = db.prepare('SELECT * FROM cards')
    const cards = []
    const noteMap = new Map(notes.map(n => [n.id, n]))

    while (stmt.step()) {
      const row = stmt.getAsObject()
      const note = noteMap.get(row.nid)

      if (note) {
        const bundle = bundles[note.mid]

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
          bundle: bundle
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

// Convert parsed Anki data to new note+template structure and import
export const importApkgData = async (parsedData) => {
  try {
    log.info('Converting Anki data to new note+template structure...')

    const { bundles, notes: ankiNotes, media } = parsedData
    const createdNotes = []
    const bundleIds = []
    const bundleMap = new Map() // modelId -> bundleId

    // 1. Create Bundles and Templates (one bundle per Anki note type)
    for (const [modelId, model] of Object.entries(bundles)) {
      const bundleId = await genNvId('bundle', `${model.name}-${JSON.stringify(model.flds.map(f => f.name))}`)
      bundleMap.set(modelId, bundleId)
      bundleIds.push(bundleId)

      // Extract field names
      const fields = model.flds.map(field => field.name)

      // Create bundle
      await noteManager.createType(bundleId, model.name, fields)
      log.debug(`Created bundle: ${model.name}`)

      // Create templates with cooked formats
      for (const template of model.tmpls) {
        // Cook template formats: filename → NvId + increment refCount
        const cookedQfmt = await mediaManager.addMedia(template.qfmt, media)
        const cookedAfmt = await mediaManager.addMedia(template.afmt, media)

        await noteManager.createTemplate(
          bundleId,
          template.name,
          cookedQfmt,
          cookedAfmt,
          template.ord
        )
        log.debug(`Created template: ${template.name}`)
      }
    }

    // 2. Import Notes with cooked fields
    for (const ankiNote of ankiNotes) {
      const bundleId = bundleMap.get(ankiNote.mid.toString())

      // Cook fields: filename → NvId + increment refCount
      const cookedFields = []
      for (const field of ankiNote.flds) {
        const cookedField = await mediaManager.addMedia(field, media)
        cookedFields.push(cookedField)
      }

      const result = await ankiApi.createNote(
        bundleId,
        cookedFields,
        ankiNote.tags
      )

      createdNotes.push(result)
    }

    // 3. Media files are already imported during field/template cooking
    // No need for separate media import step

    log.info('✅ Import complete:')
    log.info(`   • NoteTypes: ${Object.keys(bundles).length}`)
    log.info(`   • Notes: ${createdNotes.length}`)
    log.info(`   • Cards: ${createdNotes.reduce((sum, n) => sum + n.cards.length, 0)}`)

    return {
      bundleIds,
      bundles: Object.keys(bundles).length,
      notes: createdNotes.length,
      cards: createdNotes.reduce((sum, n) => sum + n.cards.length, 0),
      media: Object.keys(media).length
    }

  } catch (error) {
    log.error('Failed to import Anki data:', error)
    throw error
  }
}

// Media files are now imported automatically during addMedia() calls
// No separate media import function needed

export default {
  parseApkgFile,
  importApkgData
}
