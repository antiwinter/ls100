
// Check if template's conditional requirements are met (internal)
function _checkConditionalRequirements(qfmt, noteFields, bundleFields) {
  // Extract conditional field names from template qfmt
  // Pattern: {{#FieldName}} requires FieldName to be non-empty
  const conditionalMatches = qfmt.match(/\{\{#([^}]+)\}\}/g)

  if (!conditionalMatches) {
    // No conditional requirements, card should be generated
    return true
  }

  // Check each conditional requirement
  for (const match of conditionalMatches) {
    const fieldName = match.replace(/\{\{#([^}]+)\}\}/, '$1').trim()

    // Find field index
    const fieldIndex = bundleFields.findIndex(field => {
      const name = field.name || field
      return name.toLowerCase() === fieldName.toLowerCase()
    })

    if (fieldIndex === -1) {
      // Field not found, skip this card
      return false
    }

    // Check if field has content
    const fieldValue = noteFields[fieldIndex]
    if (!fieldValue || fieldValue.trim() === '') {
      // Required field is empty, skip this card
      return false
    }
  }

  return true
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
