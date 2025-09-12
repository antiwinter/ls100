import noteManager from './noteManager.js'
import cardRender from './renderDefault.js'
import mediaManager from './mediaManager.js'
import db from './db.js'
import { log } from '../../../utils/logger.js'
import { genNvId, genId } from '../../../utils/idGenerator.js'

// Main API for Anki operations
export class AnkiApi {
  constructor() {
    this.noteManager = noteManager
    this.cardRender = cardRender
  }

  async getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  }

  async getBundle(bundleId) {
    return await db.bundles.get(bundleId)
  }

  // Add note with cards
  async addNote(bundleId, fields, tags) {
    // Create note
    const note = await this.noteManager.create(bundleId, fields, tags)

    // Generate cards
    const cards = await this.genCardsForNote(note)

    return { note, cards }
  }

  // Generate cards for note in specific bundle
  async genCardsForNote(note) {
    const bundle = await this.getBundle(note.bundleId)
    if (!bundle) throw new Error(`NoteType not found: ${note.bundleId}`)

    const templates = await this.getTemplates(note.bundleId)
    const cards = []

    for (const template of templates) {
      const now = Date.now()
      const card = {
        id: await genId('card', note.id + template.ord + note.bundleId),
        noteId: note.id,
        templateOrd: template.ord,
        bundleId: note.bundleId,
        // Default scheduling
        due: now,
        state: 'New', // FSRS state mirrored for fast queries
        // FSRS progress stored with the card
        fsrs: null,
        created: now,
        modified: now
      }

      try {
        // Test if card can be rendered (has content) - pass pre-fetched data
        const rendered = await this.cardRender.render(card, { note, bundle, template })
        // Check if question has meaningful content
        const questionContent = rendered.question?.trim()
        if (questionContent && questionContent.length > 0) {
          await db.cards.put(card)
          cards.push(card)
        }
      } catch (error) {
        // Card cannot be rendered, skip it
        log.debug(`Skipping card for template ${template.ord}: render failed`, error.message)
      }
    }

    return cards
  }



  // Get cards for bundles (supports both single bundleId and array)
  async getCardsForBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    if (normalizedBundleIds.length === 0) {
      log.debug('No bundleIds provided')
      return []
    }

    return await db.cards.where('bundleId').anyOf(normalizedBundleIds).toArray()
  }

  // Remove all data for bundle IDs
  async removeBundles(bundleIds) {
    const normalizedBundleIds = [].concat(bundleIds || [])
    // 1. Remove the bundles first
    let bundlesRemoved = 0
    for (const bundleId of normalizedBundleIds) {
      const bundleExists = await db.bundles.get(bundleId)
      if (bundleExists) {
        await db.bundles.delete(bundleId)
        bundlesRemoved++
      }
    }

    // 2. Clean up all orphaned data (templates, notes, cards become orphans)
    const orphanStats = await this._cleanupOrphans()

    const totalStats = {
      bundlesRemoved,
      ...orphanStats
    }

    log.debug('Bundles removal completed:', {
      bundleIds: normalizedBundleIds,
      ...totalStats
    })

    return totalStats
  }

  // Remove a template and its media references
  async removeTemplate(template) {
    if (!template) return false

    // Remove media references from template formats
    await mediaManager.removeMedia(template.qfmt)
    await mediaManager.removeMedia(template.afmt)
    // Remove template from database
    await db.templates.delete(template.id)
    log.debug('Removed template:', template.id)
    return true
  }

  // Clean up orphaned data whose bundles no longer exist
  async _cleanupOrphans() {
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
        await this.removeTemplate(template)
        stats.templatesRemoved++
        log.debug('Removed orphaned template:', template)
      }
    })

    // Clean up orphaned notes using iteration
    await db.notes.each(async (note) => {
      if (!validBundleIds.has(note.bundleId)) {
        await this.noteManager.delete(note) // Handles media cleanup
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


  // Add template to bundle
  async addTemplate(bundleId, name, qfmt, afmt, ord = 0, vdeck = null) {
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
  }

  // Add bundle/NoteType
  async addBundle(id, name, fields) {
    const bundle = { id, name, fields, created: Date.now() }
    await db.bundles.put(bundle)
    return bundle
  }
}

// Singleton instance
export const ankiApi = new AnkiApi()
export default ankiApi
