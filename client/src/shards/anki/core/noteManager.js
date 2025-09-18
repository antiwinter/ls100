import db from './db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import mediaManager from '../../../utils/mediaManager.js'
import { render } from '../render/renderDefault.js'
import { checkEligibility } from '../template/index.js'

// Create new note - handles both raw and cooked fields
async function _create(bundleId, fields, tags = [], media = {}) {
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) throw new Error(`NoteType not found: ${bundleId}`)

  // Process fields with media (handles both raw and cooked)
  const { anki } = await import('./index.js')
  const result = await anki.parseFields(fields, media)
  const cookedFields = Array.isArray(result.cooked) ? result.cooked : [result.cooked]

  const note = {
    id: genId('note', bundleId + cookedFields.join('') + tags.join('')),
    bundleId,
    fields: cookedFields.slice(0, bundle.fields.length), // Ensure correct field count
    tags,
    refCount: 0,
    created: Date.now(),
    modified: Date.now()
  }

  await db.notes.put(note)

  // Add media references
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

// Update note fields - handles both raw and cooked fields
async function update(noteId, fields, tags, media = {}) {
  const note = await get(noteId)
  if (!note) throw new Error(`Note not found: ${noteId}`)

  // Handle media refCount updates if fields changed
  if (fields !== undefined) {
    // Process both old and new fields with media support
    const { anki } = await import('./index.js')
    const oldResult = await anki.parseFields(note.fields, {}) // Old fields are always cooked
    const newResult = await anki.parseFields(fields, media) // New fields can be mixed

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

    // Use processed cooked fields
    fields = Array.isArray(newResult.cooked) ? newResult.cooked : [newResult.cooked]
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

  // log.debug('Note deleted:', note.id)
}

// No default export needed - use named exports directly
export default {
  create,
  get,
  update,
  delete: delete_
}
