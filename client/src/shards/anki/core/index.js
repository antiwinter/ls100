import db from './db.js'
import noteManager from './noteManager.js'
import mediaManager from './mediaManager.js'
import { render } from './renderDefault.js'
import { StudyEngine } from './studyEngine.js'
import { log } from '../../../utils/logger.js'
import { genNvId } from '../../../utils/idGenerator.js'


// Remove a template and its media references
async function _removeTemplate(template) {
  if (!template) return false

  // Remove media references from template formats
  await mediaManager.removeMedia(template.qfmt)
  await mediaManager.removeMedia(template.afmt)
  // Remove template from database
  await db.templates.delete(template.id)
  log.debug('Removed template:', template.id)
  return true
}

// Clean up orphaned data whose bundles no longer exist (internal)
async function _cleanupOrphans() {
  // Get all remaining bundle IDs using iteration
  const validBundleIds = new Set()
  await db.bundles.each((bundle) => {
    validBundleIds.add(bundle.id)
  })

  const stats = {
    templatesRemoved: 0,
    notesRemoved: 0,
    cardsRemoved: 0
  }

  // Clean up orphaned templates using iteration
  await db.templates.each(async (template) => {
    if (!validBundleIds.has(template.bundleId)) {
      await _removeTemplate(template)
      stats.templatesRemoved++
    }
  })

  // Clean up orphaned notes using iteration
  await db.notes.each(async (note) => {
    if (!validBundleIds.has(note.bundleId)) {
      await noteManager.delete(note) // Handles media cleanup
      stats.notesRemoved++
      log.debug('Removed orphaned note:', note)
    }
  })

  // Clean up orphaned cards using iteration
  await db.cards.each(async (card) => {
    if (!validBundleIds.has(card.bundleId)) {
      await db.cards.delete(card.id)
      stats.cardsRemoved++
      log.debug('Removed orphaned card:', card)
    }
  })

  return stats
}

export const anki = {
  noteManager,
  mediaManager,
  render,
  StudyEngine,

  // Add template to bundle
  async  addTemplate(bundleId, name, qfmt, afmt, ord = 0, vdeck = null) {
    const template = {
      id: await genNvId('template', bundleId + name + qfmt + afmt),
      bundleId,
      name,
      qfmt,
      afmt,
      ord,
      vdeck,
      created: Date.now()
    }
    await db.templates.put(template)

    // Retain media references from cooked template formats
    await mediaManager.retainMedia(qfmt)
    await mediaManager.retainMedia(afmt)

    return template
  },

  async  getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  },

  async removeTemplate(tp) {
    _removeTemplate(tp)
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
  async  addBundle(id, name, fields) {
    const bundle = {
      id,
      name,
      fields, // Array of field definitions
      created: Date.now(),
      modified: Date.now()
    }
    await db.bundles.put(bundle)
    log.debug('Bundle created:', id)
    return bundle
  }

  // No default export needed - use named exports directly
}
