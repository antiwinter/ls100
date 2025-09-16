import db from '../core/db.js'
import { renderTemplate } from '../template/template.js'

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

  // Render the template via template engine
  const fieldNames = bundle.fields.map(f => f.name || f)
  const rendered = await renderTemplate(template, note.fields, fieldNames)

  return {
    id: card.id,
    question: rendered.question,
    answer: rendered.answer,
    template: template.name,
    note: {
      id: note.id,
      fields: note.fields,
      tags: note.tags
    }
  }
}
