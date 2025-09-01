# Anki Shard

Anki Shard integrates spaced repetition flashcard functionality into the LS100 shard system, implementing Anki's Note+Template architecture for efficient multi-pair card generation.

## Overview

The Anki Shard provides two primary modes:
- **Browse Mode**: Navigate and explore notes with field data
- **Study Mode**: Active learning with spaced repetition algorithm

**Key Design Principles**:
- **Note+Template Architecture** - Cards generated dynamically from note data
- **RefCount Sharing** - Notes shared across shards with automatic cleanup
- **Frontend-only** - No backend modifications required
- **Modern FSRS** - Advanced spaced repetition algorithm

## Architecture

### Core Concept: Note+Template System

Unlike traditional flashcard systems that store rendered content, we follow Anki's approach:

```
Note (data) + Template (format) → Card (instance)
```

- **Note**: Field data (e.g. Country="France", Capital="Paris")
- **Template**: Rendering format (e.g. "{{Country}} → {{Capital}}")  
- **Card**: Lightweight reference with scheduling data

### Storage Strategy
- **Shard Metadata**: Backend via global shard API
- **Notes**: IndexedDB with refCount for cross-shard sharing
- **Templates**: IndexedDB linked to note types
- **Cards**: IndexedDB as note+template references
- **Progress**: localStorage with FSRS scheduling data

### Core Modules

#### AnkiApi
High-level coordinator for all operations:
```javascript
ankiApi.createNote(typeId, fields, tags, deckId, shardId)
ankiApi.getStudyCard(cardId) // Returns rendered content
ankiApi.cleanupShard(shardId) // RefCount cleanup
```

#### NoteManager  
CRUD operations for notes with refCount system:
```javascript
noteManager.create(typeId, fields, tags)
noteManager.addRef(noteId, shardId) // Increment refCount
noteManager.removeRef(noteId, shardId) // Cleanup if refCount=0
```

#### CardGenerator
Generates cards from note+template combinations:
```javascript  
cardGen.genCardsForNote(noteId, deckId, shardId)
cardGen.renderCard(cardId) // Dynamic content generation
```

#### TemplateEngine
Renders content using Anki template syntax:
```javascript
engine.render("{{Country}}", ["France", "Paris"]) // → "France"
engine.render("{{FrontSide}}<hr>{{Capital}}", ...) // → "France<hr>Paris"
```

## Data Structures

### IndexedDB Schema

**Notes Store**:
```javascript
{
  id: string,
  typeId: string, 
  fields: string[], // Raw field data
  tags: string[],
  refCount: number, // Cross-shard sharing
  created: timestamp,
  modified: timestamp
}
```

**Templates Store**:
```javascript
{
  id: string,
  typeId: string,
  name: string,
  qfmt: string, // Question template  
  afmt: string, // Answer template
  idx: number   // Template ordinal
}
```

**Cards Store**:
```javascript
{
  id: string,
  noteId: string,     // Reference to note
  templateIdx: number, // Which template to use
  deckId: string,
  shardId: string,
  due: timestamp,     // FSRS scheduling
  interval: number,
  ease: number,
  reps: number
}
```

## Multi-Pair Card Example

A single note with geography data:
```javascript
{
  typeId: "geography",
  fields: ["France", "Paris", "🇫🇷", "Western Europe"]
}
```

Using templates:
- "{{Country}} → {{Capital}}" → "France → Paris"
- "{{Capital}} → {{Country}}" → "Paris → France"  
- "{{Flag}} → {{Country}}" → "🇫🇷 → France"
- "{{Country}} → {{Location}}" → "France → Western Europe"

Results in **4 cards** from **1 note**.

## Import Flow

### .apkg Processing
1. Parse .apkg file using sql.js + jszip
2. Extract noteTypes, notes, templates, media
3. Create noteTypes and templates in IndexedDB
4. Import notes with refCount=1 for current shard
5. Generate cards using cardGen.genCardsForNote()

### Data Conversion
```javascript
// Anki note type → LS100 noteType + templates
{
  name: "Basic",
  flds: [{name: "Front"}, {name: "Back"}],
  tmpls: [{qfmt: "{{Front}}", afmt: "{{FrontSide}}<hr>{{Back}}"}]
}
```

## Study Flow

1. **Card Selection**: FSRS algorithm picks due cards
2. **Rendering**: TemplateEngine generates question/answer
3. **User Rating**: Again/Hard/Good/Easy (1-4 scale)
4. **Scheduling**: FSRS updates due date and difficulty
5. **Persistence**: Progress saved to localStorage

## Browse Flow

1. **Load Notes**: Get notes for current deck/shard
2. **Display Fields**: Show note type, field values, tags
3. **Card Count**: Display how many cards each note generates
4. **Search/Filter**: By field content, tags, note type

## RefCount System

### Cross-Shard Sharing
- Notes can be shared across multiple shards
- `refCount` tracks how many shards reference each note
- Automatic cleanup when `refCount` reaches 0

### Lifecycle Management
```javascript
// Adding note to shard
await noteManager.addRef(noteId, shardId) // refCount++

// Removing note from shard  
await noteManager.removeRef(noteId, shardId) // refCount--
// If refCount=0, note is deleted automatically
```

## UI/UX Design

### Browse Mode
- **Note Table**: Type, fields, tags, card count, modified date
- **Search/Filter**: By content, type, tags
- **Statistics**: Notes count, cards count, due cards

### Study Mode  
- **Dynamic Content**: Rendered on-demand from note+template
- **Card Info**: Template name, note fields preview
- **FSRS Controls**: 4-rating system with scheduling feedback

### Editor Mode
- **Import Interface**: .apkg file selection and preview
- **Statistics**: NoteTypes, notes, cards imported
- **Deck Management**: Create decks, assign notes

## Performance Considerations

### Storage Efficiency
- **Deduplication**: Notes stored once, cards are references
- **RefCount**: Automatic cleanup prevents orphaned data
- **Lazy Loading**: Content rendered when needed

### Rendering Optimization
- **Template Caching**: Parsed templates cached in memory
- **Batch Operations**: Multiple cards processed together
- **Progressive Loading**: Large note sets loaded incrementally

## Integration Points

### Shard System
```javascript  
// AnkiShard.js exports
export const detect = (filename, buffer) => // .apkg detection
export const parseAnkiFile = async (file, filename, deckId, shardId) =>
export const processData = async (shard) => // Update shard.data
export const cleanup = async (shard) => // RefCount cleanup
```

### Reader Integration
- Follows existing reader pattern
- Uses familiar UI components
- Maintains consistent navigation

## Future Enhancements

### Phase 1 Extensions
- **Note Editing**: Direct field editing in browse mode
- **Custom Templates**: User-defined card formats
- **Advanced Import**: Support more file formats
- **Unified Progress**: Cross-shard study progress tracking

### Phase 2 Integration
- **Subtitle Integration**: Convert subtitle segments to notes
- **Dictionary Integration**: Auto-generate vocabulary cards
- **Cross-Shard Study**: Study cards from multiple shards together
- **Progress Analytics**: Learning insights and recommendations

## Technical Notes

### Template Syntax Support
- **Field Substitution**: `{{FieldName}}`
- **FrontSide**: `{{FrontSide}}` for answer templates
- **Conditionals**: `{{#Field}}content{{/Field}}`
- **Media**: Automatic media URL replacement

### Browser Compatibility  
- Modern IndexedDB support required
- ES6+ features used throughout
- Progressive enhancement approach
- Mobile-responsive design

### FSRS Algorithm
- Modern replacement for SM-2 algorithm
- 4-rating system for better accuracy
- Dynamic difficulty adjustment
- Optimal retention targeting