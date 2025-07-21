# Pack-Based Architecture - Implementation Guide

## Overview
LS100 uses a **Pack-Based Architecture** where learning content is organized into modular containers called **Packs**, with reusable **Modules** providing functionality across different pack types.

## Data Model Design

### Pack Structure
```javascript
{
  id: "pack_123",
  type: "subtitle", // "deck", "book"
  name: "The Matrix",
  metadata: {
    duration: "02:16:00",
    language: "en", 
    difficulty: "intermediate"
  },
  modules: ["reader", "marker", "dictionary", "cards"],
  content: { /* pack-specific content */ },
  progress: { /* user progress data */ }
}
```

### Module Data (Shared Across Packs)
```javascript
{
  userId: "user_123",
  module: "dictionary",
  data: {
    selectedWords: ["word1", "word2"],
    lookupHistory: [...],
    favorites: [...]
  }
}
```

## Navigation Strategy

### Updated Bottom Navigation
- **Home**: Pack library (browse all your packs)
- **Study**: Active learning session (current pack + modules)
- **Review**: Card review system (crosses all packs)
- **Profile**: Settings and progress

### Pack Navigation Flow
```
Home (Pack Library) → Pack Detail → Module Selection → Learning Session
```

## API Endpoint Strategy

### Pack Management
```javascript
GET  /api/packs              // List user's packs
POST /api/packs              // Create new pack
GET  /api/packs/:id          // Get pack details
PUT  /api/packs/:id          // Update pack
```

### Module APIs (Pack-Agnostic)
```javascript
GET  /api/modules/dictionary/lookup/:word
POST /api/modules/cards/review
GET  /api/modules/words/selected
```

## Implementation Approach

### Phase 1 Adjustment: Start with Subtitle Pack
```javascript
// Build subtitle upload as the first pack type
client/src/packs/subtitle/
├── SubtitleUpload.jsx     // Pack creation
├── SubtitleReader.jsx     // Reader module integration
├── SubtitleMarker.jsx     // Word selection
└── SubtitlePack.jsx       // Main container
```

### Module Development Order
1. **Reader Module** (Phase 1) - Display subtitle content
2. **Marker Module** (Phase 1) - Word selection  
3. **Dictionary Module** (Phase 2) - Word lookup
4. **Cards Module** (Phase 3) - Review system

## State Management Strategy

### Context Architecture
```javascript
// Pack Context (current active pack)
const PackContext = createContext()

// Module Contexts (shared state)
const DictionaryContext = createContext()
const CardsContext = createContext()

// Usage: Modules subscribe to their contexts
// Packs provide pack-specific data to modules
```

## Development Benefits

### Architectural Advantages
- **Incremental**: Start with subtitle pack, add deck/book later
- **Reusable**: Dictionary module works for all pack types
- **Testable**: Each module can be tested independently  
- **Scalable**: Easy to add new pack types (PDF, video, etc.)

## Code Organization for Phase 1

### Directory Structure Setup
```bash
# Create the structure now
mkdir -p client/src/packs/subtitle
mkdir -p client/src/modules/{reader,marker,dictionary,cards}
mkdir -p server/packs server/modules
```

### Implementation Strategy

#### Option A: Full Pack Implementation (Phase 1)
- Refactor current Home.jsx to implement Pack Library concept
- Build subtitle functionality as first pack type
- Establish full modular architecture from start

#### Option B: Gradual Introduction (Recommended)
- Keep current Home.jsx for Phase 1
- Build subtitle upload as `client/src/packs/subtitle/SubtitlePack.jsx`
- Establish pack pattern without breaking existing functionality
- Gradually migrate to full pack system in later phases

## Future Pack Types

### Deck Pack
- Import/export Anki decks
- Card creation and editing
- Uses: Dictionary + Cards modules

### Book Pack  
- Text/PDF reading interface
- Chapter navigation and bookmarks
- Uses: Reader + Marker + Dictionary + Cards modules

## Module Specifications

### Reader Module
**Purpose**: Text display and navigation
**Used by**: Subtitle Pack, Book Pack
**Features**: Pagination, text formatting, navigation controls

### Marker Module
**Purpose**: Text selection and highlighting
**Used by**: Subtitle Pack, Book Pack  
**Features**: Word selection, highlighting, selection persistence

### Dictionary Module
**Purpose**: Word lookup and definitions
**Used by**: All pack types
**Features**: Definition lookup, translation, pronunciation

### Cards Module
**Purpose**: Spaced repetition review system
**Used by**: All pack types
**Features**: Card creation, review scheduling, progress tracking

## Implementation Notes

### Phase 1 Focus
- Establish pack structure with Subtitle Pack
- Implement Reader and Marker modules
- Maintain current Home UI for now

### Future Phases
- Add Dictionary module (Phase 2)
- Add Cards module (Phase 3)
- Implement full Pack Library UI
- Add additional pack types (Deck, Book)

### Technical Considerations
- Module isolation for independent testing
- Shared state management across modules
- Pack-agnostic module APIs
- Consistent data models across pack types 