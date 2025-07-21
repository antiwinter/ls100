# LS100 Development Plan - Build from Scratch

## Project Overview

**Goal**: Build a modern subtitle-based language learning app from scratch
**Approach**: Interleaved backend/frontend development for incremental testing
**Foundation**: React + Express.js (already setup) + Research findings

## Research Foundation ✅

Based on completed research, we have validated free APIs for:
- **Dictionary**: Free Dictionary API + MyMemory Translation (no auth needed)
- **LLM Context**: OpenRouter free models for cultural analysis  
- **TTS**: ResponsiveVoice + Web Speech API fallback
- **Subtitles**: OpenSubtitles API + YIFY fallback

## Development Phases

### Phase 0: Authentication & Layout (Week 1)

#### 0.1 Backend: Simple Authentication System
**Goal**: User registration and login with JSON file storage

**Backend Tasks**:
- Create `/api/auth/register` endpoint
- Create `/api/auth/login` endpoint  
- Create `/api/auth/me` endpoint (get current user)
- Simple JSON file storage: `data/users.json`
- JWT token generation and validation
- Password hashing with bcryptjs

**Frontend Tasks**:
- Create Login.jsx component with form validation
- Create Register.jsx component 
- Create AuthContext for session management
- Store JWT token in localStorage
- Handle login/logout state

**Test**: Register → Login → See user info → Logout → Redirected to login

#### 0.2 Frontend: Main App Layout
**Goal**: Create the main application structure

**Frontend Tasks**:
- Create MainLayout.jsx with header, sidebar, and content areas
- Create Header.jsx with user info and logout button
- Create Sidebar.jsx for navigation (placeholder for now)
- Add React Router for page navigation
- Create ProtectedRoute wrapper component
- Setup basic Tailwind styling

**Test**: Login → See main layout with header/sidebar → Navigation works

### Phase 1: Core Subtitle System (Week 2-3)

#### 1.1 Backend: Subtitle File Handling
**Goal**: Upload and parse SRT files

**Backend Tasks**:
- Add `multer` for file uploads
- Create `/api/subtitle/upload` endpoint
- Parse SRT format using `subtitle` library
- Return structured subtitle data (time, text, index)

**Frontend Tasks**:
- Create upload component with drag-and-drop
- Display uploaded subtitle lines with timestamps
- Add pagination for long subtitles

**Test**: Upload SRT → See subtitles displayed

#### 1.2 Backend: Word Selection Storage  
**Goal**: Track user's selected words

**Backend Tasks**:
- Create `/api/words/select` POST endpoint
- Simple JSON file storage: `data/selected-words.json`
- Return current selection count

**Frontend Tasks**:
- Make subtitle words clickable
- Highlight selected words visually
- Show selection count in header

**Test**: Click words → Words stay selected after refresh

### Phase 2: Dictionary Integration (Week 4)

#### 2.1 Backend: Dictionary API Integration
**Goal**: Look up word definitions

**Backend Tasks**:
- Implement Free Dictionary API client
- Add MyMemory Translation API client  
- Create `/api/dictionary/lookup/:word` endpoint
- Combine English definition + Chinese translation

**Frontend Tasks**:
- Create dictionary panel component
- Show definition when word is clicked
- Display both English definition and Chinese translation

**Test**: Click word → See definition + translation

#### 2.2 Backend: Word Variations Support
**Goal**: Handle plurals, past tense, etc.

**Backend Tasks**:
- Add word stemming logic (from makewords research)
- Try multiple word forms for dictionary lookup
- Cache successful lookups

**Frontend Tasks**:
- Show which word variation was found
- Display "word not found" gracefully

**Test**: Click "running" → Find definition for "run"

### Phase 3: Enhanced Features (Week 5)

#### 3.1 Backend: LLM Context Analysis
**Goal**: Add cultural context for movie words

**Backend Tasks**:
- Integrate OpenRouter free models
- Create `/api/llm/analyze` endpoint
- Pass word + subtitle context for analysis
- Cache LLM responses (they're expensive in tokens)

**Frontend Tasks**:
- Add "Context Analysis" section to dictionary panel
- Show cultural insights and movie context
- Make it collapsible/optional

**Test**: Click movie idiom → See cultural explanation

#### 3.2 Frontend: Text-to-Speech
**Goal**: Pronounce words and sentences

**Frontend Tasks**:
- Add ResponsiveVoice script
- Create TTS utility class with Web Speech fallback
- Add pronunciation buttons to dictionary panel
- Add "read line" button to subtitle lines

**Test**: Click pronunciation → Hear word spoken

### Phase 4: Export System (Week 6)

#### 4.1 Backend: Export API
**Goal**: Export selected words in different formats

**Backend Tasks**:
- Create `/api/export/eudic` endpoint (XML format)
- Create `/api/export/anki` endpoint (CSV format)
- Include word, definition, and translation

**Frontend Tasks**:
- Add export buttons to header
- Download files directly from API
- Show export progress/success

**Test**: Select words → Export → Import to Eudic/Anki

### Phase 5: Subtitle Search (Week 7)

#### 5.1 Backend: Subtitle Search API
**Goal**: Find subtitles for movies

**Backend Tasks**:
- Integrate OpenSubtitles API client
- Add YIFY fallback scraper
- Create `/api/subtitles/search/:query` endpoint
- Handle API keys and rate limiting

**Frontend Tasks**:
- Create subtitle search component
- Display search results with download buttons
- Show language options (EN, CN)

**Test**: Search "Matrix" → Download subtitle → Parse and display

### Phase 6: User Sessions (Week 8)

#### 6.1 Backend: Simple Session Storage
**Goal**: Remember user's progress

**Backend Tasks**:
- Create session ID system (no login required)
- Store progress in `data/sessions/{session-id}.json`
- Track current subtitle, position, selected words

**Frontend Tasks**:
- Generate/store session ID in localStorage
- Auto-save reading position
- Restore last session on page load

**Test**: Select words → Close browser → Reopen → Words still selected

### Phase 7: Mobile Responsive (Week 9)

#### 7.1 Frontend: Mobile Layout
**Goal**: Work well on phones

**Frontend Tasks**:
- Responsive grid for subtitle viewer
- Collapsible dictionary panel
- Touch-friendly word selection
- Optimized text sizes

**Test**: Use on phone → All features work

## Technology Stack

### Backend
- **Framework**: Express.js (current)
- **Authentication**: JWT tokens + bcryptjs password hashing
- **File Storage**: JSON files in `data/` folder
- **APIs**: Free Dictionary, MyMemory, OpenRouter, OpenSubtitles
- **File Processing**: `subtitle` library for SRT parsing

### Frontend  
- **Framework**: React 18 + Vite (current)
- **Routing**: React Router for navigation
- **Styling**: Tailwind CSS
- **State**: React useState/useContext + AuthContext
- **TTS**: ResponsiveVoice + Web Speech API

## File Structure

```
ls100/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   └── Register.jsx
│   │   │   ├── layout/
│   │   │   │   ├── MainLayout.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── SubtitleUpload.jsx
│   │   │   ├── SubtitleViewer.jsx
│   │   │   ├── DictionaryPanel.jsx
│   │   │   └── ExportButtons.jsx
│   │   ├── context/
│   │   │   └── AuthContext.jsx
│   │   ├── utils/
│   │   │   └── tts.js
│   │   └── App.jsx
├── server/
│   ├── api/
│   │   ├── auth.js
│   │   ├── subtitles.js
│   │   ├── dictionary.js
│   │   ├── words.js
│   │   └── export.js
│   ├── utils/
│   │   ├── subtitle-parser.js
│   │   └── word-variations.js
│   └── server.js
└── data/
    ├── users.json
    ├── selected-words.json
    └── sessions/
```

## Testing Strategy

Each phase builds on the previous one:
0. **Auth & Layout** → Login system + main app structure
1. **Upload** → Display subtitles
2. **Click words** → Store selections  
3. **Dictionary** → Show definitions
4. **LLM** → Add context
5. **TTS** → Hear pronunciation
6. **Export** → Download word lists
7. **Search** → Find more subtitles
8. **Sessions** → Remember progress
9. **Mobile** → Work everywhere

## Key Success Metrics

- ✅ Can register and login securely
- ✅ Can upload and view subtitles
- ✅ Can select and look up words
- ✅ Can hear pronunciations
- ✅ Can export word lists
- ✅ Can find new subtitles
- ✅ Works on mobile devices

## Next Steps

1. **Start Phase 0.1**: Set up authentication system
2. **Then Phase 0.2**: Create main app layout  
3. **Then Phase 1.1**: Set up subtitle upload API
4. **Test incrementally**: Each feature works before moving on
5. **Keep it simple**: Simple JSON file storage, no complex databases
6. **Leverage research**: Use the APIs you've already validated

This approach builds a working language learning app step-by-step, where each phase adds one clear feature that can be tested immediately. 