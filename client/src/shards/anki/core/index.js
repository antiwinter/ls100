import db from './db.js'
import noteManager from './noteManager.js'
import mediaManager from './mediaManager.js'
import { createRender } from '../render/renderDefault.js'
import { StudyEngine } from './studyEngine.js'
import { log } from '../../../utils/logger.js'
import { getTemplate, addTemplate, removeTemplate, getTemplates } from './template/index.js'
import _ from 'lodash'

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
  createRender,
  StudyEngine,

  getTemplate,
  addTemplate,
  removeTemplate,
  getTemplates,

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
