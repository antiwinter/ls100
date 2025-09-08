import Dexie from 'dexie'
import { log } from '../../../utils/logger'

export const db = new Dexie('AnkiDB')

db.version(1).stores({
  notes: 'id, typeId, modified',
  // Notes table: Core content storage for Anki notes
  // Schema: { id, typeId, fields[], tags[], refCount, created, modified }
  // - id: unique note identifier (generated)
  // - typeId: reference to noteTypes.id
  // - fields: array of field values (text content)
  // - tags: array of tag strings for organization
  // - refCount: reference counter for safe deletion
  // - created/modified: timestamps (auto-managed by hooks)
  // Used by: noteManager for CRUD operations, cardGen for rendering
  noteTypes: 'id, name',
  // Note Types table: Defines note structure and templates
  // Schema: { id, name, fields[], created }
  // - id: unique note type identifier
  // - name: human-readable note type name
  // - fields: array of field definitions/names
  // - created: timestamp when note type was created
  // Used by: noteManager for note validation and structure
  templates: 'id, typeId, ord',
  // Templates table: Card generation templates for note types
  // Schema: { id, typeId, name, qfmt, afmt, ord, created }
  // - id: unique template identifier (generated)
  // - typeId: reference to noteTypes.id (which note type this belongs to)
  // - name: template name (e.g., "Forward", "Reverse")
  // - qfmt: question format template (HTML with field placeholders)
  // - afmt: answer format template (HTML with field placeholders)
  // - ord: template ordinal/order within note type, 0, 1, 2, 3...
  // - created: timestamp when template was created
  // Used by: cardGen for rendering card content, noteManager for template lookup
  cards: 'id, noteId, deckId, due, state',
  // Cards table: Individual study cards with scheduling data
  // Schema: { id, noteId, templateOrd, deckId, due, state, fsrs[], created, modified }
  // - id: unique card identifier (generated)
  // - noteId: reference to notes.id (source note)
  // - templateOrd: template ordinal used to generate this card
  // - deckId: deck identifier for organization
  // - due: next review date (timestamp) - MIRRORED from latest fsrs[0].due for fast queries
  // - state: current FSRS state (New/Learning/Review/Relearning) - MIRRORED from fsrs[0].state
  // - fsrs: array of FSRS state history [newest, older, oldest] - source of truth
  // - created/modified: timestamps
  // Used by: studyEngine for scheduling (fast filters on due/state), cardGen for CRUD operations
  media: 'id, filename, deckId'
  // Media table: Binary media files (images, audio, etc.)
  // Schema: { id, filename, deckId, blob, size, type, imported }
  // - id: unique media identifier (filename-based)
  // - filename: original filename from APKG
  // - deckId: deck identifier for organization
  // - blob: binary data blob (source of truth)
  // - size: file size in bytes
  // - type: MIME type (image/png, audio/mp3, etc.)
  // - imported: timestamp when media was imported
  // Used by: mediaManager for caching, templateEngine for rendering, apkgParser for import
})

// Auto-timestamps for notes
db.notes.hook('creating', (primKey, obj) => {
  obj.created = obj.modified = Date.now()
})

db.notes.hook('updating', (modifications) => {
  modifications.modified = Date.now()
})

// Open database
db.open().then(() => {
  log.debug('Dexie database opened')
}).catch(err => {
  log.error('Failed to open Dexie database:', err)
})

export default db
