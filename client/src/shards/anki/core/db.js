import Dexie from 'dexie'
import { log } from '../../../utils/logger'

export const db = new Dexie('AnkiDB_v4')

db.version(1).stores({
  notes: 'id, bundleId, modified',
  // Notes table: Core content storage for Anki notes
  // Schema: { id, bundleId, fields[], tags[], created, modified }
  // - id: unique note identifier (NvId-based)
  // - bundleId: reference to bundles.id
  // - fields: array of field values (text content)
  // - tags: array of tag strings for organization
  // - created/modified: timestamps (auto-managed by hooks)
  // Used by: noteManager for CRUD operations, cardRender for rendering
  bundles: 'id, name',
  // Bundles table: Defines note structure and templates (formerly bundles)
  // Schema: { id, name, fields[], created, css }
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
  // Used by: cardRender for rendering card content, noteManager for template lookup
  cards: 'id, noteId, bundleId, due, state',
  // Cards table: Individual study cards with scheduling data
  // Schema: { id, noteId, templateOrd, bundleId, vdeck[], due, state,
  //  fsrs[], created, modified, userNote }
  // - id: unique card identifier (generated)
  // - noteId: reference to notes.id (source note)
  // - templateOrd: template ordinal used to generate this card
  // - bundleId: bundle identifier for content organization
  // - vdeck: array of virtual deck names for study organization
  // - due: next review date (timestamp) - MIRRORED from latest fsrs[0].due for fast queries
  // - state: current FSRS state (New/Learning/Review/Relearning) - MIRRORED from fsrs[0].state
  // - fsrs: array of FSRS state history [newest, older, oldest] - source of truth
  // - created/modified: timestamps
  // - userNote: HTML string with user's text notes and audio references
  //  (e.g., "<p>text</p><audio-note data-file='x.webm' data-duration='28'></audio-note>")
  // Used by: studyEngine for scheduling (fast filters on due/state), ankiApi for CRUD operations
  media: '++id, nvId, bundleId, userId, filename',
  // Media table: Tracks media ownership for OSS cleanup
  // Schema: { id, nvId, bundleId, userId, filename, created }
  // - id: auto-increment primary key for unique references
  // - nvId: unique media identifier (content-based hash) for OSS deduplication
  // - bundleId: bundle identifier for content organization
  // - userId: user identifier (can be templateOrd or noteId)
  // - filename: original filename for reference
  // - created: timestamp when reference was created
  // Used by: mediaManager for tracking references and OSS cleanup
  history: '[bundleId+day], bundleId, day'
  // History table: Per-day study aggregates per bundle
  // Schema: { bundleId, day, studied, correct, ratings{}, ttd }
  // - bundleId: bundle identifier to scope history
  // - day: integer day number from engine (_getDay)
  // - studied: number of cards rated on that day
  // - ratings: object map of rating value -> count (e.g., { '1': 3, '2': 1, '3': 10, '4': 15 })
  // - ttd: time tracking data { base: unix_sec, total: secs, slices: [[t0, t1], ...] }
  // Used by: StudyEngine2 to upsert on rate; UI can read for summaries/statistics
})

// v2 removed (history moved to v1 for simplicity)

// Auto-timestamps for notes
db.notes.hook('creating', (primKey, obj) => {
  obj.created = obj.modified = Date.now()
})

db.notes.hook('updating', (modifications) => {
  modifications.modified = Date.now()
})

// Open database with enhanced error handling
db.open().then(() => {
  log.debug('Dexie database opened successfully: AnkiDB_v4')
}).catch(err => {
  log.error('Failed to open Dexie database:', err)
  // If database is corrupted or has schema conflicts, delete and recreate
  if (err.name === 'DatabaseClosedError' || err.name === 'UpgradeError') {
    log.warn('Attempting to delete corrupted database and recreate')
    db.delete().then(() => {
      log.info('Database deleted, will recreate on next operation')
    }).catch(deleteErr => {
      log.error('Failed to delete corrupted database:', deleteErr)
    })
  }
})

export default db
