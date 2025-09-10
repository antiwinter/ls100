import noteManager from './noteManager'
import cardGen from './cardGen'
import mediaManager from './mediaManager'
import db from '../storage/db.js'
import { log } from '../../../utils/logger'

// Main API for Anki operations
export class AnkiApi {
  constructor() {
    this.noteManager = noteManager
    this.cardGen = cardGen
  }

  // Create note with cards
  async createNote(bundleId, fields, tags) {
    // Create note
    const note = await this.noteManager.create(bundleId, fields, tags)

    // Generate cards
    const cards = await this.cardGen.genCardsForNote(note.id, bundleId)

    return { note, cards }
  }


  // Get rendered card for study
  async getStudyCard(cardId) {
    return await this.cardGen.renderCard(cardId)
  }

  // Get cards for bundle
  async getCardsForBundle(bundleId) {
    return await this.cardGen.getCardsForBundle(bundleId)
  }

  // Get all cards for bundles (efficient Dexie query)
  async getCardsForBundles(bundleIds) {
    if (!bundleIds || bundleIds.length === 0) {
      log.debug('No bundleIds provided')
      return []
    }

    return await db.cards.where('bundleId').anyOf(bundleIds).toArray()
  }

  // Cleanup all data for bundle IDs
  async cleanupBundles(bundleIds) {
    let totalCards = 0
    const allNoteIds = new Set()

    // Delete all cards for these bundles
    for (const bundleId of bundleIds) {
      const cards = await this.cardGen.getCardsForBundle(bundleId)
      totalCards += cards.length

      for (const card of cards) {
        allNoteIds.add(card.noteId)
        await this.cardGen.deleteCard(card.id)
      }
    }

    // Clean up orphaned notes (notes with no remaining cards)
    let notesRemoved = 0
    for (const noteId of allNoteIds) {
      // Check if note has any remaining cards
      const allCards = await this.cardGen.getAllCards()
      const hasRemainingCards = allCards.some(c => c.noteId === noteId)
      if (!hasRemainingCards) {
        await this.noteManager.delete(noteId)
        notesRemoved++
      }
    }

    log.debug('Bundles cleanup completed:', {
      bundleIds,
      cards: totalCards,
      notes: notesRemoved
    })

    return {
      cardsRemoved: totalCards,
      notesRemoved
    }
  }




  // Get media statistics for multiple bundles
  async getMediaStatsForBundles(bundleIds) {
    return await mediaManager.getMediaStatsForBundles(bundleIds)
  }
}

// Singleton instance
export const ankiApi = new AnkiApi()
export default ankiApi
