import noteManager from './noteManager'
import cardGen from './cardGen'
import mediaManager from './mediaManager'
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

    log.debug('Note created with cards:', { noteId: note.id, cardCount: cards.length })
    return { note, cards }
  }

  // Update note (affects all related cards)
  async updateNote(noteId, fields, tags) {
    const note = await this.noteManager.update(noteId, fields, tags)
    log.debug('Note updated:', noteId)
    return note
  }

  // Add note to deck (share existing note)
  async addNoteToDeck(noteId, deckId) {
    const cards = await this.cardGen.genCardsForNote(noteId, deckId)
    log.debug('Note added to deck:', { noteId, deckId, cardCount: cards.length })
    return cards
  }

  // Remove note from deck
  async removeNoteFromDeck(noteId, deckId) {
    // Get cards for this deck that belong to this note
    const cards = await this.cardGen.getCardsForDeck(deckId)
    const noteCards = cards.filter(c => c.noteId === noteId)

    // Delete only cards for this note in this deck
    for (const card of noteCards) {
      await this.cardGen.deleteCard(card.id)
    }

    log.debug('Note removed from deck:', { noteId, deckId, deletedCards: noteCards.length })
    return noteCards.length
  }

  // Get rendered card for study
  async getStudyCard(cardId) {
    return await this.cardGen.renderCard(cardId)
  }

  // Update card after study
  async updateCardScheduling(cardId, scheduling) {
    return await this.cardGen.updateCard(cardId, scheduling)
  }

  // Get cards for deck
  async getCardsForDeck(deckId) {
    return await this.cardGen.getCardsForDeck(deckId)
  }

  // Get cards due for study
  async getDueCards(deckId, limit = 20) {
    const cards = await this.cardGen.getCardsForDeck(deckId)
    const now = Date.now()
    const parseDue = d => (typeof d === 'string' ? Date.parse(d) : d)
    const due = cards.filter(c => parseDue(c.due) <= now)
      .sort((a, b) => parseDue(a.due) - parseDue(b.due))
      .slice(0, limit)
    return due
  }

  // Get all cards for deck IDs (used by shards)
  async getCardsForDeckIds(deckIds) {
    const allCards = []
    for (const deckId of deckIds) {
      const cards = await this.cardGen.getCardsForDeck(deckId)
      allCards.push(...cards)
    }
    return allCards
  }

  // Get all cards for a shard (legacy method - now uses deckIds)
  async getCardsForShard(shardId) {
    // This is a legacy method that should be replaced by getCardsForDeckIds
    // For now, we'll return empty array since we don't store shardId anymore
    log.warn('getCardsForShard is deprecated, use getCardsForDeckIds instead')
    return []
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

  // Cleanup all data for a shard (legacy method)
  async cleanupShard(shardId) {
    log.warn('cleanupShard is deprecated, use cleanupDecks instead')
    return { cardsRemoved: 0, notesRemoved: 0 }
  }

  // Batch operations for import
  async batchImport(notes, deckId) {
    const results = []

    for (const noteData of notes) {
      const result = await this.createNote(
        noteData.typeId,
        noteData.fields,
        noteData.tags || [],
        deckId
      )
      results.push(result)
    }

    log.debug('Batch import completed:', { count: results.length, deckId })
    return results
  }

  // Get media statistics for a shard
  async getMediaStats(shardId) {
    return await mediaManager.getMediaStats(shardId)
  }


}

// Singleton instance
export const ankiApi = new AnkiApi()
export default ankiApi
