import { idb } from '../storage/storageManager'
import { noteManager } from './noteManager'
import TemplateRenderer, { TemplateEngine } from './templateEngine'
import { log } from '../../../utils/logger'

// Card generation from notes + templates
export class CardGenerator {
  // Generate cards for note in specific deck/shard
  async genCardsForNote(noteId, deckId, shardId) {
    const note = await noteManager.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    const noteType = await noteManager.getType(note.typeId)
    if (!noteType) throw new Error(`NoteType not found: ${note.typeId}`)

    const templates = await noteManager.getTemplates(note.typeId)
    const engine = new TemplateEngine(noteType)
    const cards = []

    for (const template of templates) {
      if (engine.wouldRender(template.qfmt, note.fields)) {
        const card = {
          id: this.genId(),
          noteId,
          templateIdx: template.idx,
          deckId,
          shardId,
          // Default scheduling
          due: Date.now(),
          interval: 1,
          ease: 2500,
          reps: 0,
          lapses: 0,
          created: Date.now(),
          modified: Date.now()
        }

        await idb.put('cards', card)
        cards.push(card)
      }
    }

    log.debug('Cards generated for note:', noteId, 'count:', cards.length)
    return cards
  }

  // Render card content for study with media support
  async renderCard(cardId) {
    const card = await idb.get('cards', cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)

    const note = await noteManager.get(card.noteId)
    const noteType = await noteManager.getType(note.typeId)
    const templates = await noteManager.getTemplates(note.typeId)
    const template = templates.find(t => t.idx === card.templateIdx)

    if (!template) throw new Error(`Template not found: ${card.templateIdx}`)

    // Use new TemplateRenderer with media support
    const renderer = new TemplateRenderer(noteType)
    const rendered = await renderer.render(template, note.fields, card.shardId)

    return {
      id: card.id,
      question: rendered.question,
      answer: rendered.answer,
      template: template.name,
      note: {
        id: note.id,
        fields: note.fields,
        tags: note.tags
      }
    }
  }

  // Update card scheduling after study
  async updateCard(cardId, { interval, ease, due, reps, lapses }) {
    const card = await idb.get('cards', cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)

    const updates = { modified: Date.now() }
    if (interval !== undefined) updates.interval = interval
    if (ease !== undefined) updates.ease = ease
    if (due !== undefined) updates.due = due
    if (reps !== undefined) updates.reps = reps
    if (lapses !== undefined) updates.lapses = lapses

    const updated = { ...card, ...updates }
    await idb.put('cards', updated)
    return updated
  }

  // Get cards for deck
  async getCardsForDeck(deckId) {
    return await idb.query('cards', 'deckId', deckId)
  }

  // Get cards for shard
  async getCardsForShard(shardId) {
    return await idb.query('cards', 'shardId', shardId)
  }

  // Delete cards for note
  async deleteCardsForNote(noteId) {
    const cards = await idb.query('cards', 'noteId', noteId)
    for (const card of cards) {
      await idb.delete('cards', card.id)
    }
    return cards.length
  }

  // Delete single card
  async deleteCard(cardId) {
    await idb.delete('cards', cardId)
    log.debug('Card deleted:', cardId)
  }

  genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
}

// Singleton instance
export const cardGen = new CardGenerator()
export default cardGen
