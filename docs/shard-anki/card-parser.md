# Card Parser Module

The Card Parser handles Anki template syntax parsing and HTML rendering for browser display.

## Purpose

Converts Anki card templates (front/back) with field placeholders into rendered HTML for display in the browser.

## Template Syntax Support

### Basic Field Substitution
- `{{FieldName}}` - Replace with field content
- `{{FrontSide}}` - Insert question side content (answer templates)

### Conditional Rendering
- `{{#FieldName}}content{{/FieldName}}` - Show content if field has value
- `{{^FieldName}}content{{/FieldName}}` - Show content if field is empty

### Filters
- `{{cloze:Text}}` - Process cloze deletions
- `{{type:FieldName}}` - Create type-in answer input
- Custom filters for text processing

### Special Fields
- `{{Tags}}` - Note tags
- `{{Type}}` - Note type name
- `{{Deck}}` - Deck name
- `{{Card}}` - Template name

## Implementation

### Parser Functions
- `parseCardTemplate(template, fieldData)` - Main parsing function
- `applyFilter(filter, content, context)` - Filter processing
- `processConditionals(html, fieldData)` - Handle conditional blocks
- `sanitizeOutput(html)` - Security cleanup

### Cloze Processing
- Extract cloze numbers from content
- Generate appropriate HTML for study/browse modes
- Handle multiple cloze deletions per card

### Security
- HTML sanitization for user content
- XSS prevention in field data
- Safe template evaluation

## Usage Pattern

```javascript
// Parse card template
const renderedHtml = parseCardTemplate(
  template.front,
  noteFieldData,
  { mode: 'study', clozeIndex: 1 }
)

// Render in card component
cardElement.innerHTML = renderedHtml
```

## Browser Compatibility

- Uses modern JavaScript string methods
- RegExp support for pattern matching
- DOM manipulation for safe HTML insertion
- No external parsing dependencies
