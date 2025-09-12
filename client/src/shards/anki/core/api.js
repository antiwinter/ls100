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

  // Public bundle access
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
        // Test if card can be rendered (has content)
        const rendered = await this.cardRender.render(card)
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
    let totalCards = 0
    const allNoteIds = new Set()

    // Get all cards for these bundles
    const cards = await this.getCardsForBundles(normalizedBundleIds)
    totalCards = cards.length

    // Collect note IDs and delete cards
    for (const card of cards) {
      allNoteIds.add(card.noteId)
    }

    // Delete all cards for these bundles in batch
    await db.cards.where('bundleId').anyOf(normalizedBundleIds).delete()

    // Clean up orphaned notes (notes with no remaining cards)
    let notesRemoved = 0
    for (const noteId of allNoteIds) {
      // Check if note has any remaining cards using direct db query
      const remainingCardCount = await db.cards.where('noteId').equals(noteId).count()
      if (remainingCardCount === 0) {
        await this.noteManager.delete(noteId)
        notesRemoved++
      }
    }

    log.debug('Bundles cleanup completed:', {
      bundleIds: normalizedBundleIds,
      cards: totalCards,
      notes: notesRemoved
    })

    return {
      cardsRemoved: totalCards,
      notesRemoved
    }
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
