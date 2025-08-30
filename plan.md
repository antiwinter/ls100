# LS100 Development Plan - Shard-Based Architecture

## Project Overview

**Goal**: Build a modern subtitle-based language learning app using shard-based architecture
**Approach**: Modular shard system with reusable components for scalable learning content
**Foundation**: React + Express.js (Phase 0 ✅) + SQLite Database + Research findings

## Architecture Overview

### Shard-Based System
**Shards** = Learning content containers (movie subtitles, flashcard decks, books)
**Modules** = Reusable functionality across shard types (reader, dictionary, cards)

### Core Concept
- **Subtitle Shard**: Movie/TV subtitle learning (Phase 1)
- **Anki Shard**: Spaced repetition flashcard learning (Phase 2) - [Documentation](./docs/shard-anki/anki.md)
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
- SQLite database with module-based organization
- AuthContext with localStorage token persistence
- Centralized auth middleware in utils

#### 0.2 Frontend: Main App Layout ✅
**Status**: Complete - Mobile-first bottom navigation

**Completed**:
- Home.jsx with 4-tab bottom navigation (Home/Explore/Friends/Me)
- MUI Joy UI styling with responsive design
- AuthContext integration and protected routes
- User authentication flow

### Phase 1: SQLite Foundation & Subtitle Shards (Week 2-3)

#### 1.1 Backend: SQLite Database Setup ✅
**Goal**: Replace JSON storage with SQLite database

**Completed**:
- ✅ SQLite database with module-based organization
- ✅ Database schema and migrations in utils/db/
- ✅ Module-based CRUD operations (auth, shard, subtitle modules)
- ✅ Two-layer storage system implemented
- ✅ Shard management APIs with centralized auth middleware

**Key Features**:
- Hash-based subtitle deduplication
- Lightning upload for existing files
- Public/private shard system
- Progress tracking with foreign keys

#### 1.1.5 Frontend: Modular Shard Component System ✅
**Goal**: Create extensible shard component architecture starting with subtitle type

**Status**: Complete - Full subtitle upload, display, and reader flow working

**Completed**:
- ✅ Subtitle shard component (`client/src/shards/subtitle/`)
  - `SubtitleShard.js` - Logic with detector, shard management, full flow
  - `SubtitleReader.jsx` - UI with navigation and word interaction
  - `index.js` - Clean module exports
- ✅ Content detector with confidence scoring and movie info parsing
- ✅ Subtitle-specific reader with Previous/Next navigation
- ✅ Text-based cover generator with movie title styling
- ✅ Global import component (`src/components/GlobalImport.jsx`)
- ✅ Two-table architecture: `oss_files` (content) + `subtitles` (metadata)
- ✅ Smart language detection with frequency-based algorithm (fixed 98-lang explosion)
- ✅ Human-readable relative timestamps ("Just now", "5 mins ago")
- ✅ Lightning upload detection for duplicate content vs metadata
- ✅ Clean UI with extracted components (HeaderToolbar, BottomNav, ShardBrowser)

**Flow**: Upload SRT → Auto-detect subtitle → Create shard → Show in home → Open reader ✅

#### 1.1.6 Frontend: Shard Creation Flow Optimization ✅
**Goal**: Streamline "Create a Shard" experience from multi-step dialog to full-page flow

**Status**: Complete - Enhanced UI/UX with type-agnostic architecture

**Completed**:
- ✅ **Full-Page EditShard** (`client/src/pages/EditShard.jsx`)
  - Converted from dialog to dedicated page with back button
  - Fixed action bar at bottom for mobile-friendly experience
  - Hidden horizontal scroll, proper responsive design
- ✅ **Streamlined Import Flow** 
  - Skip intermediate "upload/detection" dialog
  - Direct navigation from file selection to EditShard page
  - Processing state with LinearProgress indicator
- ✅ **Type-Agnostic Architecture** (`client/src/shards/engines.js`)
  - Shard engine registry system for extensibility
  - Generic functions: `getSuggestedName`, `getShardTypeInfo`, `createShard`, `getEditorComponent`
  - Clean separation of concerns between UI and shard-specific logic
- ✅ **Enhanced EditShard UX**
  - Movie name as default shard name with proper casing
  - Shard type chip moved to label row for better hierarchy  
  - Description as link that opens dialog, inline display when present
  - Click-to-edit cover preview with dynamic generation
- ✅ **Mobile-Optimized Language Selection**
  - CSS ellipsis for accurate filename truncation (no JS char counting)
  - Long press (500ms) to show full filename in modal
  - Short press to select learning language
  - Cross-platform touch/mouse event handling
  - Centered language chips with improved visual design
- ✅ **Dynamic Cover System**
  - Consistent text styling between browser and preview
  - Only save custom covers (URL/upload), use dynamic generation as default
  - Proper font sizing and letter spacing for movie titles

**Flow**: Select file → Auto-process → Navigate to EditShard → Configure → Create ✅

#### 1.2 Frontend: Navigation Update & Shard Library
**Goal**: Update navigation for shard-based system

**Tasks**:
- Keep existing Home/Explore/Friends/Me navigation
- Update HomeTab to show Shard Library (user's shards)
- Update ExploreTab for public shard discovery
- Update FriendsTab for social features
- Update MeTab for profile and settings
- Create shard upload component with hash computation

#### 1.3 Frontend: First Subtitle Shard Implementation
**Goal**: Create subtitle shard with Reader and Marker modules

**Tasks**:
- Create subtitle shard component structure
- Implement Reader module (display subtitle lines)
- Implement Marker module (word selection)
- Create study session navigation
- Test complete upload → create shard → study flow

#### 1.4 Backend: Module Data Management
**Goal**: Store module data in database

**Tasks**:
- Create progress table for user learning data
- Track selected words across shards
- Implement word selection history
- Store bookmarks and study time

### Phase 2: Dictionary Module Integration (Week 4)

**Goal**: Add dictionary lookup as reusable module

**Tasks**:
- Implement dictionary API integration
- Create dictionary UI components
- Connect marker and dictionary modules
- Add pronunciation features

### Phase 3: Enhanced Learning Features (Week 5)

**Goal**: Add LLM context and TTS features

**Tasks**:
- Integrate OpenRouter for cultural context
- Add text-to-speech functionality
- Create comprehensive study sessions
- Combine all modules seamlessly

### Phase 4: Cards Module & Review System (Week 6)

**Goal**: Spaced repetition review system with Anki integration

**Tasks**:
- Implement Anki Shard for .apkg file import ([docs](./docs/shard-anki/anki.md))
- Integrate FSRS spaced repetition algorithm  
- Create review UI components with browse/study modes
- Generate cards from selected words
- Add export functionality (Anki, Eudic)

**Components**:
- AnkiShard engine with frontend-only storage
- Card template parser for browser rendering
- Study engine with progress tracking
- Storage manager using IndexedDB + localStorage

### Phase 5: Content Discovery (Week 7)

**Goal**: Find and share subtitle content

**Tasks**:
- Integrate subtitle search APIs
- Create public shard discovery
- Implement social sharing features
- One-click shard creation from search

### Phase 6: Analytics & Progress (Week 8)

**Goal**: Detailed learning analytics

**Tasks**:
- Advanced progress tracking
- Learning statistics and insights
- Goal setting and achievements
- Comprehensive user dashboard

### Phase 7: Mobile & PWA (Week 9)

**Goal**: Perfect mobile experience

**Tasks**:
- Mobile UI optimization
- Progressive Web App features
- Offline functionality
- App installation

## Technology Stack

### Backend
- **Framework**: Express.js
- **Database**: SQLite → PostgreSQL/MySQL migration path
- **Authentication**: JWT + bcryptjs
- **File Processing**: multer + subtitle library
- **APIs**: Dictionary, Translation, LLM, Subtitle search

### Frontend  
- **Framework**: React 18 + Vite
- **UI**: MUI Joy UI
- **State**: React Context
- **Routing**: React Router
- **TTS**: ResponsiveVoice + Web Speech API

## Module Documentation

- [Auth](docs/auth.md) - User authentication, JWT, database schema
- [Shard](docs/shard.md) - Shard management, API endpoints, progress tracking
- [Subtitle](docs/subtitle.md) - Backend subtitle management, two-layer storage, lightning upload ✅
- [Shard-Subtitle](docs/shard-subtitle.md) - Frontend subtitle shard component, detector, reader ✅
- [Import](docs/import.md) - GlobalImport component, content detection system ✅


## Current Status

**Active Phase**: 1.2 (Next)
**Progress**: Streamlined shard creation flow complete, ready for enhanced navigation and discovery features

**Latest Completion**: Phase 1.1.6 - Shard creation flow optimization with full-page UI and type-agnostic architecture

**Phases Complete**:
- **Phase 0**: ✅ Auth + Navigation 
- **Phase 1.1**: ✅ SQLite Database Setup
- **Phase 1.1.5**: ✅ Modular Shard Component System
- **Phase 1.1.6**: ✅ Shard Creation Flow Optimization
- **Next**: Phase 1.2 - Navigation Update & Shard Library

## Success Metrics

- ✅ Secure authentication and session management
- ✅ SQLite database with ACID transactions
- ✅ Lightning upload system with deduplication
- ✅ Public/private shard sharing
- ✅ Modular architecture for unlimited content types
- ✅ Mobile-optimized PWA experience

This approach creates a robust foundation for unlimited learning content types while providing excellent performance, data integrity, and easy production scaling.