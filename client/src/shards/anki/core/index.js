import db from './db.js'
import noteManager from './noteManager.js'
import mediaManager from './mediaManager.js'
import { render } from '../render/renderDefault.js'
import { StudyEngine } from './studyEngine.js'
import { log } from '../../../utils/logger.js'
import { genId } from '../../../utils/idGenerator.js'
import _ from 'lodash'

// Extract media filenames from fields
async function findMedia(fields) {
  if (!Array.isArray(fields)) fields = [fields]

  const filenames = []

  for (const field of fields) {
    if (!field) continue

    // Extract filenames from [sound:filename] tags
    const soundMatches = field.match(/\[sound:([^\]]+)\]/g) || []
    for (const match of soundMatches) {
      const filename = match.replace(/\[sound:([^\]]+)\]/, '$1')
      if (filename) {
        filenames.push(filename)
      }
    }

    // Extract filenames from HTML media tags
    const htmlMatches = field.match(/<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi) || []
    for (const match of htmlMatches) {
      const srcMatch = match.match(/\b(?:src|data)=["']?([^"'\s>]+)["']?/)
      if (srcMatch) {
        const filename = srcMatch[1]
        if (filename) {
          filenames.push(filename)
        }
      }
    }
  }

  return [...new Set(filenames)] // Remove duplicates
}

// Remove a template and its media references
async function removeTemplate(template) {
  if (!template) return false

  const { qfmt, afmt, bundleId, ord } = template
  // Remove media references from template formats
  const files = await findMedia(qfmt + afmt)
  await mediaManager.remove(bundleId, ord, files)

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
      await removeTemplate(template)
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

    // Extract media from combined formats
    const filenames = await findMedia(qfmt + afmt)
    const template = {
      id: genId('template', bundleId + name + qfmt + afmt),
      bundleId,
      name,
      qfmt,
      afmt,
      ord,
      vdeck: null,
      created: Date.now()
    }
    await db.templates.put(template)

    // Add media references using only the needed files
    if (filenames.length > 0) {
      const mediaObject = _.pick(media, filenames)
      await mediaManager.add(bundleId, ord, mediaObject)
    }

    return ord // Return the assigned ord for mapping
  },

  async  getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  },

  removeTemplate,

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
