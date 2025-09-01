# Template Engine Module

The Template Engine handles dynamic card content rendering using Anki's template syntax, converting note fields and templates into displayable HTML.

## Purpose

Renders card content on-demand from note data and template definitions, supporting Anki's handlebars-like syntax with field substitution, conditionals, and special functions.

## Core Architecture

### TemplateRenderer Class
Main rendering engine with note type context:
```javascript
class TemplateRenderer {
  constructor(noteType) {
    this.fields = noteType.fields  // Field names array
  }
  
  render(template, noteFields, frontSideContent) {
    // Returns {question, answer} with rendered HTML
  }
}
```

### Template Syntax Support

#### Field Substitution
- `{{FieldName}}` - Replace with field content at same index
- `{{FrontSide}}` - Insert question content in answer templates

#### Example
```javascript
// Note fields: ["France", "Paris", "🇫🇷"]  
// Template: "{{Country}} is the capital of {{Capital}}"
// Result: "France is the capital of Paris"
```

### Rendering Process

#### Question Rendering
```javascript
const qContent = template.qfmt  // "{{Country}}"
const rendered = this._replaceFields(qContent, noteFields, fieldNames)
// Result: "France"
```

#### Answer Rendering  
```javascript
const aContent = template.afmt  // "{{FrontSide}}<hr>{{Capital}}"
const rendered = this._replaceFields(aContent, noteFields, fieldNames, frontSide)
// Result: "France<hr>Paris"
```

## Implementation Details

### Field Replacement Logic
```javascript
_replaceFields(content, noteFields, fieldNames, frontSide) {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
    if (fieldName === 'FrontSide') {
      return frontSide || ''
    }
    
    const index = this._getFieldIndex(fieldName, fieldNames)
    return index !== -1 ? (noteFields[index] || '') : ''
  })
}
```

### Field Index Resolution
```javascript
_getFieldIndex(fieldName, fieldNames) {
  return fieldNames.findIndex(name => 
    name.toLowerCase() === fieldName.toLowerCase()
  )
}
```

### Template Validation
```javascript
wouldRender(template, noteFields) {
  // Check if template would produce non-empty content
  const fieldPattern = /\{\{([^}]+)\}\}/g
  const matches = template.match(fieldPattern)
  
  return matches?.some(match => {
    const fieldName = match.slice(2, -2)
    const index = this._getFieldIndex(fieldName, this.fieldNames)
    return index !== -1 && noteFields[index]?.trim()
  }) || false
}
```

## Usage Patterns

### Basic Rendering
```javascript
const engine = new TemplateRenderer(noteType)
const result = engine.render(template, noteFields)

// Access rendered content
const questionHtml = result.question
const answerHtml = result.answer
```

### Card Generation Integration
```javascript
// In CardGenerator.genCardsForNote()
for (const template of templates) {
  if (engine.wouldRender(template.qfmt, note.fields)) {
    // Generate card only if template produces content
    const card = { noteId, templateIdx: template.idx, ... }
    await idb.put('cards', card)
  }
}
```

### Study Mode Integration
```javascript
// In CardGenerator.renderCard()
const engine = new TemplateRenderer(noteType)
const question = engine.render(template.qfmt, note.fields)
const answer = engine.render(template.afmt, note.fields, question)

return { id: cardId, question, answer, template: template.name }
```

## Advanced Features

### FrontSide Support
Answer templates can include question content:
```javascript
// Template: "{{FrontSide}}<hr>{{Answer}}"
// Question: "What is the capital of France?"
// Answer: "What is the capital of France?<hr>Paris"
```

### Empty Field Handling
Graceful handling of missing or empty fields:
```javascript
// Template: "{{Country}} - {{MissingField}}"
// Fields: ["France", ""]
// Result: "France - " (empty field becomes empty string)
```

### Case-Insensitive Matching
Field names matched case-insensitively:
```javascript
// Template: "{{country}}" matches field "Country"
// Template: "{{CAPITAL}}" matches field "Capital"
```

## Template Validation

### Content Generation Rules
Cards only generated if template produces non-empty content:
```javascript
// Template: "{{EmptyField}}" with empty field → No card generated
// Template: "{{Country}}" with "France" → Card generated
// Template: "Static text" → Always generates card
```

### Field Requirements
Templates require at least one non-empty field or static content:
```javascript
const hasContent = template.includes('{{') 
  ? this.wouldRender(template, fields)
  : template.trim().length > 0
```

## Performance Optimization

### Template Caching
Templates parsed once and reused:
```javascript
// TemplateRenderer instances cached per noteType
const rendererCache = new Map()

function getRenderer(noteType) {
  if (!rendererCache.has(noteType.id)) {
    rendererCache.set(noteType.id, new TemplateRenderer(noteType))
  }
  return rendererCache.get(noteType.id)
}
```

### Efficient Field Lookup
Field names stored as array for O(n) lookup:
```javascript
// Preprocessing field names for faster access
constructor(noteType) {
  this.fieldNames = noteType.fields.map(f => f.name || f)
}
```

### Lazy Evaluation
Content rendered only when requested:
```javascript
// Cards store template references, not rendered content
const card = {
  noteId: "note123",
  templateIdx: 0,     // Reference to template
  // No question/answer stored
}

// Content rendered on-demand
const rendered = await cardGen.renderCard(card.id)
```

## Error Handling

### Missing Templates
```javascript
if (!template) {
  throw new Error(`Template ${templateIdx} not found for NoteType ${noteTypeId}`)
}
```

### Invalid Field References
```javascript
// Unknown fields resolve to empty string
const fieldValue = index !== -1 ? noteFields[index] : ''
```

### Malformed Templates
```javascript
try {
  const rendered = this.render(template, fields)
} catch (error) {
  log.error('Template rendering failed:', error)
  return { question: 'Error rendering card', answer: 'Error rendering card' }
}
```

## Integration Points

### NoteManager Integration
```javascript
const noteType = await noteManager.getType(note.typeId)
const engine = new TemplateRenderer(noteType)
```

### CardGenerator Integration
```javascript
// Generate cards using template validation
if (engine.wouldRender(template.qfmt, note.fields)) {
  cards.push(createCard(noteId, template.idx))
}
```

### Study UI Integration
```javascript
// Dynamic content in StudyMode component
useEffect(() => {
  const loadCard = async () => {
    const rendered = await ankiApi.getStudyCard(card.id)
    setRenderedCard(rendered)
  }
  loadCard()
}, [card])
```

## Future Enhancements

### Extended Syntax Support
- **Conditionals**: `{{#Field}}content{{/Field}}`
- **Negated Conditionals**: `{{^Field}}content{{/Field}}`
- **Filters**: `{{cloze:Text}}`, `{{type:Answer}}`
- **Special Fields**: `{{Tags}}`, `{{Type}}`, `{{Deck}}`

### Advanced Features
- **Cloze Deletions**: Support for `{{c1::hidden::hint}}` syntax
- **Type-in Fields**: Interactive input fields for testing
- **Media Processing**: Automatic media URL resolution
- **Custom Filters**: User-defined text processing functions

### Performance Improvements
- **Template Compilation**: Pre-compile templates for faster rendering
- **Batch Rendering**: Render multiple cards simultaneously
- **Background Processing**: Render upcoming cards in background
- **Memory Management**: Efficient cleanup of cached renderers
