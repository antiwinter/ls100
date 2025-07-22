# Shard-Based Architecture - Implementation Guide

## Overview
LS100 uses a **Shard-Based Architecture** where learning content is organized into modular containers called **Shards**, with reusable **Modules** providing functionality across different shard types.

## Data Model Design

### Shard Structure
```javascript
{
  id: "shard_123",
  type: "subtitle", // "deck", "book"
  name: "The Matrix",
  metadata: {
    duration: "02:16:00",
    language: "en", 
    difficulty: "intermediate"
  },
  modules: ["reader", "marker", "dictionary", "cards"],
  content: { /* shard-specific content */ },
  progress: { /* user progress data */ }
}
```

### Module Data (Shared Across Shards)
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
- **Home**: Shard library (browse all your shards)
- **Study**: Active learning session (current shard + modules)
- **Review**: Card review system (crosses all shards)
- **Profile**: Settings and progress

### Shard Navigation Flow
```
Home (Shard Library) → Shard Detail → Module Selection → Learning Session
```

## API Endpoint Strategy

### Shard Management
```javascript
GET  /api/shards             // List user's shards
POST /api/shards             // Create new shard
GET  /api/shards/:id         // Get shard details
PUT  /api/shards/:id         // Update shard
```

### Module APIs (Shard-Agnostic)
```javascript
GET  /api/modules/dictionary/lookup/:word
POST /api/modules/cards/review
GET  /api/modules/words/selected
```

## Implementation Approach

### Phase 1 Adjustment: Start with Subtitle Shard
```javascript
// Build subtitle upload as the first shard type
client/src/shards/subtitle/
├── SubtitleUpload.jsx     // Shard creation
├── SubtitleReader.jsx     // Reader module integration
├── SubtitleMarker.jsx     // Word selection
└── SubtitleShard.jsx      // Main container
```

### Module Development Order
1. **Reader Module** (Phase 1) - Display subtitle content
2. **Marker Module** (Phase 1) - Word selection  
3. **Dictionary Module** (Phase 2) - Word lookup
4. **Cards Module** (Phase 3) - Review system

## State Management Strategy

### Context Architecture
```javascript
// Shard Context (current active shard)
const ShardContext = createContext()

// Module Contexts (shared state)
const DictionaryContext = createContext()
const CardsContext = createContext()

// Usage: Modules subscribe to their contexts
// Shards provide shard-specific data to modules
```

## Development Benefits

### Architectural Advantages
- **Incremental**: Start with subtitle shard, add deck/book later
- **Reusable**: Dictionary module works for all shard types
- **Testable**: Each module can be tested independently  
- **Scalable**: Easy to add new shard types (PDF, video, etc.)

## Code Organization for Phase 1

### Directory Structure Setup
```bash
# Create the structure now
mkdir -p client/src/shards/subtitle
mkdir -p client/src/modules/{reader,marker,dictionary,cards}
mkdir -p server/shards server/modules
```

### Implementation Strategy

#### Option A: Full Shard Implementation (Phase 1)
- Refactor current Home.jsx to implement Shard Library concept
- Build subtitle functionality as first shard type
- Establish full modular architecture from start

#### Option B: Gradual Introduction (Recommended)
- Keep current Home.jsx for Phase 1
- Build subtitle upload as `client/src/shards/subtitle/SubtitleShard.jsx`
- Establish shard pattern without breaking existing functionality
- Gradually migrate to full shard system in later phases

## Future Shard Types

### Deck Shard
- Import/export Anki decks
- Card creation and editing
- Uses: Dictionary + Cards modules

### Book Shard  
- Text/PDF reading interface
- Chapter navigation and bookmarks
- Uses: Reader + Marker + Dictionary + Cards modules

## Module Specifications

### Reader Module
**Purpose**: Text display and navigation
**Used by**: Subtitle Shard, Book Shard
**Features**: Pagination, text formatting, navigation controls

### Marker Module
**Purpose**: Text selection and highlighting
**Used by**: Subtitle Shard, Book Shard  
**Features**: Word selection, highlighting, selection persistence

### Dictionary Module
**Purpose**: Word lookup and definitions
**Used by**: All shard types
**Features**: Definition lookup, translation, pronunciation

### Cards Module
**Purpose**: Spaced repetition review system
**Used by**: All shard types
**Features**: Card creation, review scheduling, progress tracking

## Implementation Notes

### Phase 1 Focus
- Establish shard structure with Subtitle Shard
- Implement Reader and Marker modules
- Maintain current Home UI for now

### Future Phases
- Add Dictionary module (Phase 2)
- Add Cards module (Phase 3)
- Implement full Shard Library UI
- Add additional shard types (Deck, Book)

### Technical Considerations
- Module isolation for independent testing
- Shared state management across modules
- Shard-agnostic module APIs
- Consistent data models across shard types 