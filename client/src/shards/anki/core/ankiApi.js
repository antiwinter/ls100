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
  async createNote(typeId, fields, tags, deckId, shardId) {
    // Create note
    const note = await this.noteManager.create(typeId, fields, tags)

    // Add ref for this shard
    await this.noteManager.addRef(note.id, shardId)

    // Generate cards
    const cards = await this.cardGen.genCardsForNote(note.id, deckId, shardId)

    log.debug('Note created with cards:', { noteId: note.id, cardCount: cards.length })
    return { note, cards }
  }

  // Update note (affects all related cards)
  async updateNote(noteId, fields, tags) {
    const note = await this.noteManager.update(noteId, fields, tags)
    log.debug('Note updated:', noteId)
    return note
  }

  // Add note to shard (share existing note)
  async addNoteToShard(noteId, deckId, shardId) {
    await this.noteManager.addRef(noteId, shardId)
    const cards = await this.cardGen.genCardsForNote(noteId, deckId, shardId)
    log.debug('Note added to shard:', { noteId, shardId, cardCount: cards.length })
    return cards
  }

  // Remove note from shard
  async removeNoteFromShard(noteId, shardId) {
    // Delete cards for this shard
    const cards = await this.cardGen.getCardsForShard(shardId)
    const noteCards = cards.filter(c => c.noteId === noteId)

    // Delete all cards for this note (single call with noteId)
    await this.cardGen.deleteCardsForNote(noteId)

    // Remove ref (cleanup if refCount = 0)
    await this.noteManager.removeRef(noteId, shardId)

    log.debug('Note removed from shard:', { noteId, shardId })
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

  // Get all cards for a shard
  async getCardsForShard(shardId) {
    return await this.cardGen.getCardsForShard(shardId)
  }

  // Cleanup all data for a shard
  async cleanupShard(shardId) {
    // Get all cards for this shard
    const cards = await this.cardGen.getCardsForShard(shardId)
    const noteIds = [...new Set(cards.map(c => c.noteId))]

    // Delete all cards for this shard
    for (const card of cards) {
      await this.cardGen.deleteCard(card.id)
    }

    // Remove note refs and cleanup orphaned notes
    for (const noteId of noteIds) {
      await this.noteManager.removeRef(noteId, shardId)
    }

    // Clean up media files for this shard
    const mediaFilesRemoved = await mediaManager.removeShardMedia(shardId)

    log.debug('Shard cleanup completed:', {
      shardId,
      cards: cards.length,
      notes: noteIds.length,
      mediaFiles: mediaFilesRemoved
    })

    return {
      cardsRemoved: cards.length,
      notesProcessed: noteIds.length,
      mediaFilesRemoved
    }
  }

  // Batch operations for import
  async batchImport(notes, deckId, shardId) {
    const results = []

    for (const noteData of notes) {
      const result = await this.createNote(
        noteData.typeId,
        noteData.fields,
        noteData.tags || [],
        deckId,
        shardId
      )
      results.push(result)
    }

    log.debug('Batch import completed:', { count: results.length, deckId, shardId })
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
