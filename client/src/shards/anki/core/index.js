import db from './db.js'
import noteManager from './noteManager.js'
import mediaManager from '../../../utils/mediaManager.js'
import { render } from '../render/renderDefault.js'
import { StudyEngine } from './studyEngine.js'
import { log } from '../../../utils/logger.js'
import { genId } from '../../../utils/idGenerator.js'

// Extract media references from fields (no content modification)
async function findMedia(fields, blobs = {}) {
  if (!Array.isArray(fields)) fields = [fields]

  const media = []

  for (const field of fields) {
    if (!field) continue

    // Extract filenames from [sound:filename] tags
    const soundMatches = field.match(/\[sound:([^\]]+)\]/g) || []
    for (const match of soundMatches) {
      const filename = match.replace(/\[sound:([^\]]+)\]/, '$1')
      await _linkMedia(filename, blobs, media)
    }

    // Extract filenames from HTML media tags
    const htmlMatches = field.match(/<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi) || []
    for (const match of htmlMatches) {
      const srcMatch = match.match(/\b(?:src|data)=["']?([^"'\s>]+)["']?/)
      if (srcMatch) {
        const filename = srcMatch[1]
        await _linkMedia(filename, blobs, media)
      }
    }
  }

  return { media }
}

// Process individual media file (internal)
async function _linkMedia(filename, blobs, mediaArray) {
  if (!filename || !blobs[filename]) return

  const blob = blobs[filename]
  const nvId = await mediaManager.blob2NvId(blob)

  // Add to media array (avoid duplicates)
  if (!mediaArray.find(m => m.nvId === nvId)) {
    mediaArray.push({
      nvId,
      filename,
      blob
    })
  }
}



// Remove a template and its media references
async function _removeTemplate(template) {
  if (!template) return false

  // Remove media references from template formats
  const qResult = await findMedia(template.qfmt, {})
  const aResult = await findMedia(template.afmt, {})
  const allNvIds = [...qResult.media.map(m => m.nvId), ...aResult.media.map(m => m.nvId)]
  if (allNvIds.length > 0) {
    await mediaManager.remove(allNvIds)
  }
  // Remove template from database
  await db.templates.delete(template.id)
  log.debug('Removed template:', template.id)
  return true
}

// Clean up orphaned data whose bundles no longer exist (internal)
async function _cleanupOrphans() {
  // Collect valid bundle IDs first (bundles are typically few)
  const validBundleIds = new Set((await db.bundles.toArray()).map(b => b.id))
  const valid = Array.from(validBundleIds)

  const stats = {
    templatesRemoved: 0,
    notesRemoved: 0,
    cardsRemoved: 0
  }

  const BATCH = 500

  // Remove orphaned templates in batches (indexed by bundleId)
  while (true) {
    const batch = await db.templates.where('bundleId').noneOf(valid).limit(BATCH).toArray()
    if (batch.length === 0) break
    for (const template of batch) {
      await _removeTemplate(template)
      stats.templatesRemoved++
    }
  }

  // Remove orphaned notes in batches (indexed by bundleId)
  while (true) {
    const batch = await db.notes.where('bundleId').noneOf(valid).limit(BATCH).toArray()
    if (batch.length === 0) break
    for (const note of batch) {
      await noteManager.delete(note) // Handles media cleanup
      stats.notesRemoved++
      // log.debug('Removed orphaned note:', note)
    }
  }

  // Remove orphaned cards in batches (indexed by bundleId)
  while (true) {
    const batch = await db.cards.where('bundleId').noneOf(valid).limit(BATCH).toArray()
    if (batch.length === 0) break
    await db.cards.bulkDelete(batch.map(c => c.id))
    stats.cardsRemoved += batch.length
    // for (const card of batch) log.debug('Removed orphaned card:', card)
  }

  return stats
}

export const anki = {
  noteManager,
  mediaManager,
  render,
  StudyEngine,
  findMedia,

  // Add template to bundle - handles both raw and cooked formats
  async addTemplate(bundleId, name, qfmt, afmt, media = {}) {
    // Auto-increment ord
    const existingTemplates = await db.templates.where('bundleId').equals(bundleId).toArray()
    const maxOrd = existingTemplates.length > 0
      ? Math.max(...existingTemplates.map(t => t.ord)) : -1
    const ord = maxOrd + 1

    // Process formats with media (handles both raw and cooked)
    const qResult = await findMedia(qfmt, media)
    const aResult = await findMedia(afmt, media)

    const template = {
      id: genId('template', bundleId + name + qResult.cooked + aResult.cooked),
      bundleId,
      name,
      qfmt: qResult.cooked,
      afmt: aResult.cooked,
      ord,
      vdeck: null,
      created: Date.now()
    }
    await db.templates.put(template)

    // Add media references
    const allMedia = [...qResult.media, ...aResult.media]
    if (allMedia.length > 0) {
      await mediaManager.add(allMedia)
    }

    return ord // Return the assigned ord for mapping
  },

  async  getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  },

  async removeTemplate(tp) {
    await _removeTemplate(tp)
  },

  async  getBundle(bundleId) {
    return await db.bundles.get(bundleId)
  },

  // Get cards for bundles (supports both single bundleId and array)
  async  getCardsForBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    if (normalizedBundleIds.length === 0) {
      return []
    }
    return await db.cards.where('bundleId').anyOf(normalizedBundleIds).toArray()
  },

  // Remove bundles and clean up orphaned data
  async  removeBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    let bundlesRemoved = 0

    for (const bundleId of normalizedBundleIds) {
      const bundleExists = await db.bundles.get(bundleId)
      if (bundleExists) {
        await db.bundles.delete(bundleId)
        bundlesRemoved++
      }
    }

    const orphanStats = await _cleanupOrphans()
    const totalStats = { bundlesRemoved, ...orphanStats }
    log.debug('Bundles removal completed:', { bundleIds: normalizedBundleIds, ...totalStats })

    return totalStats
  },


  // Add bundle/NoteType
  async  addBundle(id, name, fields, css = '') {
    const bundle = {
      id,
      name,
      fields, // Array of field definitions
      css,
      created: Date.now(),
      modified: Date.now()
    }
    await db.bundles.put(bundle)
    log.debug('Bundle created:', id)
    return bundle
  }

  // No default export needed - use named exports directly
}

export default anki
