import { AnkiShardEditor } from './AnkiShardEditor.jsx'
import { AnkiCover } from './AnkiCover.jsx'
import { AnkiReader as AnkiReaderComponent } from './reader/AnkiReader.jsx'
import { parseApkgFile, importApkgData } from './apkg/index.js'
import anki from './core/index.js'
import { log } from '../../utils/logger'

// Anki Shard Engine
// Handles .apkg file detection, parsing, and integration with shard system

// File detection with confidence scoring
export const detect = async (filename, buffer) => {
  log.debug('Detecting Anki file:', filename, 'size:', buffer.byteLength || buffer.length)

  // Check file extension
  const hasExt = /\.apkg$/i.test(filename)

  // For .apkg files, we can be highly confident
  const confidence = hasExt ? 0.95 : 0.0

  // Extract bundle name from file content when possible; fallback to filename
  let parsedName = null
  let parsedData = null
  if (hasExt) {
    try {
      parsedData = await parseApkgFile(buffer)
      log.debug('Parsed data:', parsedData)
      parsedName = parsedData.deckName || null
    } catch (e) {
      log.warn('Bundle name extraction failed during detect; falling back to filename:', e)
    }
  }

  const result = {
    match: hasExt,
    confidence,
    metadata: {
      type: 'anki-bundle',
      suggestedName: parsedName || filename.replace(/\.apkg$/i, '').replace(/[-_.]/g, ' ').trim(),
      // Store file for later processing
      file: buffer,
      // Store parsed data to avoid re-parsing in editor
      parsedData: parsedData
    }
  }

  log.debug('Anki detection result:', { match: result.match, confidence, parsedName })
  return result
}



// Old generateSide function removed - now using TemplateEngine

// Generate cover for shard preview
// Deprecated attribute-based cover generator removed; use CoverComponent instead

// Shard type metadata
export const shardTypeInfo = {
  name: 'anki',
  displayName: 'Anki Shard',
  color: '#3f51b5' // Anki blue
}

// Process shard data - commit bundle imports and update counts
export const processData = async (shard, data = shard?.data) => {
  try {
    // Process bundles from transient data (not persisted in shard)
    if (data?.bundles?.length > 0) {
      const bundles = []

      for (const bundle of data.bundles) {
        try {
          // Import parsed APKG data
          const result = await importApkgData(bundle)

          // Store bundle info (id + name) for cleanup
          if (Array.isArray(result?.bundleIds)) {
            bundles.push(...result.bundleIds.map(id => ({ id, name: bundle.name })))
          }

          log.info('Committed Anki import:', { bundleIds: result?.bundleIds, name: bundle.name })
        } catch (e) {
          log.error('Failed to commit Anki import:', e)
        }
      }

      // Update bundles array in meta (persistent)
      shard.meta = {
        ...shard.meta,
        bundles
      }
    }

  } catch (error) {
    log.error('Failed to process shard data:', error)
  }
}

// Cleanup function called when shard is deleted
export const cleanup = async (shard, allShards = []) => {
  try {
    log.info('🧹 Cleaning up Anki shard:', shard.id)
    log.info('📋 Shard meta:', {
      meta: shard.meta,
      bundles: shard.meta?.bundles,
      bundlesLength: shard.meta?.bundles?.length || 0
    })

    // Extract bundleIds from bundles array
    const bundleIds = shard.meta?.bundles?.map(b => b.id) || []
    log.info('📦 Extracted bundleIds:', { bundleIds, count: bundleIds.length })

    if (bundleIds.length > 0) {
      log.info('🗑️ Starting bundle removal...')
      await anki.removeBundles(bundleIds)
    } else {
      log.warn('⚠️ No bundleIds found - skipping database cleanup!')
    }

    // Check for remaining Anki shards for potential orphan cleanup
    const remainingAnkiShards = allShards.filter(s => s.type === 'anki' && s.id !== shard.id)

    if (remainingAnkiShards.length === 0) {
      log.info('Last Anki shard deleted - deep cleanup could be performed here if needed')
    }

    log.info('Anki shard cleanup completed:', shard.id)
  } catch (error) {
    log.error('Failed to cleanup Anki shard:', error)
  }
}

// Engine components
export const EditorComponent = AnkiShardEditor
export const ReaderComponent = AnkiReaderComponent
export const CoverComponent = AnkiCover

log.debug('Anki shard engine initialized')
