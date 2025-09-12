import db from './db.js'
import { log } from '../../../utils/logger'
import { genNvId } from '../../../utils/idGenerator.js'
import mediaManager from './mediaManager.js'

// Note manager for Anki collection
export class NoteManager {
  constructor() {
    this.STORES = {
      notes: 'notes',
      bundles: 'bundles',
      templates: 'templates'
    }
  }

  // Create new note with cooked fields (for APKG import)
  async create(bundleId, fields, tags = []) {
    const bundle = await db.bundles.get(bundleId)
    if (!bundle) throw new Error(`NoteType not found: ${bundleId}`)

    // Fields should already be cooked (contain NvIds) when passed in
    const note = {
      id: await genNvId('note', bundleId + fields.join('') + tags.join('')),
      bundleId,
      fields: fields.slice(0, bundle.fields.length), // Ensure correct field count
      tags,
      refCount: 0,
      created: Date.now(),
      modified: Date.now()
    }

    await db.notes.put(note)

    // Retain media references from cooked fields
    for (const field of note.fields) {
      await mediaManager.retainMedia(field)
    }

    return note
  }

  // Get note by id
  async get(noteId) {
    return await db.notes.get(noteId)
  }

  // Update note fields (expects cooked fields with NvIds)
  async update(noteId, fields, tags) {
    const note = await this.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    // Handle media refCount updates if fields changed
    if (fields !== undefined) {
      // Remove old media references from existing cooked fields
      for (const field of note.fields) {
        await mediaManager.removeMedia(field)
      }

      // Retain media references from new cooked fields
      for (const field of fields) {
        await mediaManager.retainMedia(field)
      }
    }

    const updates = { modified: Date.now() }
    if (fields !== undefined) updates.fields = fields
    if (tags !== undefined) updates.tags = tags

    const updated = { ...note, ...updates }
    await db.notes.put(updated)
    log.debug('Note updated:', noteId)
    return updated
  }


  // Delete note directly
  async delete(noteId) {
    await this.cleanup(noteId)
    log.debug('Note deleted:', noteId)
  }

  // Cleanup note and related data
  async cleanup(noteId) {
    // Get note before deletion to remove media references
    const note = await this.get(noteId)
    if (note) {
      // Remove media references from all fields
      for (const field of note.fields) {
        await mediaManager.removeMedia(field)
      }
    }

    // Delete note
    await db.notes.delete(noteId)

    // Delete related cards
    await db.cards.where('noteId').equals(noteId).delete()

    log.debug('Note and cards cleaned up:', noteId)
  }



}

// Singleton instance
export const noteManager = new NoteManager()
export default noteManager
