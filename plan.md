# LS100 Development Plan - Shard-Based Architecture

## Project Overview

**Goal**: Build a modern subtitle-based language learning app using shard-based architecture
**Approach**: Modular shard system with reusable components for scalable learning content
**Foundation**: React + Express.js (Phase 0 ✅) + Shard Architecture + Research findings

## Architecture Overview

### Shard-Based System
**Shards** = Learning content containers (movie subtitles, flashcard decks, books)
**Modules** = Reusable functionality across shard types (reader, dictionary, cards)

### Core Concept
- **Subtitle Shard**: Movie/TV subtitle learning (Phase 1)
- **Deck Shard**: Flashcard collections (Future)
- **Book Shard**: Reading materials (Future)

### Module System
- **Reader Module**: Text display and navigation
- **Marker Module**: Word selection and highlighting
- **Dictionary Module**: Word lookup and definitions
- **Cards Module**: Spaced repetition review

## Research Foundation ✅

Based on completed research, we have validated free APIs for:
- **Dictionary**: Free Dictionary API + MyMemory Translation (no auth needed)
- **LLM Context**: OpenRouter free models for cultural analysis  
- **TTS**: ResponsiveVoice + Web Speech API fallback
- **Subtitles**: OpenSubtitles API + YIFY fallback

## Development Phases

### Phase 0: Authentication & Layout ✅ COMPLETE

#### 0.1 Backend: Authentication System ✅
**Status**: Complete - JWT auth with JSON storage

**Completed**:
- `/api/auth/register`, `/api/auth/login`, `/api/auth/me` endpoints
- JWT token generation with bcryptjs password hashing
- JSON file storage: `server/data/users.json`
- AuthContext with localStorage token persistence

#### 0.2 Frontend: Main App Layout ✅
**Status**: Complete - Mobile-first bottom navigation

**Completed**:
- Home.jsx with 4-tab bottom navigation (Home/Explore/Friends/Me)
- MUI Joy UI styling with responsive design
- AuthContext integration and protected routes
- User authentication flow

### Phase 1: Subtitle Shard Foundation (Week 2-3)

#### 1.1 Backend: Optimized Shard & Subtitle Storage System
**Goal**: Create efficient, deduplicated storage with sharing capabilities

**Backend Tasks**:
- Create centralized subtitle storage system in `data/subtitles/`
- Implement hash-based deduplication (SHA256 filenames)
- Create subtitle index system: `data/subtitles/index.json`
- Implement `/api/shards` endpoints (GET, POST, PUT, DELETE)
- Create `/api/shards/subtitle/upload` endpoint with required hash parameter
- Parse SRT format using `subtitle` library
- Store shard data in `data/shards/` (all users, with public/private flag)
- Store progress data in `data/{user-id}/progress/`
- Research lite OSS implementation (consider SQLite for index management)

**Technical Considerations**:
- **Index Storage**: Consider SQLite for `data/subtitles/index.json` if JSON becomes too large
- **Hash Algorithm**: SHA256 provides good collision resistance for file deduplication
- **Concurrent Access**: Implement file locking for subtitle index updates
- **OSS Integration**: Research lightweight OSS libraries (MinIO, LocalStack) for future scaling
- **Simplified APIs**: Hash serves as subtitle_id, eliminating need for separate check-hash endpoint
- **User Data Organization**: All user data (progress, modules) grouped under `data/{user-id}/`

**Subtitle Storage Structure**:
```javascript
// data/subtitles/index.json
{
  "subtitle_entries": {
    "abc123def456...": {
      subtitle_id: "abc123def456...", // Same as hash - guaranteed unique
      filename: "abc123def456.srt",
      movie_name: "The Matrix",
      language: "en", 
      duration: "02:16:00",
      reference_count: 3,
      first_uploaded: "2024-01-01T12:00:00Z"
    }
  }
}

// Physical file: data/subtitles/abc123def456.srt
```

**Shard Data Structure**:
```javascript
// data/shards/{shard-id}.json
{
  id: "shard_123",
  type: "subtitle",
  name: "My Matrix Study Session", // User-defined shard name
  owner: "user_456",
  description: "Learning English through The Matrix",
  cover: "https://example.com/matrix-poster.jpg",
  metadata: {
    movie_name: "The Matrix",        // From subtitle metadata
    duration: "02:16:00"
  },
  subtitles: ["abc123def456..."],    // References to subtitle hash IDs
  public: true,                      // Shareable with community
  created_at: "2024-01-01T12:00:00Z",
  updated_at: "2024-01-01T12:00:00Z"
}
```

**Progress Data Structure**:
```javascript
// data/{user-id}/progress/{shard-id}.json
{
  shard_id: "shard_123",
  timestamp: "2024-01-01T12:30:00Z", // use ts to lookup position
  words: ["matrix", "boofoo"],
  bookmarks: [
    {
      timestamp: "2024-01-01T12:30:00Z",
      note: "Important scene"
    }
  ],
  study_time: 1800, // seconds
  completion_rate: 0.35
}
```

**Lightning Upload Flow**:
1. Frontend computes SHA256 hash of uploaded file
2. Call `/api/shards/subtitle/upload` with hash parameter and file
3. If hash exists in index: Return subtitle_id instantly (lightning upload)
4. If new: Upload file, process, add to index, return subtitle_id

**Test**: 
- Upload same subtitle twice → Second upload is instant (hash-based detection)
- Create public shard → Other users can discover it
- Progress tracking works independently of shard data
- User data properly organized under individual directories

#### 1.2 Frontend: Navigation Update & Shard Library
**Goal**: Update navigation to support public/private shard system

**Frontend Tasks**:
- Keep existing Home.jsx bottom navigation: **Home** / **Explore** / **Friends** / **Me**
- Update HomeTab to show personal Shard Library (user's own shards with preview cards)
- Update ExploreTab for public shard discovery (popular shards, subtitle search, trending content)
- Update FriendsTab for social features (shared shards from friends, community shards)
- Update MeTab for profile (progress, export, settings, public shard management)
- Create ShardUpload.jsx with hash-based lightning upload
- Add public/private toggle when creating shards
- Add study session navigation from any tab
- Create PublicShardBrowser.jsx for discovering community content

**Navigation Strategy**:
```
Home → Personal Shard Library → Select/Create Shard → Study Session
Explore → Public Shard Discovery → Use Existing/Create Copy → Study
Friends → Friend's Shared Shards → Study Session  
Me → Personal Progress & Manage Public Shards
```

**Enhanced Features**:
- **Lightning Upload**: Hash check before upload for instant shard creation
- **Public Discovery**: Browse popular public shards by other users
- **Social Learning**: Friends can share their shards and see progress
- **Community Content**: Discover trending learning content

**Test**: Navigation works, can browse public shards, lightning upload functions correctly

#### 1.3 Frontend: First Subtitle Shard Implementation
**Goal**: Create the subtitle shard with Reader and Marker modules

**Frontend Tasks**:
- Create `client/src/shards/subtitle/` directory structure:
  - `SubtitleShard.jsx` - Main shard container
  - `SubtitleUpload.jsx` - File upload component  
  - `SubtitleReader.jsx` - Reader module implementation
- Create `client/src/modules/reader/` directory:
  - `ReaderModule.jsx` - Reusable reader component
  - `TextLine.jsx` - Individual text line component
- Create `client/src/modules/marker/` directory:
  - `MarkerModule.jsx` - Word selection functionality
  - `WordMarker.jsx` - Individual word highlighting

**Module Integration**:
- SubtitleShard uses Reader + Marker modules
- Reader displays subtitle lines with timestamps
- Marker makes words clickable and tracks selections
- Modular design allows reuse in future shard types

**Test**: Upload SRT → Create subtitle shard → View in reader → Click words to select

#### 1.4 Backend: Module Data Management
**Goal**: Store module data separately from shard content

**Backend Tasks**:
- Create `/api/modules/words/` endpoints for selected words
- Store module data in `data/modules/{user-id}/` structure
- Track selected words across shards (words can be from multiple shards)
- Create word selection history and statistics

**Module Data Structure**:
```javascript
{
  userId: "user_123",
  module: "marker",
  data: {
    selectedWords: [
      {
        word: "matrix",
        shardId: "shard_123", 
        context: "Welcome to the real world",
        timestamp: "2024-01-01T12:00:00Z"
      }
    ]
  }
}
```

**Test**: Select words → Data persists → View selected words across shards

### Phase 2: Dictionary Module Integration (Week 4)

#### 2.1 Backend: Dictionary Module API
**Goal**: Add dictionary functionality as a reusable module

**Backend Tasks**:
- Create `server/modules/dictionary.js`
- Implement Free Dictionary API client
- Add MyMemory Translation API client  
- Create `/api/modules/dictionary/lookup/:word` endpoint
- Add word stemming logic for variations (run/running/ran)
- Cache dictionary results for performance

**Module Architecture**:
- Dictionary module is shard-agnostic
- Can be used by any shard type (subtitle, book, deck)
- Consistent API across all shard types

**Test**: API provides definitions and translations for words

#### 2.2 Frontend: Dictionary Module UI
**Goal**: Create reusable dictionary panel component

**Frontend Tasks**:
- Create `client/src/modules/dictionary/` directory:
  - `DictionaryModule.jsx` - Main dictionary component
  - `DefinitionPanel.jsx` - Definition display
  - `TranslationPanel.jsx` - Translation display
- Integrate dictionary module into SubtitleShard
- Show definition panel when word is clicked
- Display English definition + Chinese translation

**Test**: Click word in subtitle → See definition panel → Shows English + Chinese

#### 2.3 Frontend: Enhanced Word Selection
**Goal**: Connect marker and dictionary modules

**Frontend Tasks**:
- Update MarkerModule to trigger dictionary lookup
- Create contextual popup for quick definitions
- Add word difficulty indicators
- Show etymology and pronunciation info

**Test**: Click word → Instant definition popup → Can save to selected words

### Phase 3: Enhanced Learning Features (Week 5)

#### 3.1 Backend: LLM Context Module
**Goal**: Add cultural context analysis module

**Backend Tasks**:
- Create `server/modules/llm.js`
- Integrate OpenRouter free models
- Create `/api/modules/llm/analyze` endpoint
- Pass word + subtitle context + movie metadata
- Cache LLM responses (token optimization)

**Test**: Word + context → Cultural explanation and movie-specific insights

#### 3.2 Frontend: TTS (Text-to-Speech) Module
**Goal**: Add pronunciation functionality

**Frontend Tasks**:
- Create `client/src/modules/tts/` directory:
  - `TTSModule.jsx` - Main TTS component
  - `PronunciationButton.jsx` - Pronunciation trigger
- Add ResponsiveVoice integration + Web Speech fallback
- Add pronunciation buttons to dictionary panel
- Add "read subtitle line" functionality

**Test**: Click pronunciation → Hear word/sentence spoken

#### 3.3 Frontend: Study Session Enhancement
**Goal**: Create focused study mode

**Frontend Tasks**:
- Create StudySession.jsx component
- Combine Reader + Marker + Dictionary + TTS modules
- Add progress tracking within shard
- Create study session controls (play/pause/speed)

**Test**: Start study session → All modules work together seamlessly

### Phase 4: Cards Module & Review System (Week 6)

#### 4.1 Backend: Cards Module Implementation
**Goal**: Spaced repetition review system

**Backend Tasks**:
- Create `server/modules/cards.js`
- Implement spaced repetition algorithm
- Create `/api/modules/cards/` endpoints (create, review, schedule)
- Generate cards from selected words automatically
- Track review performance and difficulty

**Card Data Structure**:
```javascript
{
  id: "card_123",
  word: "matrix",
  definition: "...",
  context: "Welcome to the real world",
  shardId: "shard_123",
  difficulty: 0.5,
  nextReview: "2024-01-02T12:00:00Z",
  reviewHistory: [...]
}
```

**Test**: Selected words become cards → Review scheduling works

#### 4.2 Frontend: Cards Module UI
**Goal**: Review interface for spaced repetition

**Frontend Tasks**:
- Create `client/src/modules/cards/` directory:
  - `CardsModule.jsx` - Main review interface
  - `ReviewCard.jsx` - Individual card component
  - `ReviewSession.jsx` - Review session flow
- Add review functionality to Home tab (due cards widget)
- Add floating review button when cards are due
- Show due cards count and review streaks in Home
- Integrate with existing dictionary definitions

**Test**: Home tab → See due cards → Complete review session

#### 4.3 Frontend: Export System
**Goal**: Export learning data in standard formats

**Frontend Tasks**:
- Create export functionality from selected words and cards
- Support Eudic XML and Anki CSV formats
- Add export buttons to Me tab (profile section)
- Include word, definition, context, and shard source

**Test**: Export → Import to Eudic/Anki → Data transfers correctly

### Phase 5: Subtitle Search & Discovery (Week 7)

#### 5.1 Backend: Subtitle Search Integration
**Goal**: Find and download new subtitle content

**Backend Tasks**:
- Create `server/shards/subtitle-search.js`
- Integrate OpenSubtitles API client
- Add YIFY fallback scraper
- Create `/api/shards/subtitle/search/:query` endpoint
- Handle API keys and rate limiting

**Test**: Search "Matrix" → Return subtitle results with metadata

#### 5.2 Frontend: Subtitle Discovery
**Goal**: Discover and import new subtitle shards

**Frontend Tasks**:
- Update Explore tab to include subtitle search and discovery
- Create SubtitleSearch.jsx component
- Display search results with download options
- Show language options and quality ratings
- One-click shard creation from search results

**Test**: Search movie → Download subtitle → Auto-create shard → Start studying

### Phase 6: Advanced Shard Features (Week 8)

#### 6.1 Backend: Shard Analytics & Progress
**Goal**: Detailed learning analytics

**Backend Tasks**:
- Add detailed progress tracking per shard
- Calculate learning statistics (words per minute, comprehension)
- Create `/api/shards/:id/analytics` endpoint
- Track module usage patterns

**Test**: Study session generates meaningful analytics

#### 6.2 Frontend: Enhanced Profile & Progress
**Goal**: Comprehensive learning dashboard

**Frontend Tasks**:
- Update Me tab with detailed progress dashboard
- Add learning streaks and achievements
- Show shard completion percentages
- Create learning goal setting and tracking

**Test**: Me tab shows comprehensive learning progress across all shards

### Phase 7: Mobile Optimization & PWA (Week 9)

#### 7.1 Frontend: Mobile Enhancement
**Goal**: Perfect mobile experience

**Frontend Tasks**:
- Optimize touch interactions for word selection
- Improve responsive design for all modules
- Add gesture controls for navigation
- Optimize for various screen sizes

**Test**: All functionality works smoothly on mobile devices

#### 7.2 Frontend: Progressive Web App
**Goal**: Native app-like experience

**Frontend Tasks**:
- Add PWA manifest and service worker
- Enable offline reading for downloaded shards
- Add app installation prompts
- Cache dictionary lookups for offline use

**Test**: App installs on mobile → Works offline

## Technology Stack

### Backend
- **Framework**: Express.js (current)
- **Authentication**: JWT tokens + bcryptjs password hashing
- **Storage**: JSON files in modular structure (`data/shards/`, `data/modules/`)
- **APIs**: Free Dictionary, MyMemory, OpenRouter, OpenSubtitles
- **File Processing**: `subtitle` library for SRT parsing, `multer` for uploads

### Frontend  
- **Framework**: React 18 + Vite (current)
- **Routing**: React Router for navigation
- **Styling**: MUI Joy UI (current)
- **State**: React Context for shard and module state management
- **TTS**: ResponsiveVoice + Web Speech API

## Updated File Structure

```
ls100/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/            # Existing auth components
│   │   │   └── layout/          # Navigation and layout
│   │   ├── shards/
│   │   │   ├── subtitle/        # Subtitle shard implementation
│   │   │   │   ├── SubtitleShard.jsx
│   │   │   │   ├── SubtitleUpload.jsx
│   │   │   │   └── SubtitleReader.jsx
│   │   │   ├── deck/            # Future: flashcard shards
│   │   │   └── book/            # Future: book reading shards
│   │   ├── modules/
│   │   │   ├── reader/          # Text reading components
│   │   │   ├── marker/          # Word selection/highlighting
│   │   │   ├── dictionary/      # Word lookup UI
│   │   │   ├── cards/           # Review system UI
│   │   │   └── tts/             # Text-to-speech
│   │   ├── pages/
│   │   │   ├── Home.jsx         # Updated navigation
│   │   │   ├── ShardLibrary.jsx # Shard browsing
│   │   │   ├── StudySession.jsx # Active learning
│   │   │   └── ReviewSession.jsx # Card review
│   │   ├── context/
│   │   │   ├── AuthContext.jsx  # Existing
│   │   │   ├── ShardContext.jsx # Shard state management
│   │   │   └── ModuleContext.jsx # Module state management
│   │   └── utils/
│   │       └── shard-helpers.js
├── server/
│   ├── api/
│   │   ├── auth.js              # Existing auth
│   │   └── shards.js            # Shard management
│   ├── shards/
│   │   ├── subtitle.js          # Subtitle shard logic
│   │   ├── deck.js              # Future: deck shard
│   │   └── book.js              # Future: book shard
│   ├── modules/
│   │   ├── dictionary.js        # Dictionary API
│   │   ├── cards.js             # Card review API
│   │   ├── words.js             # Word management
│   │   ├── llm.js               # LLM context analysis
│   │   └── analytics.js         # Progress tracking
│   └── data/
│       ├── users.json           # User authentication data
│       ├── subtitles/           # Centralized subtitle storage (OSS-like)
│       │   ├── index.json       # Subtitle metadata index
│       │   ├── abc123def456.srt # Deduplicated subtitle files (SHA256 names)
│       │   └── 789ghi012jkl.srt # Additional subtitle files
│       ├── shards/              # Public/private shards (all users)
│       │   ├── shard_001.json   # Individual shard files
│       │   ├── shard_002.json   # User-owned or public shards
│       │   └── shard_003.json   # Discoverable community content
│       ├── user_123/            # Individual user data directory
│       │   ├── progress/        # User progress tracking
│       │   │   ├── shard_001.json # Progress for specific shard
│       │   │   └── shard_002.json # Independent of shard ownership
│       │   └── modules/         # Module data by user
│       │       ├── dictionary.json
│       │       ├── cards.json
│       │       └── words.json
│       └── user_456/            # Another user's data directory
│           ├── progress/
│           └── modules/
```

## Storage Architecture Benefits

### 🚀 **Efficiency Gains**
- **Deduplication**: Same subtitle shared across multiple users/shards
- **Lightning Upload**: Hash check prevents re-upload of existing content
- **Scalable Storage**: OSS-like structure supports growth
- **Community Content**: Public shards enable content sharing

### 📊 **Data Organization**
- **Centralized Subtitles**: Single source of truth for subtitle files  
- **Flexible Shards**: Users create personalized learning experiences
- **Separated Progress**: User data independent of shared content
- **Index Management**: Fast metadata queries and content discovery

## Testing Strategy

Each phase builds on modular architecture:
0. **Auth & Layout** ✅ → Login system + navigation
1. **Subtitle Shard** → Upload + Reader + Marker modules + Lightning upload
2. **Dictionary Module** → Word lookup integration  
3. **Enhanced Learning** → LLM context + TTS + Study sessions
4. **Cards Module** → Review system + Export
5. **Discovery** → Search and download new content + Public shard browsing
6. **Analytics** → Progress tracking and insights
7. **Mobile/PWA** → Perfect mobile experience

## Key Success Metrics

- ✅ Secure user authentication and session management
- ✅ Efficient deduplicated storage with lightning uploads
- ✅ Modular shard architecture for scalable content types
- ✅ Public/private shard system with community sharing
- ✅ Upload and study subtitle content with word selection
- ✅ Dictionary lookup with definitions and translations
- ✅ Spaced repetition review system with progress tracking
- ✅ Content discovery and automatic shard creation
- ✅ Mobile-optimized with offline capabilities
- ✅ Export functionality for external tools (Anki, Eudic)

## Benefits of Optimized Shard Architecture

1. **Storage Efficiency**: Deduplication saves space and enables lightning uploads
2. **Community Learning**: Public shards create shared learning experiences
3. **Scalability**: Easy to add new content types (PDF, video, articles)
4. **Modularity**: Reusable components across different shard types
5. **User Experience**: Consistent interface regardless of content type
6. **Development**: Clear separation of concerns, easier testing
7. **Future-Proof**: Architecture supports unlimited learning content types

## Next Steps

1. **Begin Phase 1.1**: Set up optimized shard & subtitle storage system
2. **Then Phase 1.2**: Update navigation with public/private shard support
3. **Then Phase 1.3**: Implement Subtitle Shard with Reader/Marker modules
4. **Test incrementally**: Lightning upload, public sharing, progress tracking
5. **Maintain modularity**: Keep shards and modules loosely coupled

This optimized shard-based approach creates a foundation for unlimited learning content types while enabling efficient storage, community sharing, and lightning-fast uploads.