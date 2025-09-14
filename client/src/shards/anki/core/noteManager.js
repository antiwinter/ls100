import db from './db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import mediaManager from '../../../utils/mediaManager.js'
import { render } from './renderDefault.js'

// Create new note with cooked fields (for APKG import)
async function _create(bundleId, fields, tags = []) {
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${bundleId}`)

  // Fields should already be cooked (contain NvIds) when passed in
  const note = {
    id: await genId('note', bundleId + fields.join('') + tags.join('')),
    bundleId,
    fields: fields.slice(0, bundle.fields.length), // Ensure correct field count
    tags,
    refCount: 0,
    created: Date.now(),
    modified: Date.now()
  }

  await db.notes.put(note)

  // Add media references (fields should already be cooked with nvIds)
  const { anki } = await import('./index.js')
  const result = await anki.parseFields(note.fields, {})
  if (result.media.length > 0) {
    await mediaManager.add(result.media)
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
      id: await genId('card', note.id + template.ord + note.bundleId),
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
      // Test if card can be rendered (has content) - pass pre-fetched data
      const rendered = await render(card, { note, bundle, template })
      // Check if question has meaningful content
      const questionContent = rendered.question?.trim()
      if (questionContent && questionContent.length > 0) {
        await db.cards.put(card)
        cards.push(card)
      }
    } catch (error) {
      // Card cannot be rendered, skip it
      log.debug(`Skipping card for template ${template.ord}: render failed`, error.message)
    }
  }

  return cards
}

// Add note with cards - automatically generates cards for the note
async function create(bundleId, fields, tags) {
  // Create note
  const note = await _create(bundleId, fields, tags)

  // Generate cards
  const cards = await _genCardsForNote(note)

  return { note, cards }
}

// Get note by id
async function get(noteId) {
  return await db.notes.get(noteId)
}

// Update note fields (expects cooked fields with NvIds)
async function update(noteId, fields, tags) {
  const note = await get(noteId)
  if (!note) throw new Error(`Note not found: ${noteId}`)

  // Handle media refCount updates if fields changed
  if (fields !== undefined) {
    // Parse old and new fields to get media diff (now works with cooked fields)
    const { anki } = await import('./index.js')
    const oldResult = await anki.parseFields(note.fields, {})
    const newResult = await anki.parseFields(fields, {})

    const oldNvIds = oldResult.media.map(m => m.nvId)
    const newNvIds = newResult.media.map(m => m.nvId)

    // Remove old media that's no longer referenced
    const toRemove = oldNvIds.filter(id => !newNvIds.includes(id))
    if (toRemove.length > 0) {
      await mediaManager.remove(toRemove)
    }

    // Add new media references (only truly new ones)
    const toAdd = newNvIds.filter(id => !oldNvIds.includes(id))
    if (toAdd.length > 0) {
      const newMediaToAdd = newResult.media.filter(m => toAdd.includes(m.nvId))
      await mediaManager.add(newMediaToAdd)
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
    const result = await anki.parseFields(note.fields, {})
    const nvIds = result.media.map(m => m.nvId)
    if (nvIds.length > 0) {
      await mediaManager.remove(nvIds)
    }
  }

  // Delete note
  await db.notes.delete(note.id)

  // Delete related cards
  await db.cards.where('noteId').equals(note.id).delete()

  log.debug('Note deleted:', note.id)
}

// No default export needed - use named exports directly
export default {
  create,
  get,
  update,
  delete: delete_
}
