import Dexie from 'dexie'
import { log } from '../../../utils/logger'

export const db = new Dexie('AnkiDB')

db.version(1).stores({
  notes: 'id, typeId, modified',
  noteTypes: 'id, name',
  templates: 'id, typeId, ord',
  cards: 'id, noteId, deckId, due, reps',
  media: 'id, filename, deckId'
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
