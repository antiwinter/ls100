# LS100 Design Architecture

## Project Overview
English learning app using movie subtitles with mobile-first design.

## Tech Stack
- **Frontend**: React 18 + Vite + MUI Joy UI
- **Backend**: Express.js + Node.js
- **Package Manager**: Yarn workspaces
- **Database**: JSON file storage (simple, no external deps)

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
**Location**: `server/api/auth.js` + `client/src/context/AuthContext.jsx`

- **Backend**: JWT tokens + bcrypt password hashing
- **Storage**: `server/data/users.json` (simple JSON file)
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
- **Users**: `server/data/users.json`
- **Future**: Each feature uses separate JSON files in `server/data/`
- **Session**: JWT tokens (7-day expiry)

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
│   ├── subtitle/     # Subtitle-specific UI
│   ├── deck/         # Deck-specific UI  
│   └── book/         # Book-specific UI
├── modules/
│   ├── reader/       # Text reading components
│   ├── marker/       # Selection/highlighting
│   ├── dictionary/   # Word lookup UI
│   └── cards/        # Review system UI
└── shared/          # Common components

server/
├── shards/
│   ├── subtitle.js   # Subtitle shard API
│   ├── deck.js       # Deck shard API
│   └── book.js       # Book shard API  
├── modules/
│   ├── dictionary.js # Dictionary API
│   ├── cards.js      # Card review API
│   └── words.js      # Word management
└── data/
    ├── shards/       # Shard storage
    └── modules/      # Module data
```

## Key Decisions
1. **No complex state management** - React Context sufficient
2. **File-based storage** - Simple JSON files, no database complexity  
3. **Centralized API config** - Single source for environment handling
4. **Mobile-first** - Bottom navigation primary interface
5. **Monorepo** - Client/server in same repo for easy development
6. **Modular architecture** - Reusable modules across different shard types
