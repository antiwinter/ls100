# LS100 Design Architecture

## Project Overview
English learning app using movie subtitles with mobile-first design.

## Tech Stack
- **Frontend**: React 18 + Vite + MUI Joy UI
- **Backend**: Express.js + Node.js + SQLite
- **Package Manager**: Yarn workspaces
- **Database**: SQLite with migration to PostgreSQL/MySQL path

## Project Structure
```
ls100/
├── client/           # React frontend
├── server/           # Express backend  
├── package.json      # Workspace root
└── plan.md          # Development roadmap
```

## Key Systems

### 1. Authentication System
**Location**: `server/modules/auth/` + `client/src/context/AuthContext.jsx`

- **Backend**: JWT tokens + bcrypt password hashing
- **Storage**: SQLite database with users table
- **Frontend**: React Context with localStorage token persistence
- **Endpoints**: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`

### 2. API Configuration System
**Location**: `client/src/config/api.js`

```javascript
// Environment-aware base URL
API_CONFIG.BASE_URL = getApiBaseUrl()

// Centralized API helper
apiCall('/api/endpoint', options)  // Auto-handles auth + errors
```

**Environment Detection**:
- **Development**: Auto-detects `http://${hostname}:3001`
- **Custom**: Uses `VITE_API_URL` env variable  
- **Production**: Uses same origin (no CORS)

### 3. Main Layout System
**Location**: `client/src/pages/Home.jsx`

- **Mobile-first**: Bottom navigation with 4 tabs
- **Design**: MUI Joy UI with floating navigation
- **Tabs**: Home/Explore/Friends/Me with color-coded active states
- **Icons**: Material-UI icons with proper touch targets

### 4. Development Setup
**Scripts**:
```bash
yarn dev     # Both frontend + backend with hot reload
yarn lint    # ESLint for both workspaces
```

**Network Access**: Both servers bind to `0.0.0.0` for mobile testing

**Code Style**: No semicolons, single quotes, ESM modules

## Data Storage Strategy
- **Database**: SQLite with normalized tables (users, shards, subtitles, progress)
- **Files**: Subtitle files stored with hash-based deduplication
- **Sessions**: JWT tokens (7-day expiry)
- **Migration**: Easy path to PostgreSQL/MySQL for production

## API Patterns
```javascript
// Standard API call pattern
const data = await apiCall('/api/resource', {
  method: 'POST',
  body: JSON.stringify(payload)
})
```

- Auto-includes auth headers when token exists
- Consistent error handling across all calls
- Environment-aware base URL resolution

## Mobile Support
- **Development**: Access via `http://[IP]:5173` from mobile
- **Responsive**: Mobile-first design with touch-friendly interactions
- **Bottom Nav**: Native app-like navigation experience

## Future Phases Ready
- **Phase 1**: Subtitle shard system (backend multer + frontend drag-drop)
- **Phase 2**: Dictionary integration (Free Dictionary API + MyMemory)
- **Phase 3**: LLM context analysis (OpenRouter integration)

## Shard-Based Architecture (Core Concept)

### Shard System
**Shard** = Learning content container (bigger than Anki deck concept)

**Shard Types**:
- **Subtitle Shard**: Movie/TV subtitle learning content
- **Deck Shard**: Anki-style flashcard collections  
- **Book Shard**: Reading material with vocabulary extraction

### Module System
**Modules** = Reusable functionality across shard types

**Core Modules**:
- **Reader**: Text display and navigation
- **Marker**: Text selection and highlighting  
- **Dictionary**: Word lookup and definitions
- **Cards**: Spaced repetition review system

**Module Usage Matrix**:
```
                Reader  Marker  Dict  Cards
Subtitle Shard    ✓       ✓      ✓     ✓
Deck Shard        -       -      ✓     ✓  
Book Shard        ✓       ✓      ✓     ✓
```

### Code Organization Strategy
```
client/src/
├── shards/
│   ├── subtitle/     # Subtitle-specific implementation
│   │   ├── SubtitleShard.js    # Logic (detector, shard management)
│   │   ├── SubtitleReader.jsx  # UI (reader component)
│   │   └── index.js            # Export all functionality
│   ├── deck/         # Deck-specific implementation (future)
│   └── book/         # Book-specific implementation (future)
├── components/
│   ├── GlobalImport.jsx      # Universal file import handler
│   ├── auth/                 # Authentication components
│   └── shared/               # Common UI components
├── modules/
│   ├── reader/       # Text reading components
│   ├── marker/       # Selection/highlighting
│   ├── dictionary/   # Word lookup UI
│   └── cards/        # Review system UI
└── shared/          # Common components

server/
├── modules/          # Self-contained feature modules
│   ├── auth/         # Authentication module
│   │   ├── api.js    # Auth API routes
│   │   ├── data.js   # User model & operations
│   │   └── migration.sql # Users table & indexes
│   ├── shard/        # Shard management module
│   │   ├── api.js    # Shard API routes
│   │   ├── data.js   # Shard model & operations
│   │   └── migration.sql # Shards, shard_subtitles, progress tables & indexes
│   └── subtitle/     # Subtitle handling module
│       ├── api.js    # Subtitle API routes
│       ├── data.js   # Subtitle model
│       ├── storage.js # Subtitle file storage
│       ├── detect.js # Language detection
│       └── migration.sql # Subtitles table & indexes
├── utils/            # Shared utilities
│   ├── db/           # Database utilities
│   │   └── connection.js # SQLite setup & module migration runner
│   └── storage.js    # General file storage utilities
└── data/
    ├── database.sqlite # SQLite database
    └── subtitles/      # Subtitle files
```

## Shard Component Architecture

### Content Detection System ✅ IMPLEMENTED
Each shard type provides a detector function for automatic content type identification:

```javascript
// Implemented: subtitle shard detector
export const detect = (filename, buffer) => {
  const content = buffer.toString('utf8')
  const hasExt = /\.(srt|vtt|ass|ssa|sub)$/i.test(filename)
  const hasPattern = /\d{2}:\d{2}:\d{2}[,.]\d{3}/.test(content)
  
  return {
    match: hasExt || hasPattern,
    confidence: hasExt ? 0.9 : (hasPattern ? 0.7 : 0.0),
    metadata: parseMovieInfo(filename) // Enhanced movie info parsing
  }
}
```

### Global Import Flow ✅ WORKING
```
1. User uploads file → GlobalImport.jsx ✅
2. Call all shard detectors (currently subtitle.detect) ✅
3. Auto-detect and proceed directly to EditShard page ✅
4. Configure shard settings → Create via engine registry ✅
5. Navigate back to home with new shard ✅
```

### Shard Engine Registry System ✅ IMPLEMENTED
**Location**: `client/src/shards/engines.js`

Type-agnostic architecture that allows UI components to work with any shard type:

```javascript
// Central registry mapping shard types to their engines
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: audio: audioEngine, image: imageEngine
}

// Generic functions that delegate to appropriate engine
export const getSuggestedName = (detectedInfo) => { ... }
export const getShardTypeInfo = (shardType) => { ... }
export const createShard = async (detectedInfo) => { ... }
export const getEditorComponent = (shardType) => { ... }
export const getReaderComponent = (shardType) => { ... }
export const generateCoverFromShard = (shard) => { ... }
```

**Benefits**:
- **UI Components**: `EditShard.jsx`, `ShardBrowser.jsx`, `Home.jsx` are completely type-agnostic
- **Easy Extension**: Adding new shard types only requires implementing the engine interface
- **Consistent API**: All shard types provide same functions (getSuggestedName, createShard, etc.)
- **Dynamic Rendering**: Editor and Reader components loaded dynamically based on shard type

**Engine Interface**: Each shard engine must export:
```javascript
export const detect = (filename, buffer) => { ... }
export const getSuggestedName = (detectedInfo) => { ... }
export const createShard = async (file, options) => { ... }
export const generateCoverFromShard = (shard) => { ... }
export const shardTypeInfo = { name, displayName, color }
export const EditorComponent = YourShardEditor
export const ReaderComponent = YourShardReader
```

## Component Extraction Strategy

### UI Modularity
- `HeaderToolbar.jsx` - Top navigation with import button
- `BottomNav.jsx` - 4-tab navigation (Home/Explore/Friends/Me)  
- `ShardBrowser.jsx` - Grid display of user's shards
- `GlobalImport.jsx` - Universal file upload and detection

### Page Components
- `pages/Home.jsx` - Container for HomeTab content
- `pages/Explore.jsx` - Public shard discovery
- `pages/Friends.jsx` - Social learning features
- `pages/Me.jsx` - Profile and settings

### Utility Functions
- `utils/dateFormat.js` - Human-readable relative time formatting
- `config/api.js` - Centralized API calls with smart Content-Type handling

## Key Decisions
1. **No complex state management** - React Context sufficient
2. **SQLite database** - ACID transactions, easy PostgreSQL migration
3. **Centralized API config** - Single source for environment handling
4. **Mobile-first** - Bottom navigation primary interface
5. **Monorepo** - Client/server in same repo for easy development
6. **Module-based organization** - Each feature module contains both API routes and models
7. **Self-contained modules** - Reusable functionality across different shard types
