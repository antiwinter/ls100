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

#### 1.1.5 Frontend: Modular Shard Component System
**Goal**: Create extensible shard component architecture starting with subtitle type

**Tasks**:
- Create subtitle shard component (`client/src/shards/subtitle/`)
  - `SubtitleShard.js` - Logic (detector, shard management, full flow)
  - `SubtitleReader.jsx` - UI (reader component)
  - `index.js` - Export all subtitle functionality
- Implement content detector with confidence scoring
- Create subtitle-specific reader/browser component
- Add fallback cover generator (text-based with movie title)
- Build global import component (`src/components/GlobalImport.jsx`)

**Flow**: Upload SRT → Auto-detect subtitle → Create shard → Show in home → Open reader

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

**Goal**: Spaced repetition review system

**Tasks**:
- Implement spaced repetition algorithm
- Create review UI components
- Generate cards from selected words
- Add export functionality (Anki, Eudic)

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
- [Subtitle](docs/subtitle.md) - Backend subtitle management, two-layer storage, lightning upload
- [Shard-Subtitle](docs/shard-subtitle.md) - Frontend subtitle shard component, detector, reader
- [Import](docs/import.md) - GlobalImport component, content detection system

## Current Status

- **Phase 0**: ✅ Complete (Auth + Navigation)
- **Phase 1.1**: ✅ Complete (SQLite setup with module organization)
- **Phase 1.1.5**: 📋 Next (Modular shard component system)
- **Next**: Frontend shard library and subtitle upload component

## Success Metrics

- ✅ Secure authentication and session management
- ✅ SQLite database with ACID transactions
- ✅ Lightning upload system with deduplication
- ✅ Public/private shard sharing
- ✅ Modular architecture for unlimited content types
- ✅ Mobile-optimized PWA experience

This approach creates a robust foundation for unlimited learning content types while providing excellent performance, data integrity, and easy production scaling.