import Dexie from 'dexie'
import { log } from '../../../utils/logger'

export const db = new Dexie('AnkiDB')

db.version(1).stores({
  notes: 'id, bundleId, modified',
  // Notes table: Core content storage for Anki notes
  // Schema: { id, bundleId, fields[], tags[], created, modified }
  // - id: unique note identifier (NvId-based)
  // - bundleId: reference to bundles.id
  // - fields: array of field values (text content)
  // - tags: array of tag strings for organization
  // - created/modified: timestamps (auto-managed by hooks)
  // Used by: noteManager for CRUD operations, cardGen for rendering
  bundles: 'id, name',
  // Bundles table: Defines note structure and templates (formerly bundles)
  // Schema: { id, name, fields[], created }
  // - id: unique bundle identifier
  // - name: human-readable bundle name
  // - fields: array of field definitions/names
  // - created: timestamp when bundle was created
  // Used by: noteManager for note validation and structure
  templates: 'id, bundleId, ord',
  // Templates table: Card generation templates for bundles
  // Schema: { id, bundleId, name, qfmt, afmt, ord, vdeck, created }
  // - id: unique template identifier (generated)
  // - bundleId: reference to bundles.id (which bundle this belongs to)
  // - name: template name (e.g., "Forward", "Reverse")
  // - qfmt: question format template (HTML with field placeholders)
  // - afmt: answer format template (HTML with field placeholders)
  // - ord: template ordinal/order within bundle, 0, 1, 2, 3...
  // - vdeck: target virtual deck (single string, e.g., "Spanish::Verbs")
  // - created: timestamp when template was created
  // Used by: cardGen for rendering card content, noteManager for template lookup
  cards: 'id, noteId, bundleId, due, state',
  // Cards table: Individual study cards with scheduling data
  // Schema: { id, noteId, templateOrd, bundleId, vdeck[], due, state, fsrs[], created, modified }
  // - id: unique card identifier (generated)
  // - noteId: reference to notes.id (source note)
  // - templateOrd: template ordinal used to generate this card
  // - bundleId: bundle identifier for content organization
  // - vdeck: array of virtual deck names for study organization
  // - due: next review date (timestamp) - MIRRORED from latest fsrs[0].due for fast queries
  // - state: current FSRS state (New/Learning/Review/Relearning) - MIRRORED from fsrs[0].state
  // - fsrs: array of FSRS state history [newest, older, oldest] - source of truth
  // - created/modified: timestamps
  // Used by: studyEngine for scheduling (fast filters on due/state), cardGen for CRUD operations
  media: 'id, filename'
  // Media table: Global binary media files (images, audio, etc.)
  // Schema: { id, filename, blob, size, type, refCount, imported }
  // - id: unique media identifier (filename-based)
  // - filename: original filename from APKG
  // - blob: binary data blob (source of truth)
  // - size: file size in bytes
  // - type: MIME type (image/png, audio/mp3, etc.)
  // - refCount: reference counter for garbage collection
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
