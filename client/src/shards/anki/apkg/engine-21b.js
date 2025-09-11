import { decompress as zstdDecompress } from 'fzstd'
import { log } from '../../../utils/logger'

// Modern Anki engine (v2.1.35+ with zstd compression and protobuf)
// Handles collection.anki21b format

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

    if (rows.length === 0) return {}

    log.debug(`Found ${rows.length} notetypes in modern format`)
    const models = {}

    for (const row of rows) {
      log.debug(`Processing notetype: id=${row.id}, name=${row.name}`)
      let configText = '{}'

      try {
        // Handle compressed config
        if (row.config) {
          let configBuffer
          log.debug('config type', { string: typeof row.config, ua:row.config instanceof Uint8Array, ab: row.config instanceof ArrayBuffer })
          if (typeof row.config === 'string') {
            configBuffer = new TextEncoder().encode(row.config)
          } else if (row.config instanceof Uint8Array) {
            configBuffer = row.config
          } else if (row.config instanceof ArrayBuffer) {
            configBuffer = new Uint8Array(row.config)
          } else {
            configBuffer = new Uint8Array(0)
          }

          if (isZstdCompressed(configBuffer)) {
            log.debug(`Decompressing notetype ${row.id} config`)
            const configBuffer = zstdDecompress(configBuffer)
          }

          configText = new TextDecoder().decode(configBuffer)
        }

        const config = JSON.parse(configText)
        models[row.id.toString()] = {
          id: row.id,
          name: row.name,
          flds: config.flds || [],
          tmpls: config.tmpls || [],
          ...config
        }
        log.debug(`Parsed notetype: ${row.name}`)
      } catch (configError) {
        log.error(`Config parsing failed for notetype ${row.id} (${row.name}): ${configError.message}`)
        throw new Error(`Failed to parse notetype config for "${row.name}" (ID: ${row.id}): ${configError.message}`)
      }
    }

    log.debug(`Successfully parsed ${Object.keys(models).length} notetypes`)
    return models
  } catch (error) {
    log.warn('Modern notetypes parsing failed:', error.message)
    return {}
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
          log.debug(`Found media: ${index} -> ${filename}`)
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

      media[originalName] = {
        filename: originalName,
        blob: blob,
        size: blob.size
      }
    }
  }

  log.debug(`Parsed ${Object.keys(media).length} media files`)
  return media
}

// Get appropriate database file for modern format
export const getDbFile = (zipData) => {
  return zipData.files['collection.anki21b'] ||
         zipData.files['collection.anki21'] ||
         zipData.files['collection.anki2']
}

// Process database buffer (handle compression)
export const processDbBuffer = async (dbBuffer) => {
  return handleCompression(dbBuffer)
}
