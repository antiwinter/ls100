import { decompress as zstdDecompress } from 'fzstd'
import { log } from '../../../utils/logger'
import * as defaultEngine from './engine-default.js'

// Engine for Anki version 21b (protobuf-based format)

export const name = 'engine-21b'

// Check if this engine is compatible with the package
export const compatible = (zipData) => {
  return !!zipData.files['collection.anki21b']
}

// Get the collection file from the package
export const getCollectionFile = (zipData) => {
  return zipData.files['collection.anki21b']
}

// Process database buffer (handle compression)
export const processDbBuffer = async (buffer) => {
  if (isZstdCompressed(buffer)) {
    log.debug(`Decompressing zstd: ${buffer.length} bytes`)
    const decompressed = zstdDecompress(buffer)
    log.debug(`Decompressed: ${buffer.length} → ${decompressed.length} bytes`)
    return decompressed
  }
  return buffer
}

// Check if buffer is zstd compressed
const isZstdCompressed = (buffer) => {
  return buffer.length >= 4 &&
    buffer[0] === 0x28 && buffer[1] === 0xb5 &&
    buffer[2] === 0x2f && buffer[3] === 0xfd
}

// Decompress zstd data if needed
const handleCompression = (buffer) => {
  if (isZstdCompressed(buffer)) {
    log.debug(`Decompressing zstd: ${buffer.length} bytes`)
    const decompressed = zstdDecompress(buffer)
    log.debug(`Decompressed: ${buffer.length} → ${decompressed.length} bytes`)
    return decompressed
  }
  return buffer
}

// Parse modern notetypes table with protobuf config support
export const parseNotetypes = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM notetypes')
    const rows = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()

    if (rows.length === 0) {
      throw new Error('Invalid APKG: No notetypes found in modern format')
    }

    log.debug(`Found ${rows.length} notetypes in modern format`)
    const models = {}

    for (const row of rows) {
      log.debug(`Processing notetype: id=${row.id}, name=${row.name}`)

      // Get fields from separate fields table
      const fields = parseNotetypeFields(db, row.id)
      // Get templates from separate templates table
      const templates = parseNotetypeTemplates(db, row.id)

      models[row.id.toString()] = {
        id: row.id,
        name: row.name,
        flds: fields,
        tmpls: templates
      }
      log.debug(`Parsed notetype: ${row.name}`)
    }

    log.debug(`Successfully parsed ${Object.keys(models).length} notetypes`)
    return models
  } catch (error) {
    log.error('Modern notetypes parsing failed:', error.message)
    throw new Error(`Invalid APKG: Failed to parse modern notetypes - ${error.message}`)
  }
}

// Parse fields for a specific notetype
const parseNotetypeFields = (db, notetypeId) => {
  try {
    const stmt = db.prepare('SELECT * FROM fields WHERE ntid = ? ORDER BY ord')
    const fields = []
    stmt.bind([notetypeId])
    while (stmt.step()) {
      const row = stmt.getAsObject()
      fields.push({
        name: row.name,
        ord: row.ord || 0
      })
    }
    stmt.free()
    return fields
  } catch (error) {
    log.error(`Failed to parse fields for notetype ${notetypeId}: ${error.message}`)
    throw new Error(`Invalid APKG: Failed to parse fields for notetype ${notetypeId} - ${error.message}`)
  }
}

// Parse templates for a specific notetype
const parseNotetypeTemplates = (db, notetypeId) => {
  try {
    const stmt = db.prepare('SELECT * FROM templates WHERE ntid = ? ORDER BY ord')
    const templates = []
    stmt.bind([notetypeId])
    while (stmt.step()) {
      const row = stmt.getAsObject()

      // Extract template formats from protobuf config
      let qfmt = '{{Front}}'
      let afmt = '{{FrontSide}}<hr id="answer">{{Back}}'

      // First check if template formats are stored directly in columns
      if (row.qfmt && row.afmt) {
        qfmt = row.qfmt
        afmt = row.afmt
      } else if (row.config) {
        // Fall back to protobuf parsing
        try {
          const configBuffer = row.config instanceof Uint8Array
            ? row.config : new Uint8Array(row.config)
          const configText = new TextDecoder().decode(configBuffer)

          // Extract template formats from protobuf using proper parsing
          // Look for template content in the protobuf data
          const templateText = configText.replace(/[^\x20-\x7E]/g, ' ')
          const templateParts = templateText.split(/\s+/).filter(part => part.includes('{{') && part.includes('}}'))

          if (templateParts.length >= 1) {
            qfmt = templateParts[0]
          }

          if (templateParts.length >= 2) {
            afmt = templateParts.slice(1).join(' ')
          }

          // Fallback: try traditional protobuf regex patterns
          if (qfmt === '{{Front}}' || afmt === '{{FrontSide}}<hr id="answer">{{Back}}') {
            const qFormatMatch = configText.match(/\\x0a([^{]*\{\{[^}]+\}\}[^{]*)/s)
            const aFormatMatch = configText.match(/\\x12([^{]*\{\{[^}]+\}\}[^{]*)/s)

            if (qFormatMatch && qfmt === '{{Front}}') {
              qfmt = qFormatMatch[1].replace(/\\x00/g, '')
            }
            if (aFormatMatch && afmt === '{{FrontSide}}<hr id="answer">{{Back}}') {
              afmt = aFormatMatch[1].replace(/\\x00/g, '')
            }
          }
        } catch (error) {
          log.warn(`Failed to parse template protobuf for ${row.name}:`, error.message)
        }
      }

      templates.push({
        name: row.name,
        ord: row.ord || 0,
        qfmt,
        afmt
      })
    }
    stmt.free()
    return templates
  } catch (error) {
    log.error(`Failed to parse templates for notetype ${notetypeId}: ${error.message}`)
    throw new Error(`Invalid APKG: Failed to parse templates for notetype ${notetypeId} - ${error.message}`)
  }
}

// Parse protobuf media mapping (modern Anki media format)
const parseProtobufMedia = (buffer) => {
  const mediaMap = {}
  let offset = 0
  let index = 0

  while (offset < buffer.length && index < 10000) {
    try {
      // Scan for filename patterns in protobuf data
      let foundFilename = false

      for (let i = offset; i < Math.min(offset + 200, buffer.length - 10); i++) {
        const slice = buffer.slice(i, i + 50)
        const text = new TextDecoder('utf-8', { fatal: false }).decode(slice)

        // Match common media file extensions
        const filenameMatch = text.match(/^([a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|svg|mp3|wav|ogg|mp4|webm|css|js))/i)
        if (filenameMatch) {
          const filename = filenameMatch[1]
          mediaMap[index.toString()] = filename
          index++
          offset = i + filename.length
          foundFilename = true
          break
        }
      }

      if (!foundFilename) offset++
    } catch {
      offset++
    }
  }

  log.debug(`Extracted ${index} media filenames from protobuf`)
  return mediaMap
}

// Parse decks from modern deck table
export const parseDecks = (db) => {
  try {
    const stmt = db.prepare('SELECT * FROM decks')
    const decks = {}

    while (stmt.step()) {
      const row = stmt.getAsObject()
      // For modern format, deck names are stored directly
      decks[row.id] = {
        id: row.id,
        name: row.name,
        // Note: common and kind are protobuf, but name is sufficient for our use
        mtime_secs: row.mtime_secs,
        usn: row.usn
      }
    }
    stmt.free()

    log.debug(`Engine-21b parsed ${Object.keys(decks).length} decks`)
    return decks
  } catch (error) {
    log.warn('Failed to parse decks from modern format:', error.message)
    // Deck parsing failure is not critical for import - return empty
    return {}
  }
}


// Parse modern media with protobuf support
export const parseMedia = async (zipData) => {
  const media = {}
  let mediaMap = {}

  // Get media mapping file
  const mediaFile = zipData.files['media']
  if (mediaFile) {
    const mediaBuffer = await mediaFile.async('uint8array')
    const decompressed = handleCompression(mediaBuffer)

    try {
      // Try JSON first (legacy compatibility)
      const mediaText = new TextDecoder().decode(decompressed)
      mediaMap = JSON.parse(mediaText || '{}')
      log.debug('Parsed JSON media mapping')
    } catch {
      // Use protobuf parser for modern format
      log.debug('Using protobuf media parsing')
      mediaMap = parseProtobufMedia(decompressed)
    }
  }

  // Extract numbered media files using mapping
  for (const filename of Object.keys(zipData.files)) {
    if (/^\d+$/.test(filename)) {
      const file = zipData.files[filename]
      const originalName = mediaMap[filename] || filename
      const blob = await file.async('blob')

      media[originalName] = blob
    }
  }

  log.debug(`Parsed ${Object.keys(media).length} media files`)
  return media
}

// Parse review history - delegate to default engine since logic is identical
export const parseReviewHistory = defaultEngine.parseReviewHistory

