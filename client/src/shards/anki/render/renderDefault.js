import db from '../core/db.js'

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

  // Render the template
  const fieldNames = bundle.fields.map(f => f.name || f)
  const rendered = await _renderTemplate(template, note.fields, fieldNames)

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

// Template rendering methods (moved from templateEngine.js)
// Main render method - returns both question and answer (internal)
async function _renderTemplate(
  template,
  noteFields,
  fieldNames,
  frontSideContent = null
) {
  const qContent = template.qfmt || ''
  const aContent = template.afmt || ''

  // Render question
  const renderedQuestion = await _replaceFields(qContent, noteFields, fieldNames)

  // Render answer (may include FrontSide)
  const renderedAnswer = await _replaceFields(
    aContent,
    noteFields,
    fieldNames,
    frontSideContent || renderedQuestion
  )

  return {
    question: renderedQuestion,
    answer: renderedAnswer
  }
}

// Replace fields and process media URLs (internal)
async function _replaceFields(content, noteFields, fieldNames, frontSide = '') {
  let result = content

  // Replace {{FrontSide}} with question content
  result = result.replace(/\{\{FrontSide\}\}/g, frontSide)

  // Replace {{FieldName}} with field values
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
    if (fieldName === 'FrontSide') {
      return frontSide
    }

    const index = _getFieldIndex(fieldName, fieldNames)
    return index !== -1 ? (noteFields[index] || '') : ''
  })

  // Media URLs already processed - cooked fields contain /media/ URLs served by service worker

  return result
}

// Get field index (case-insensitive) (internal)
function _getFieldIndex(fieldName, fieldNames) {
  return fieldNames.findIndex(name =>
    name.toLowerCase() === fieldName.toLowerCase()
  )
}
