import { log } from '../../../utils/logger'
import db from '../core/db.js'
import { AnkiRender } from '../core/template/index.js'

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


  const bundleIds = [...new Set(cards.map(c => c.bundleId))]
  const f2nvid = {}

  // Query media references for both notes and templates in one go
  // userId can be noteId (for note media) or templateOrd (for template media)
  // or bundleId (for CSS media)
  const allUserIds = [...new Set(cards.map(c => c.noteId)),
    ...new Set(cards.map(c => c.templateOrd)),
    ...bundleIds
  ]
  const allRefs = await db.media.where('bundleId').anyOf(bundleIds)
    .filter(ref => allUserIds.includes(ref.userId))
    .toArray()

  for (const ref of allRefs) {
    f2nvid[ref.filename] = ref.nvId
  }

  // Create render context with all needed data
  const renderer = new AnkiRender({
    fieldDefs: bundle.fields,
    css: bundle.css,
    templates,
    f2nvid
  })

  return {
    css: renderer.css,
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
