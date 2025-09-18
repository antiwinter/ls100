import { log } from '../../../utils/logger'
import db from '../core/db.js'
import { AnkiRender } from '../template/index.js'

export async function createRender(cards) {
  // get/build fieldDefs, css, templates, f2nvid from cards[]
  // f2nvid is an object mapping (filename -> nvId) for media files
  if (!cards?.length) {
    log.error('createRender: No cards provided')
    return null
  }

  // don't support multi bundles,
  // but would be easy to add support in the future
  const bundleId = cards[0].bundleId
  const bundle = await db.bundles.get(bundleId)
  if (!bundle) {
    log.error('createRender: Bundle not found:', bundleId)
    return null
  }

  const templates = await db.templates.where('bundleId').equals(bundleId).toArray()
  if (!templates.length) {
    log.error('createRender: No templates found for bundle:', bundleId)
    return null
  }

  // Build f2nvid mapping from note fields
  // 1. Fetch notes associated with cards
  const noteIds = [...new Set(cards.map(c => c.noteId))]
  const notes = await db.notes.where('id').anyOf(noteIds).toArray()

  // 2. Find nvIds in note fields
  const nvIds = new Set()
  for (const note of notes) {
    for (const field of note.fields || []) {
      const mediaMatches = field.match(/\/media\/([a-zA-Z0-9-_]+)/g) || []
      for (const match of mediaMatches) {
        const nvId = match.replace('/media/', '')
        nvIds.add(nvId)
      }
    }
  }

  // 3. Find filename of each nvId with mediaManager
  const f2nvid = {}
  // Import MediaDB directly from mediaManager
  const Dexie = (await import('dexie')).default
  const mediaDb = new Dexie('MediaDB')
  mediaDb.version(1).stores({ media: 'id, type, refCount, created' })
  await mediaDb.open()

  for (const nvId of nvIds) {
    const mediaRecord = await mediaDb.media.get(nvId)
    if (mediaRecord?.filename) {
      f2nvid[mediaRecord.filename] = nvId
    }
  }

  // Create render context with all needed data
  const renderer = new AnkiRender({
    fieldDefs: bundle.fields,
    css: bundle.css,
    templates,
    f2nvid
  })

  return {
    async render(card) {
      const note = await db.notes.get(card.noteId)
      if (!note) throw new Error(`Note not found: ${card.noteId}`)

      // Return renderer result directly (front/back instead of question/answer)
      const result = renderer.render(note, card.templateOrd)
      return {
        template: templates[card.templateOrd]?.name || 'Unknown',
        ...result // { front, back, css, meta }
      }
    }
  }
}
