import db from './db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import mediaManager from './mediaManager.js'
import { render } from '../render/renderDefault.js'
import { checkEligibility } from '../template/index.js'

// Create new note
async function _create(bundleId, fields, tags = [], media = {}) {
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${bundleId}`)

  // Extract media from fields
  const { anki } = await import('./index.js')
  const result = await anki.findMedia(fields, media)


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
  if (result.media.length > 0) {
    await mediaManager.add(result.media, { noteId: note.id })
  }

  return note
}


// Generate cards for note in specific bundle (standalone function)
async function _genCardsForNote(note) {
  const bundle = await db.bundles.get(note.bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${note.bundleId}`)

  const templates = await db.templates.where('bundleId').equals(note.bundleId).toArray()
  const cards = []

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
      // Check Anki conditional requirements before rendering
      if (!checkEligibility(template, { fieldValues: note.fields, fieldDefs: bundle.fields })) {
        // log.debug(`Skipping card for template ${template.ord
        // }: conditional field requirements not met`)
        continue
      }

      // Test if card can be rendered (has content) - pass pre-fetched data
      const rendered = await render(card, { note, bundle, template })
      // Check if front has meaningful content
      const frontContent = rendered.front?.trim()
      if (frontContent && frontContent.length > 0) {
        await db.cards.put(card)
        cards.push(card)
      } else {
        // TODO: test and see if this enters
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

  // Handle media refCount updates if fields changed
  if (fields !== undefined) {
    // Extract media from old and new fields
    const { anki } = await import('./index.js')
    const oldResult = await anki.findMedia(note.fields, {})
    const newResult = await anki.findMedia(fields, media)


    // Get old and new filenames for comparison
    const oldFilenames = oldResult.media.map(m => m.filename)
    const newFilenames = newResult.media.map(m => m.filename)

    // Remove old media that's no longer referenced
    const toRemove = oldFilenames.filter(f => !newFilenames.includes(f))
    if (toRemove.length > 0) {
      await mediaManager.remove(toRemove, { noteId })
    }

    // Add new media references (only truly new ones)
    const toAdd = newFilenames.filter(f => !oldFilenames.includes(f))
    if (toAdd.length > 0) {
      const newMediaToAdd = newResult.media.filter(m => toAdd.includes(m.filename))
      await mediaManager.add(newMediaToAdd, { noteId })
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
    const result = await anki.findMedia(note.fields, {})
    const filenames = result.media.map(m => m.filename)
    if (filenames.length > 0) {
      await mediaManager.remove(filenames, { noteId: note.id })
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
