import { decompress as zstdDecompress } from 'fzstd'
import { log } from '../../../utils/logger'
import * as defaultEngine from './engine-default.js'
import protobuf from 'protobufjs'

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


// Parse modern notetypes table with protobuf config support
export const parseNotetypes = async (db) => {
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
      const templates = await parseNotetypeTemplates(db, row.id)

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

// Load protobuf schema for template config
let templateConfigType = null
async function loadTemplateConfigProto() {
  if (!templateConfigType) {
    // Define the protobuf schema inline based on Anki's notetypes.proto
    const root = protobuf.Root.fromJSON({
      'nested': {
        'TemplateConfig': {
          'fields': {
            'q_format': {
              'type': 'string',
              'id': 1
            },
            'a_format': {
              'type': 'string',
              'id': 2
            },
            'q_format_browser': {
              'type': 'string',
              'id': 3
            },
            'a_format_browser': {
              'type': 'string',
              'id': 4
            },
            'target_deck_id': {
              'type': 'int64',
              'id': 5
            },
            'browser_font_name': {
              'type': 'string',
              'id': 6
            },
            'browser_font_size': {
              'type': 'uint32',
              'id': 7
            }
          }
        }
      }
    })
    templateConfigType = root.lookupType('TemplateConfig')
  }
  return templateConfigType
}

// Parse templates for a specific notetype
const parseNotetypeTemplates = async (db, notetypeId) => {
  try {
    const stmt = db.prepare('SELECT * FROM templates WHERE ntid = ? ORDER BY ord')
    const templates = []
    stmt.bind([notetypeId])

    // Load protobuf schema
    const TemplateConfig = await loadTemplateConfigProto()

    while (stmt.step()) {
      const row = stmt.getAsObject()

      let qfmt = '{{Front}}'
      let afmt = '{{FrontSide}}<hr id="answer">{{Back}}'

      // Properly decode protobuf config
      if (row.config) {
        try {
          const configBuffer = row.config instanceof Uint8Array
            ? row.config : new Uint8Array(row.config)

          // Decode the protobuf binary data
          const decoded = TemplateConfig.decode(configBuffer)

          // Extract the template formats directly from protobuf fields
          if (decoded.q_format) qfmt = decoded.q_format
          if (decoded.a_format) afmt = decoded.a_format

          log.debug(`Decoded template ${row.name}: qfmt=${qfmt.substring(0, 50)}...`)

        } catch (error) {
          log.warn(`Failed to decode protobuf config for ${row.name}: ${error.message}`)
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

// Load protobuf schema for media entries
let mediaEntriesType = null
async function loadMediaEntriesProto() {
  if (!mediaEntriesType) {
    // Define MediaEntries schema based on Anki's import_export.proto
    const root = protobuf.Root.fromJSON({
      'nested': {
        'MediaEntries': {
          'fields': {
            'entries': {
              'rule': 'repeated',
              'type': 'MediaEntry',
              'id': 1
            }
          },
          'nested': {
            'MediaEntry': {
              'fields': {
                'name': {
                  'type': 'string',
                  'id': 1
                },
                'size': {
                  'type': 'uint32',
                  'id': 2
                },
                'sha1': {
                  'type': 'bytes',
                  'id': 3
                },
                'legacy_zip_filename': {
                  'type': 'uint32',
                  'id': 255,
                  'options': {
                    'proto3_optional': true
                  }
                }
              }
            }
          }
        }
      }
    })
    mediaEntriesType = root.lookupType('MediaEntries')
  }
  return mediaEntriesType
}

// Parse protobuf media mapping (modern Anki media format)
const parseProtobufMedia = async (buffer) => {
  try {
    const MediaEntries = await loadMediaEntriesProto()
    const decoded = MediaEntries.decode(buffer)

    const mediaMap = {}
    decoded.entries.forEach((entry, index) => {
      // Use legacy_zip_filename if available, otherwise use array index
      const key = entry.legacy_zip_filename != null
        ? entry.legacy_zip_filename.toString()
        : index.toString()
      mediaMap[key] = entry.name
    })

    log.debug(`Decoded ${decoded.entries.length} media entries from protobuf`)
    return mediaMap
  } catch (error) {
    log.warn(`Failed to decode protobuf media entries: ${error.message}`)
    return {}
  }
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
    const decompressed = await processDbBuffer(mediaBuffer)

    try {
      // Try JSON first (legacy compatibility)
      const mediaText = new TextDecoder().decode(decompressed)
      mediaMap = JSON.parse(mediaText || '{}')
      log.debug('Parsed JSON media mapping')
    } catch {
      // Use protobuf parser for modern format
      log.debug('Using protobuf media parsing')
      mediaMap = await parseProtobufMedia(decompressed)
    }
  }

  // Extract numbered media files using mapping
  for (const filename of Object.keys(zipData.files)) {
    if (/^\d+$/.test(filename)) {
      const file = zipData.files[filename]
      const originalName = mediaMap[filename] || filename
      const blob = await file.async('blob')

      // Log mapping issues for debugging
      if (originalName === filename) {
        log.warn(`No mapping found for media file: ${filename}`)
      }

      media[originalName] = blob
    }
  }

  log.debug(`Parsed ${Object.keys(media).length} media files`)
  return media
}

// Parse review history - delegate to default engine since logic is identical
export const parseReviewHistory = defaultEngine.parseReviewHistory

