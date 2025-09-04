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
  async createNote(typeId, fields, tags, deckId) {
    // Create note
    const note = await this.noteManager.create(typeId, fields, tags)

    // Generate cards
    const cards = await this.cardGen.genCardsForNote(note.id, deckId)

    return { note, cards }
  }


  // Get rendered card for study
  async getStudyCard(cardId) {
    return await this.cardGen.renderCard(cardId)
  }

  // Get cards for deck
  async getCardsForDeck(deckId) {
    return await this.cardGen.getCardsForDeck(deckId)
  }

  // Get all cards for decks (efficient Dexie query)
  async getCardsForDecks(deckIds) {
    if (!deckIds || deckIds.length === 0) {
      log.debug('No deckIds provided')
      return []
    }

    return await db.cards.where('deckId').anyOf(deckIds).toArray()
  }

  // Cleanup all data for deck IDs
  async cleanupDecks(deckIds) {
    let totalCards = 0
    const allNoteIds = new Set()

    // Delete all cards for these decks
    for (const deckId of deckIds) {
      const cards = await this.cardGen.getCardsForDeck(deckId)
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

    log.debug('Decks cleanup completed:', {
      deckIds,
      cards: totalCards,
      notes: notesRemoved
    })

    return {
      cardsRemoved: totalCards,
      notesRemoved
    }
  }




  // Get media statistics for multiple decks
  async getMediaStatsForDecks(deckIds) {
    return await mediaManager.getMediaStatsForDecks(deckIds)
  }
}

// Singleton instance
export const ankiApi = new AnkiApi()
export default ankiApi
