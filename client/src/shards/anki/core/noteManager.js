import db from '../storage/db.js'
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
    const bundle = await this.getType(bundleId)
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

  // Add reference (increment refCount) - for compatibility
  async addRef(noteId) {
    const note = await this.get(noteId)
    if (!note) throw new Error(`Note not found: ${noteId}`)

    note.refCount = (note.refCount || 0) + 1
    await db.notes.put(note)
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
      await db.notes.put(note)
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

  // Get bundle
  async getType(bundleId) {
    return await db.bundles.get(bundleId)
  }

  // Create bundle
  async createType(id, name, fields) {
    const bundle = { id, name, fields, created: Date.now() }
    await db.bundles.put(bundle)
    return bundle
  }

  // Get templates for bundle
  async getTemplates(bundleId) {
    return await db.templates.where('bundleId').equals(bundleId).toArray()
  }

  // Create template with cooked formats (for APKG import)
  async createTemplate(bundleId, name, qfmt, afmt, ord = 0, vdeck = null) {
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


}

// Singleton instance
export const noteManager = new NoteManager()
export default noteManager
