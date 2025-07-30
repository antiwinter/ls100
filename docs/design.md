# LS100 Design Architecture

## Project Overview
English learning app using movie subtitles with mobile-first design.

## Tech Stack
- **Frontend**: React 18 + Vite + MUI Joy UI + loglevel
- **Backend**: Express.js + Node.js + SQLite + Pino + Morgan
- **Package Manager**: Yarn workspaces
- **Database**: SQLite with migration to PostgreSQL/MySQL path
- **Logging**: Pino (backend), Morgan (HTTP), loglevel (frontend)

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

### 4. Logging System
**Location**: `server/utils/logger.js` + `server/utils/httpLogger.js` + `client/src/utils/logger.js`

**Backend Logging (Pino + Morgan)**:
- **HTTP Requests**: Morgan with user context (`GET /api/shards 200 john@example.com(user_123) 12.3ms`)
- **Application Logs**: Pino with auto file detection and request context
- **Structured Output**: JSON in production, pretty-printed in development
- **User Context**: Automatic user ID/name in all request-scoped logs

```javascript
// Backend usage
import { log } from '../utils/logger.js'
log.info({ shardId: 'shard_123' }, 'Processing shard creation')
// Output: {"level":"info","file":"engine.js","userId":"user_123","userName":"john@example.com","shardId":"shard_123","msg":"Processing shard creation"}
```

**Frontend Logging (loglevel)**:
- **Environment-aware**: Debug level in dev, warn+ in production
- **Browser-native**: File names shown automatically in DevTools
- **Simple import**: Direct usage without component context

```javascript
// Frontend usage
import { log } from '../utils/logger'
log.debug('Detecting subtitle file:', filename)
// Output: [SubtitleShard.js:10] Detecting subtitle file: movie.srt
```

**Design Principles**:
- No manual component labels (browser/server shows file info)
- HTTP auto-logged by Morgan (no manual request logging)
- One-line object logging preferred over multiline
- Structured data for production analysis

### 5. Development Setup
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

### Shard Engine Registry System ✅ ENHANCED
**Location**: `client/src/shards/engines.js` + `server/shards/engines.js`

Unified client-server engine architecture with clean API abstraction:

```javascript
// Client-side engine registry (client/src/shards/engines.js)
const SHARD_ENGINES = {
  subtitle: subtitleEngine,
  // Future: deck: deckEngine, book: bookEngine
}

// Generic functions that delegate to appropriate engine
export const engineGetTag = (shardType) => { ... }
export const engineGetEditor = (shardType) => { ... }
export const engineGetReader = (shardType) => { ... }
export const engineGenCover = (shard) => { ... }
export const engineSaveData = async (shard, apiCall) => { ... }

// Server-side engine processing (server/shards/engines.js)
export const engineProcessCreate = async (shard, data) => { ... }
export const engineProcessUpdate = async (shard, data, updates) => { ... }
export const engineValidateData = (type, data) => { ... }
export const engineGetData = (type, shardId) => { ... }
```

**Major Improvements**:
- **Unified Data Flow**: Engines handle data processing on both client and server
- **Clean API**: Removed legacy functions, simplified engine interface
- **Better Abstraction**: Server-side engine processing handles database operations
- **Consistent Naming**: All engine functions use `engine*` prefix for clarity

**Engine Interface** (Updated): Each shard engine must export:
```javascript
// Client-side (SubtitleShard.js)
export const detect = (filename, buffer) => { ... }
export const processData = async (shard, apiCall) => { ... }
export const generateCover = (shard) => { ... }
export const shardTypeInfo = { name, displayName, color }
export const EditorComponent = YourShardEditor
export const ReaderComponent = YourShardReader

// Server-side (server/shards/subtitle/engine.js)
export const getData = (shardId) => { ... }
export const processCreate = async (shard, data) => { ... }
export const processUpdate = async (shard, data) => { ... }
export const validateData = (data) => { ... }
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
- `utils/logger.js` - Production-ready logging (Pino backend, loglevel frontend)
- `utils/httpLogger.js` - HTTP request logging with user context (Morgan)

## Recent Major Updates ✅ 2024

### UI/UX Enhancements
- **Long Press Support**: Custom `useLongPress()` hook for consistent gesture recognition
- **FontAwesome Integration**: Enhanced icons (mask icon for private shards)
- **Enhanced EditShard Flow**: Unified data handling, cover preview, improved validation
- **Touch Optimizations**: Better feedback, gesture recognition, tooltip system

### Engine System Refactoring
- **Unified Data Processing**: Single flow for create/edit operations
- **Server-Side Engines**: Backend engine processing for data validation and operations
- **Clean API**: Removed legacy functions, simplified engine interface
- **Better Abstraction**: Engines handle their own database operations

### BrowserEditBar Improvements
- **Component Extraction**: Reusable `ActionButton` component
- **Enhanced Privacy Toggle**: Smart toggle between public/private based on selection
- **Edit Single Shard**: New edit functionality for individual shards
- **Visual Improvements**: Better feedback, consistent styling

### Production Logging System
- **Unified Architecture**: Pino (backend) + Morgan (HTTP) + loglevel (frontend)
- **Auto Context Detection**: File names and user context automatically included
- **Environment Optimization**: Debug in dev, structured JSON in production
- **Clean Implementation**: No manual component labels, consistent import patterns

## Key Decisions
1. **No complex state management** - React Context sufficient
2. **SQLite database** - ACID transactions, easy PostgreSQL migration
3. **Centralized API config** - Single source for environment handling
4. **Mobile-first** - Bottom navigation primary interface
5. **Monorepo** - Client/server in same repo for easy development
6. **Module-based organization** - Each feature module contains both API routes and models
7. **Self-contained modules** - Reusable functionality across different shard types
8. **Engine Abstraction** - Unified client-server processing for extensible shard types
9. **Production Logging** - Structured logging with auto context detection, no manual labeling
