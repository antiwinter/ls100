import { log } from '../../../utils/logger'

// Card template parser for Anki handlebars-like syntax
// Supports field substitution, conditionals, and basic filters

// Parse card template with field data
export const parseTemplate = (template, fields, context = {}) => {
  if (!template) return ''

  let html = template
  const { mode: _mode = 'study', clozeIndex = 1 } = context

  // Handle field substitutions {{FieldName}}
  html = html.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
    const trimmed = content.trim()

    // Handle filters like {{cloze:Text}} or {{type:Answer}}
    if (trimmed.includes(':')) {
      const [filter, fieldName] = trimmed.split(':', 2)
      return applyFilter(filter.trim(), fields[fieldName.trim()] || '', { ...context, fieldName, clozeIndex })
    }

    // Handle special fields
    if (trimmed === 'FrontSide') {
      return context.frontSide || ''
    }

    // Regular field substitution
    return fields[trimmed] || ''
  })

  // Handle conditional blocks {{#Field}}content{{/Field}}
  html = html.replace(/\{\{#([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, fieldName, content) => {
    const field = fields[fieldName.trim()]
    return field && field.trim() ? content : ''
  })

  // Handle negative conditionals {{^Field}}content{{/Field}}
  html = html.replace(/\{\{\^([^}]+)\}\}(.*?)\{\{\/\1\}\}/gs, (match, fieldName, content) => {
    const field = fields[fieldName.trim()]
    return (!field || !field.trim()) ? content : ''
  })

  return sanitizeHtml(html)
}

// Apply template filters
const applyFilter = (filter, content, context) => {
  const { mode, clozeIndex, fieldName } = context

  switch (filter.toLowerCase()) {
  case 'cloze':
    return processCloze(content, clozeIndex, mode)

  case 'type':
    return createTypeInput(fieldName, content, mode)

  case 'hint':
    return createHint(content)

  case 'text':
    return stripHtml(content)

  case 'furigana':
    return processFurigana(content)

  default:
    log.warn('Unknown filter:', filter)
    return content
  }
}

// Process cloze deletions {{cloze:Text}}
const processCloze = (content, clozeIndex, mode) => {
  if (!content) return ''

  // Find cloze patterns: {{c1::text::hint}} or {{c1::text}}
  const clozeRegex = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/g

  return content.replace(clozeRegex, (match, num, text, hint) => {
    const clozeNum = parseInt(num)

    if (clozeNum === clozeIndex) {
      if (mode === 'question') {
        // Show cloze deletion with optional hint
        const hintText = hint ? ` [${hint}]` : ''
        return `<span class="cloze-deletion">[...]${hintText}</span>`
      } else {
        // Show answer with highlighting
        return `<span class="cloze-answer">${text}</span>`
      }
    } else {
      // Show text for other cloze numbers
      return text
    }
  })
}

// Create type-in answer input
const createTypeInput = (fieldName, content, mode) => {
  if (mode === 'question') {
    return `<input type="text" class="type-answer" data-field="${fieldName}" placeholder="Type your answer..." autocomplete="off" />`
  } else {
    // Show comparison in answer mode
    return `
      <div class="type-comparison">
        <div class="type-expected">Correct: ${content}</div>
        <div class="type-input-readonly">
          <input type="text" class="type-answer" data-field="${fieldName}" value="" readonly />
        </div>
      </div>
    `
  }
}

// Create hint element
const createHint = (content) => {
  if (!content) return ''
  return `<span class="hint" title="${content}">💡</span>`
}

// Process furigana notation [kanji|furigana]
const processFurigana = (content) => {
  if (!content) return content

  return content.replace(/\[([^|]+)\|([^\]]+)\]/g, (match, kanji, furigana) => {
    return `<ruby>${kanji}<rt>${furigana}</rt></ruby>`
  })
}

// Strip HTML tags (basic implementation)
const stripHtml = (content) => {
  return content.replace(/<[^>]*>/g, '')
}

// Basic HTML sanitization
const sanitizeHtml = (html) => {
  // Remove potentially dangerous tags and attributes
  const dangerous = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi
  html = html.replace(dangerous, '')

  // Remove on* event handlers
  html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')

  // Remove javascript: URLs
  html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '')

  return html
}

// Check if template has cloze deletions
export const hasCloze = (template) => {
  return /\{\{c\d+::.+?\}\}/.test(template)
}

// Extract cloze numbers from template
export const getClozeNumbers = (template) => {
  const numbers = []
  const regex = /\{\{c(\d+)::/g
  let match

  while ((match = regex.exec(template)) !== null) {
    const num = parseInt(match[1])
    if (!numbers.includes(num)) {
      numbers.push(num)
    }
  }

  return numbers.sort((a, b) => a - b)
}

// Extract field names from template
export const getFieldNames = (template) => {
  const fields = new Set()
  const regex = /\{\{([^}]+)\}\}/g
  let match

  while ((match = regex.exec(template)) !== null) {
    let fieldName = match[1].trim()

    // Handle filters
    if (fieldName.includes(':')) {
      fieldName = fieldName.split(':')[1].trim()
    }

    // Skip special fields
    if (fieldName !== 'FrontSide') {
      fields.add(fieldName)
    }
  }

  return Array.from(fields)
}

// Validate template syntax
export const validateTemplate = (template) => {
  const errors = []

  // Check for unmatched braces
  const openBraces = (template.match(/\{\{/g) || []).length
  const closeBraces = (template.match(/\}\}/g) || []).length

  if (openBraces !== closeBraces) {
    errors.push('Unmatched template braces')
  }

  // Check for unclosed conditionals
  const openConditionals = (template.match(/\{\{#[^}]+\}\}/g) || []).length
  const closeConditionals = (template.match(/\{\{\/[^}]+\}\}/g) || []).length

  if (openConditionals !== closeConditionals) {
    errors.push('Unclosed conditional blocks')
  }

  return errors
}

log.debug('Template parser initialized')
