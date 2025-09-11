import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { decompress as zstdDecompress } from 'fzstd'
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
    
    // Check if database is zstd compressed (modern Anki format)
    // Zstd magic bytes: 0x28 0xb5 0x2f 0xfd
    const isZstdCompressed = dbBuffer.length >= 4 && 
      dbBuffer[0] === 0x28 && dbBuffer[1] === 0xb5 && 
      dbBuffer[2] === 0x2f && dbBuffer[3] === 0xfd
    
    let finalDbBuffer
    if (isZstdCompressed) {
      log.debug('Detected zstd compressed database, decompressing...')
      try {
        finalDbBuffer = zstdDecompress(dbBuffer)
        log.debug(`Decompressed: ${dbBuffer.length} → ${finalDbBuffer.length} bytes`)
      } catch (error) {
        log.error('Failed to decompress zstd database:', error)
        throw new Error(`Failed to decompress database: ${error.message}`)
      }
    } else {
      finalDbBuffer = dbBuffer
    }
    
    const db = new SQL.Database(finalDbBuffer)

    // Get colSample for bundles extraction
    const colSampleStmt = db.prepare('SELECT * FROM col LIMIT 1')
    const colSample = colSampleStmt.step() ? colSampleStmt.getAsObject() : null
    colSampleStmt.free()

    // Parse collection info
    const collection = parseCollection(db)

    // Use the models data we already extracted (workaround for parseNoteTypes db access issue)
    const bundles = colSample && colSample.models && colSample.models.trim().length > 2 // must have content beyond "{}"
      ? JSON.parse(colSample.models)
      : parseNoteTypes(db)
    
    log.debug(`Final bundles object:`, Object.keys(bundles).length, 'models found')
    for (const [modelId, model] of Object.entries(bundles)) {
      log.debug(`Model ${modelId}: ${model.name}, fields: ${model.flds?.length || 0}, templates: ${model.tmpls?.length || 0}`)
    }

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

    log.debug('Col table row keys:', Object.keys(row))
    log.debug('Col table models field length:', (row.models || '').length)
    log.debug('Col table decks field length:', (row.decks || '').length)

    const config = JSON.parse(row.conf || '{}')
    const models = JSON.parse(row.models || '{}')
    const decks = JSON.parse(row.decks || '{}')
    
    log.debug('Parsed models count:', Object.keys(models).length)
    log.debug('Parsed decks count:', Object.keys(decks).length)

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
    // First try modern Anki format with separate notetypes table
    try {
      const stmt = db.prepare('SELECT * FROM notetypes')
      const rows = []
      while (stmt.step()) {
        rows.push(stmt.getAsObject())
      }
      stmt.free()
      
      if (rows.length > 0) {
        log.debug(`Found ${rows.length} notetypes in modern format`)
        const models = {}
        for (const row of rows) {
          log.debug(`Processing notetype row: id=${row.id}, name=${row.name}`)
          let configText = '{}' // Declare outside try block to avoid scoping issues
          try {
            // Check if config might be compressed
            configText = '{}' // Reset default
            if (row.config) {
              // Convert to Uint8Array if needed
              let configBuffer
              if (typeof row.config === 'string') {
                configBuffer = new TextEncoder().encode(row.config)
              } else if (row.config instanceof Uint8Array) {
                configBuffer = row.config
              } else if (row.config instanceof ArrayBuffer) {
                configBuffer = new Uint8Array(row.config)
              } else {
                configBuffer = new Uint8Array(0)
              }
              
              // Check for zstd magic bytes
              const isZstdCompressed = configBuffer.length >= 4 && 
                configBuffer[0] === 0x28 && configBuffer[1] === 0xb5 && 
                configBuffer[2] === 0x2f && configBuffer[3] === 0xfd
              
              if (isZstdCompressed) {
                log.debug(`Notetype ${row.id} config appears to be zstd compressed, attempting decompression`)
                try {
                  const decompressed = zstdDecompress(configBuffer)
                  configText = new TextDecoder().decode(decompressed)
                  log.debug(`Decompressed notetype config: ${configBuffer.length} → ${decompressed.length} bytes`)
                } catch (decompError) {
                  log.warn(`Failed to decompress notetype config:`, decompError.message)
                  configText = '{}'
                }
              } else {
                // Try as plain text
                configText = new TextDecoder().decode(configBuffer)
              }
            }
            
            const config = JSON.parse(configText)
            models[row.id.toString()] = {
              id: row.id,
              name: row.name,
              flds: config.flds || [],
              tmpls: config.tmpls || [],
              ...config
            }
            log.debug(`Parsed notetype: ${row.name} (id: ${row.id})`)
          } catch (configError) {
            log.warn(`Failed to parse config for notetype ${row.id}:`, configError.message)
            log.debug(`Config preview:`, JSON.stringify((configText || '').substring(0, 50)))
            
            // Create a basic model structure from available fields
            // For modern Anki, we'll create a minimal working model
            models[row.id.toString()] = {
              id: row.id,
              name: row.name || `Geography_${row.id}`,
              flds: [
                { name: 'Front', ord: 0 },
                { name: 'Back', ord: 1 }
              ],
              tmpls: [
                { 
                  name: 'Card 1', 
                  ord: 0, 
                  qfmt: '{{Front}}', 
                  afmt: '{{FrontSide}}<hr id="answer">{{Back}}' 
                }
              ],
              css: '',
              mod: Date.now(),
              type: 0
            }
            log.debug(`Created fallback model for notetype: ${row.name || 'Unknown'} (id: ${row.id})`)
          }
        }
        log.debug(`Successfully parsed ${Object.keys(models).length} notetypes`)
        log.debug(`Returning models:`, Object.keys(models))
        return models
      }
    } catch (modernError) {
      log.debug('Modern format failed:', modernError.message)
      log.debug('No modern notetypes table, trying legacy format')
    }
    
    // Fallback to legacy format from col.models
    log.debug('Trying legacy format fallback')
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    const models = JSON.parse(row.models || '{}')
    log.debug(`Found ${Object.keys(models).length} models in legacy format`)
    log.debug(`Legacy models:`, Object.keys(models))
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

// Simple protobuf parser for Anki media mapping
const parseProtobufMedia = (buffer) => {
  const mediaMap = {}
  let offset = 0
  let index = 0
  
  while (offset < buffer.length) {
    try {
      // Skip any non-filename data - look for readable filename patterns
      let foundFilename = false
      
      // Scan for what looks like a filename (contains common extensions)
      for (let i = offset; i < Math.min(offset + 200, buffer.length - 10); i++) {
        // Look for common file extensions in the byte stream
        const slice = buffer.slice(i, i + 50)
        const text = new TextDecoder('utf-8', { fatal: false }).decode(slice)
        
        // Check if this looks like a filename with extension
        const filenameMatch = text.match(/^([a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|svg|mp3|wav|ogg|mp4|webm|css|js))/i)
        if (filenameMatch) {
          const filename = filenameMatch[1]
          mediaMap[index.toString()] = filename
          log.debug(`Found media file: ${index} -> ${filename}`)
          index++
          offset = i + filename.length
          foundFilename = true
          break
        }
      }
      
      if (!foundFilename) {
        offset++
      }
      
      // Safety check to prevent infinite loops
      if (index > 10000) {
        log.warn('Too many media files found, stopping parsing')
        break
      }
    } catch (e) {
      offset++
    }
  }
  
  log.debug(`Extracted ${index} media filenames from protobuf`)
  return mediaMap
}

// Parse media files
const parseMedia = async (zipData) => {
  try {
    const media = {}

    // Check for media.json (file mapping)
    let mediaMap = {}
    const mediaFile = zipData.files['media']
    if (mediaFile) {
      const mediaBuffer = await mediaFile.async('uint8array')
      
      // Check if media file is also zstd compressed
      const isZstdCompressed = mediaBuffer.length >= 4 && 
        mediaBuffer[0] === 0x28 && mediaBuffer[1] === 0xb5 && 
        mediaBuffer[2] === 0x2f && mediaBuffer[3] === 0xfd
      
      let finalMediaBuffer
      if (isZstdCompressed) {
        log.debug('Detected zstd compressed media file, decompressing...')
        try {
          finalMediaBuffer = zstdDecompress(mediaBuffer)
          log.debug(`Media decompressed: ${mediaBuffer.length} → ${finalMediaBuffer.length} bytes`)
        } catch (error) {
          log.error('Failed to decompress zstd media file:', error)
          finalMediaBuffer = mediaBuffer
        }
      } else {
        finalMediaBuffer = mediaBuffer
      }
      
      const mediaText = new TextDecoder().decode(finalMediaBuffer)
      try {
        mediaMap = JSON.parse(mediaText || '{}')
        log.debug('Successfully parsed JSON media mapping')
      } catch (error) {
        log.debug('Media file is not JSON, attempting protobuf parsing')
        try {
          // Simple protobuf parsing for Anki media format
          mediaMap = parseProtobufMedia(finalMediaBuffer)
          log.debug(`Parsed protobuf media mapping: ${Object.keys(mediaMap).length} entries`)
        } catch (protobufError) {
          log.warn('Failed to parse media mapping:', protobufError.message)
          mediaMap = {} // Use empty mapping as last resort
        }
      }
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
  log.debug(`Import: Processing ${Object.keys(bundles).length} bundles`)
  log.debug(`Bundle IDs available:`, Object.keys(bundles))
  
  for (const [modelId, model] of Object.entries(bundles)) {
      const bundleId = await genId('bundle', `${model.name}-${JSON.stringify(model.flds.map(f => f.name))}`)
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
      
      if (!bundleId) {
        log.error(`No bundle found for note model ID: ${ankiNote.mid}`)
        log.debug('Available bundle IDs:', Array.from(bundleMap.keys()))
        log.debug('Note details:', { id: ankiNote.id, mid: ankiNote.mid })
        continue // Skip this note
      }

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
