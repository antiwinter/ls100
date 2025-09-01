import { log } from '../../../utils/logger'

// Template engine for {{field}} syntax rendering
export class TemplateEngine {
  constructor(noteType) {
    this.noteType = noteType
    this.fieldMap = this.buildFieldMap(noteType.fields)
  }

  buildFieldMap(fields) {
    const map = new Map()
    fields.forEach((name, idx) => map.set(name, idx))
    return map
  }

  render(template, noteFields, frontSide = '') {
    let content = template

    // Replace {{FrontSide}} with question content
    content = content.replace(/\{\{FrontSide\}\}/g, frontSide)

    // Replace {{FieldName}} with field values
    content = content.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
      const fieldIdx = this.fieldMap.get(fieldName)
      if (fieldIdx !== undefined && fieldIdx < noteFields.length) {
        return noteFields[fieldIdx] || ''
      }
      log.warn('Unknown field in template:', fieldName)
      return match // Keep original if field not found
    })

    return content
  }

  // Check if template would render (non-empty after field substitution)
  wouldRender(template, noteFields) {
    const rendered = this.render(template, noteFields)
    const stripped = rendered.replace(/<[^>]*>/g, '').trim() // Remove HTML tags
    return stripped.length > 0
  }
}

export default TemplateEngine
