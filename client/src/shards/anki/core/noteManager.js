import { idb } from '../storage/storageManager'
import { log } from '../../../utils/logger'
import { genNvId } from '../../../utils/idGenerator.js'

// Note manager for Anki collection
export class NoteManager {
  constructor() {
    this.STORES = {
      notes: 'notes',
      noteTypes: 'noteTypes',
      templates: 'templates'
    }
  }

  // Create new note
  async create(typeId, fields, tags = []) {
    const noteType = await this.getType(typeId)
    if (!noteType) throw new Error(`NoteType not found: ${typeId}`)

    const note = {
      id: await genNvId('note', typeId + fields.join('') + tags.join('')),
      typeId,
      fields: fields.slice(0, noteType.fields.length), // Ensure correct field count
      tags,
      refCount: 0,
      created: Date.now(),
      modified: Date.now()
    }

    await idb.put(this.STORES.notes, note)

    return note
  }

  // Get note by id
  async get(noteId) {
    return await idb.get(this.STORES.notes, noteId)
  }

  // Update note fields
  async update(noteId, fields, tags) {
    const note = await this.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    const updates = { modified: Date.now() }
    if (fields !== undefined) updates.fields = fields
    if (tags !== undefined) updates.tags = tags

    const updated = { ...note, ...updates }
    await idb.put(this.STORES.notes, updated)
    log.debug('Note updated:', noteId)
    return updated
  }

  // Add reference (increment refCount) - for compatibility
  async addRef(noteId) {
    const note = await this.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    note.refCount = (note.refCount || 0) + 1
    await idb.put(this.STORES.notes, note)
    log.debug('Note ref added:', noteId, 'refCount:', note.refCount)
    return note
  }

  // Remove reference (decrement refCount, cleanup if 0) - for compatibility
  async removeRef(noteId) {
    const note = await this.get(noteId)
    if (!note) return

    note.refCount = Math.max(0, (note.refCount || 1) - 1)

    if (note.refCount === 0) {
      // Cleanup note and related cards
      await this.cleanup(noteId)
      log.debug('Note cleaned up:', noteId)
    } else {
      await idb.put(this.STORES.notes, note)
      log.debug('Note ref removed:', noteId, 'refCount:', note.refCount)
    }
  }

  // Delete note directly
  async delete(noteId) {
    await this.cleanup(noteId)
    log.debug('Note deleted:', noteId)
  }

  // Cleanup note and related data
  async cleanup(noteId) {
    // Delete note
    await idb.delete(this.STORES.notes, noteId)

    // Delete related cards
    const cards = await idb.query('cards', 'noteId', noteId)
    for (const card of cards) {
      await idb.delete('cards', card.id)
    }

    log.debug('Note and cards cleaned up:', noteId)
  }

  // Get noteType
  async getType(typeId) {
    return await idb.get(this.STORES.noteTypes, typeId)
  }

  // Create noteType
  async createType(id, name, fields) {
    const noteType = { id, name, fields, created: Date.now() }
    await idb.put(this.STORES.noteTypes, noteType)
    return noteType
  }

  // Get templates for noteType
  async getTemplates(typeId) {
    return await idb.query(this.STORES.templates, 'typeId', typeId)
  }

  // Create template
  async createTemplate(typeId, name, qfmt, afmt, idx = 0) {
    const template = {
      id: await genNvId('template', typeId + name + qfmt + afmt),
      typeId,
      name,
      qfmt,
      afmt,
      idx,
      created: Date.now()
    }
    await idb.put(this.STORES.templates, template)
    return template
  }


}

// Singleton instance
export const noteManager = new NoteManager()
export default noteManager
