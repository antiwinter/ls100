import db from './db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import mediaManager from './mediaManager.js'
import { AnkiRender } from '../template/index.js'
import _ from 'lodash'

// Create new note
async function _create(bundleId, fields, tags = [], media = {}) {
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${bundleId}`)

  // Extract media from fields
  const { anki } = await import('./index.js')
  const filenames = await anki.findMedia(fields)


  const note = {
    id: genId('note', bundleId + fields.join('') + tags.join('')),
    bundleId,
    fields,
    tags,
    refCount: 0,
    created: Date.now(),
    modified: Date.now()
  }

  await db.notes.put(note)

  // Add media references
  if (filenames.length > 0) {
    const mediaObject = _.pick(media, filenames)
    await mediaManager.add(bundleId, note.id, mediaObject)
  }

  return note
}


// Generate cards for note in specific bundle (standalone function)
async function _genCardsForNote(note) {
  const bundle = await db.bundles.get(note.bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${note.bundleId}`)

  const templates = await db.templates.where('bundleId').equals(note.bundleId).toArray()
  const cards = []

  // Create renderer without f2nvid (no media resolution needed for card generation)
  const renderer = new AnkiRender({
    fieldDefs: bundle.fields,
    css: bundle.css,
    templates,
    f2nvid: {} // Empty - we're only checking front validity, not rendering media
  })

  for (const template of templates) {
    const now = Date.now()
    const card = {
      id: genId('card', note.id + template.ord + note.bundleId),
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
      // Test if card can be rendered (has content) by trying to render it
      const rendered = renderer.render(note, template.ord)
      // Check if front has meaningful content
      const frontContent = rendered.front?.trim()
      if (frontContent && frontContent.length > 0) {
        await db.cards.put(card)
        cards.push(card)
      } else {
        // Skip empty cards
        log.debug(`Skipping card for template ${template.ord}: front is empty`)
      }
    } catch (error) {
      // Card cannot be rendered, skip it
      log.debug(`Skipping card for template ${template.ord}: render failed`, error.message)
    }
  }

  return cards
}

// Add note with cards - automatically generates cards for the note
async function create(bundleId, fields, tags, media = {}) {
  // Create note
  const note = await _create(bundleId, fields, tags, media)

  // Generate cards
  const cards = await _genCardsForNote(note)

  return { note, cards }
}

// Get note by id
async function get(noteId) {
  return await db.notes.get(noteId)
}

// Update note fields
async function update(noteId, fields, tags, media = {}) {
  const note = await get(noteId)
  if (!note) throw new Error(`Note not found: ${noteId}`)

  // Handle media updates using set theory approach
  if (media && Object.keys(media).length > 0) {
    // 1. Get all filenames currently owned by this note
    const ownedMedia = await db.media.where('bundleId').equals(note.bundleId)
      .and(ref => ref.userId === noteId).toArray()
    const ownedFilenames = ownedMedia.map(ref => ref.filename)

    // 2. media is already a filename->blob object
    const mediaFilenames = Object.keys(media)

    // 3. Remove U_filenames \ U_media (owned but not in new media)
    const toRemove = ownedFilenames.filter(f => !mediaFilenames.includes(f))
    if (toRemove.length > 0) {
      await mediaManager.remove(note.bundleId, noteId, toRemove)
    }

    // 4. Add U_media \ U_filenames (in new media but not owned)
    const toAdd = mediaFilenames.filter(f => !ownedFilenames.includes(f))
    if (toAdd.length > 0) {
      const mediaToAdd = _.pick(media, toAdd)
      await mediaManager.add(note.bundleId, noteId, mediaToAdd)
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

// Delete note and related data
async function delete_(note) {
  if (note) {
    // Remove media references from all fields
    const { anki } = await import('./index.js')
    const filenames = await anki.findMedia(note.fields)
    if (filenames.length > 0) {
      await mediaManager.remove(note.bundleId, note.id, filenames)
    }
  }

  // Delete note
  await db.notes.delete(note.id)

  // Delete related cards
  await db.cards.where('noteId').equals(note.id).delete()

  // log.debug('Note deleted:', note.id)
}

// No default export needed - use named exports directly
export default {
  create,
  get,
  update,
  delete: delete_
}
