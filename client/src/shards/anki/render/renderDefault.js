import db from '../core/db.js'
import { renderTemplate } from '../template/index.js'

// Main render method - gets all needed data from card or accepts pre-fetched data
export async function render(card, options = {}) {
  // Use pre-fetched data if available, otherwise fetch from database
  const note = options.note || await db.notes.get(card.noteId)
  if (!note) throw new Error(`Note not found: ${card.noteId}`)

  const bundle = options.bundle || await db.bundles.get(note.bundleId)
  if (!bundle) throw new Error(`Bundle not found: ${note.bundleId}`)

  let template
  if (options.template) {
    template = options.template
  } else if (options.templates) {
    template = options.templates.find(t => t.ord === card.templateOrd)
  } else {
    const templates = await db.templates.where('bundleId').equals(note.bundleId).toArray()
    template = templates.find(t => t.ord === card.templateOrd)
  }
  if (!template) throw new Error(`Template not found: ${card.templateOrd}`)

  // Render both sides via template engine in one call
  const fieldDefs = bundle.fields
  const { question, answer } = await renderTemplate(
    template,
    { fieldValues: note.fields, fieldDefs, bundleCss: bundle.css }
  )

  return {
    id: card.id,
    question,
    answer,
    template: template.name,
    note: {
      id: note.id,
      fields: note.fields,
      tags: note.tags
    }
  }
}
