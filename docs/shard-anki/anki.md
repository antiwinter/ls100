# Anki Shard

Anki Shard integrates spaced repetition flashcard functionality into the LS100 shard system, enabling users to study Anki decks alongside other learning content.

## Overview

The Anki Shard provides two primary modes:
- **Browse Mode**: Navigate and explore deck contents
- **Study Mode**: Active learning with spaced repetition algorithm

**Key Design Principles**:
- Frontend-only implementation using browser storage
- No backend modifications required
- Leverages existing shard architecture
- Uses modern FSRS algorithm for optimal learning intervals

## Architecture

### Storage Strategy
- **Shard Metadata**: Stored via global shard API (backend)
- **Deck Data (.apkg)**: IndexedDB (browser)
- **Study Progress**: localStorage with session backup
- **Scheduling Data**: localStorage (FSRS state)

### Core Components

#### AnkiShard Engine
- File detection for `.apkg` files
- Deck parsing and card extraction
- Cover generation for shard preview
- Integration with shard registry

#### AnkiShardEditor
- Deck import interface
- Deck selection and configuration
- Preview of deck statistics
- Multiple deck support per shard

#### AnkiReader
- Mode switching (Browse/Study)
- Card template rendering
- Progress tracking UI
- Session management

### Dependencies

**JavaScript Libraries**:
- `anki-reader`: Parse .apkg files in browser
- `ts-fsrs`: Modern spaced repetition algorithm
- Browser IndexedDB API for deck storage

## Modules

Complex components are documented separately:

- **[Card Parser](./card-parser.md)**: Template parsing and rendering
- **[Study Engine](./study-engine.md)**: FSRS integration and progress tracking
- **[Storage Manager](./storage-manager.md)**: Browser storage coordination

## Integration Points

### Shard System Integration
```javascript
// engines.js
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  anki: ankiEngine  // New addition
}
```

### File Detection
- Detects `.apkg` files with high confidence (0.95)
- Extracts deck name from filename
- Provides metadata for shard creation

### Reader Integration
- Follows existing reader pattern
- Uses familiar UI components from subtitle shard
- Maintains consistent navigation experience

## Data Flow

### Import Flow
1. User selects .apkg file
2. AnkiShardEditor parses deck using anki-reader
3. Deck stored in IndexedDB
4. Shard metadata saved to backend
5. Cards prepared for study

### Study Flow
1. User enters Study Mode
2. FSRS algorithm selects next card
3. Card rendered using template parser
4. User provides rating (Again/Hard/Good/Easy)
5. FSRS updates scheduling
6. Progress saved to localStorage

### Browse Flow
1. User enters Browse Mode
2. Cards loaded from IndexedDB
3. Searchable/filterable card list
4. Card preview with front/back
5. Quick study session initiation

## UI/UX Design

### Browse Mode
- **Left Panel**: Card list with search/filter
- **Right Panel**: Selected card preview
- **Actions**: Start study, edit tags, card statistics

### Study Mode
- **Header**: Session progress, time elapsed, exit option
- **Card Area**: Question/answer display with smooth transitions
- **Controls**: Show answer button, rating buttons (1-4)
- **Footer**: Session statistics, cards remaining

### Editor Mode
- **Import Section**: File selection and deck preview
- **Deck List**: Imported decks with statistics
- **Configuration**: Study preferences, scheduling options

## Performance Considerations

### Browser Storage
- IndexedDB for large deck files (supports binary data)
- localStorage for quick access to progress data
- Session cleanup on app close
- Storage quota management

### Memory Management
- Lazy loading of card content
- Image/media caching strategies
- Efficient card scheduling algorithms
- Background sync of progress data

## Future Enhancements

### Phase 1 Extensions
- Card editing capabilities
- Custom deck creation
- Import from various formats
- Deck sharing between devices

### Phase 2 Integration
- Cross-shard study sessions
- Subtitle-to-card conversion
- Dictionary integration for card creation
- Progress analytics and insights

## Technical Notes

### FSRS Algorithm
- Modern replacement for SM-2 algorithm
- Better scheduling accuracy
- Support for 4-rating system
- Optimal retention targeting

### Template System
- Supports Anki's handlebars-like syntax
- Cloze deletion support
- Conditional field rendering
- Media file handling

### Browser Compatibility
- Modern browser IndexedDB support required
- ES6+ features used throughout
- Progressive enhancement for older browsers
- Mobile-responsive design
