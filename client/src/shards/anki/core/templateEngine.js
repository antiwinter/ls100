
import mediaManager from './mediaManager'

// Template renderer for Anki cards with media support
export class TemplateRenderer {
  constructor(noteType) {
    this.noteType = noteType
    this.fieldNames = noteType.fields.map(f => f.name || f)
  }

  // Main render method - returns both question and answer
  async render(template, noteFields, shardId, frontSideContent = null) {
    const qContent = template.qfmt || ''
    const aContent = template.afmt || ''

    // Render question
    const renderedQuestion = await this._replaceFields(qContent, noteFields, shardId)

    // Render answer (may include FrontSide)
    const renderedAnswer = await this._replaceFields(
      aContent,
      noteFields,
      shardId,
      frontSideContent || renderedQuestion
    )

    return {
      question: renderedQuestion,
      answer: renderedAnswer
    }
  }

  // Replace fields and process media URLs
  async _replaceFields(content, noteFields, shardId, frontSide = '') {
    let result = content

    // Replace {{FrontSide}} with question content
    result = result.replace(/\{\{FrontSide\}\}/g, frontSide)

    // Replace {{FieldName}} with field values
    result = result.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
      if (fieldName === 'FrontSide') {
        return frontSide
      }

      const index = this._getFieldIndex(fieldName, this.fieldNames)
      return index !== -1 ? (noteFields[index] || '') : ''
    })

    // Process media URLs
    result = await mediaManager.replaceMediaUrls(result, shardId)

    return result
  }

  // Get field index (case-insensitive)
  _getFieldIndex(fieldName, fieldNames) {
    return fieldNames.findIndex(name =>
      name.toLowerCase() === fieldName.toLowerCase()
    )
  }

  // Check if template would render (non-empty after field substitution)
  wouldRender(template, noteFields) {
    const fieldPattern = /\{\{([^}]+)\}\}/g
    const matches = template.match(fieldPattern)

    if (!matches) {
      // No field references, check if template has static content
      return template.trim().length > 0
    }

    // Check if any referenced fields have content
    return matches.some(match => {
      const fieldName = match.slice(2, -2)
      if (fieldName === 'FrontSide') return true // FrontSide always available

      const index = this._getFieldIndex(fieldName, this.fieldNames)
      return index !== -1 && noteFields[index]?.trim()
    })
  }
}

// Legacy TemplateEngine for backward compatibility
export class TemplateEngine {
  constructor(noteType) {
    this.renderer = new TemplateRenderer(noteType)
  }

  render(template, noteFields, frontSide = '') {
    return this.renderer._replaceFields(template, noteFields, null, frontSide)
  }

  wouldRender(template, noteFields) {
    return this.renderer.wouldRender(template, noteFields)
  }
}

export default TemplateRenderer
