import db from '../storage/db.js'
import { noteManager } from './noteManager'
import TemplateRenderer, { TemplateEngine } from './templateEngine'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'

// Card generation from notes + templates
export class CardGenerator {
  // Generate cards for note in specific deck
  async genCardsForNote(noteId, deckId) {
    const note = await noteManager.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    const noteType = await noteManager.getType(note.typeId)
    if (!noteType) throw new Error(`NoteType not found: ${note.typeId}`)

    const templates = await noteManager.getTemplates(note.typeId)
    const engine = new TemplateEngine(noteType)
    const cards = []

    for (const template of templates) {
      if (engine.wouldRender(template.qfmt, note.fields)) {
        const now = Date.now()
        const card = {
          id: await genId('card', noteId + template.idx + deckId),
          noteId,
          templateIdx: template.idx,
          deckId,
          // Default scheduling
          due: now,
          interval: 1,
          ease: 2500,
          reps: 0,
          lapses: 0,
          // FSRS progress stored with the card
          fsrs: null,
          created: now,
          modified: now
        }

        await db.cards.put(card)
        cards.push(card)
      }
    }

    return cards
  }

  // Render card content for study with media support
  async renderCard(cardId) {
    const card = await db.cards.get(cardId)
    if (!card) throw new Error(`Card not found: ${cardId}`)

    const note = await noteManager.get(card.noteId)
    const noteType = await noteManager.getType(note.typeId)
    const templates = await noteManager.getTemplates(note.typeId)
    const template = templates.find(t => t.idx === card.templateIdx)

    if (!template) throw new Error(`Template not found: ${card.templateIdx}`)

    // Use new TemplateRenderer with media support
    const renderer = new TemplateRenderer(noteType)
    const rendered = await renderer.render(template, note.fields, card.deckId)

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
    const updates = { modified: Date.now() }
    if (interval !== undefined) updates.interval = interval
    if (ease !== undefined) updates.ease = ease
    if (due !== undefined) updates.due = due
    if (reps !== undefined) updates.reps = reps
    if (lapses !== undefined) updates.lapses = lapses

    await db.cards.update(cardId, updates)
    return await db.cards.get(cardId)
  }

  // Get cards for deck
  async getCardsForDeck(deckId) {
    return await db.cards.where('deckId').equals(deckId).toArray()
  }

  // Get all cards
  async getAllCards() {
    return await db.cards.toArray()
  }

  // Delete cards for note
  async deleteCardsForNote(noteId) {
    const cards = await db.cards.where('noteId').equals(noteId).toArray()
    await db.cards.where('noteId').equals(noteId).delete()
    return cards.length
  }

  // Delete single card
  async deleteCard(cardId) {
    await db.cards.delete(cardId)
    log.debug('Card deleted:', cardId)
  }


}

// Singleton instance
export const cardGen = new CardGenerator()
export default cardGen
