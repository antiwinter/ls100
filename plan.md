# Development Plan for ls100

## Current Architecture Analysis

**Frontend**: Nuxt.js 2.0 (Vue.js) with Bulma CSS framework
**Backend**: Express.js with API endpoints
**Database**: File-based storage (CSV, JSON config files)
**Dictionary**: Collins Dictionary via js-mdict (.mdx files)
**Current Features**: 
- Subtitle file processing (SRT)
- Word selection and dictionary lookup
- Export functionality (selected words)
- Translation subtitle support
- Data analysis tools for semiconductor data

## Development Phases

### Phase 1: Foundation & Infrastructure (Weeks 1-3)

#### 1.1 Framework Migration (Priority: High)
**Current**: Nuxt.js 2.0 (slow)
**Target**: React with Next.js or Vite + React

**Implementation Steps**:
1. **Setup New React Project**
   - Choose between Next.js (SSR) or Vite (SPA) based on performance needs
   - Configure TypeScript for better maintainability
   - Setup Tailwind CSS (modern alternative to Bulma)

2. **Backend Migration Planning**
   - Keep Express.js backend but modernize API structure
   - Add proper error handling and validation
   - Implement API versioning

3. **Component Migration Strategy**
   - Convert Vue components to React components:
     - `components/upload.vue` → `components/Upload.tsx`
     - `components/choose.vue` → `components/Choose.tsx`
     - `pages/index.vue` → `pages/index.tsx`
   - Maintain same functionality during migration

4. **State Management**
   - Implement Zustand or Redux Toolkit for state management
   - Replace Nuxt store with React state solution

#### 1.2 User Authentication System (Priority: High)
**Current**: No authentication
**Target**: Simple CSV-based user system

**Implementation Steps**:
1. **Backend User Management**
   - Create `server/auth.js` with user registration/login endpoints
   - Implement JWT token authentication
   - Create user data structure in CSV format:
     ```csv
     id,username,email,password_hash,created_at,last_login
     ```

2. **Frontend Auth Components**
   - Create `components/Auth/Login.tsx`
   - Create `components/Auth/Register.tsx`
   - Create `components/Auth/Profile.tsx`
   - Add authentication context/hook

3. **Session Management**
   - Implement JWT token storage (localStorage/httpOnly cookies)
   - Add authentication middleware for protected routes
   - Create user session persistence

#### 1.3 Database Structure Setup (Priority: Medium)
**Current**: File-based storage
**Target**: Improved file-based storage with better organization

**Implementation Steps**:
1. **User Data Storage**
   - Create `data/users/` directory structure
   - Each user gets their own JSON file: `data/users/{user_id}.json`
   - Store user profile, sessions, and preferences in individual JSON files
   - Implement user data backup and recovery

2. **Subtitle Storage System**
   - Create `data/subtitles/` directory
   - Implement subtitle metadata storage in JSON format
   - Add subtitle search indexing
   - Store subtitle files with associated metadata JSON files

### Phase 2: Core Features Enhancement (Weeks 4-6)

#### 2.1 Subtitle Management System (Priority: High)
**Current**: Upload and process SRT subtitles
**Target**: Save, search, and manage subtitles with multiple format support

**Implementation Steps**:
1. **Enhanced Subtitle Upload Support**
   - Maintain current subtitle upload functionality
   - Add support for additional subtitle formats:
     - SRT (current)
     - VTT (WebVTT)
     - ASS/SSA (Advanced SubStation Alpha)
     - SUB (MicroDVD)
     - SBV (YouTube subtitle format)
   - Implement format auto-detection and conversion
   - Add subtitle validation and error handling

2. **Backend Subtitle Storage**
   - Create `server/subtitles.js` API endpoints
   - Implement subtitle file storage with metadata
   - Add subtitle search functionality using fuzzy search
   - Store both original and normalized formats
   - Add subtitle format conversion utilities

3. **Frontend Subtitle Management**
   - Create `components/Subtitles/Manager.tsx`
   - Implement subtitle search interface
   - Add subtitle selection and loading
   - Support drag-and-drop for multiple subtitle files
   - Add subtitle format indicator in UI

4. **Subtitle Search API Integration**
   - Research and integrate subtitle APIs (OpenSubtitles, YIFY, etc.)
   - Create `server/subtitle-search.js`
   - Implement automatic subtitle download
   - Add subtitle quality/language filtering

#### 2.2 Reading Session Progress Tracking (Priority: Medium)
**Current**: No session state persistence
**Target**: Remember user's reading position and selected words per subtitle

**Implementation Steps**:
1. **Reading Session Data Structure**
   - Create user session state JSON format (one file per user):
     ```json
     {
       "user_id": "user123",
       "last_accessed": "2024-01-15T10:30:00Z",
       "current_subtitle": "movie_name.srt",
       "subtitles": {
         "movie_name.srt": {
           "subtitle_id": "sub123",
           "subtitle_name": "Movie Name",
           "current_position": {
             "line_number": 45,
             "time_position": "00:02:30"
           },
           "selected_words": ["word1", "word2", "word3"],
           "bookmarks": [
             {
               "line_number": 12,
               "time_position": "00:01:05",
               "note": "interesting scene"
             }
           ],
           "last_accessed": "2024-01-15T10:30:00Z"
         }
       }
     }
     ```
   - Track reading position (line number, time position)
   - Store selected word list per subtitle
   - Remember last accessed subtitle

2. **Backend Session API**
   - Create `server/reading-session.js` endpoints
   - Implement session state save/load functionality
   - Add automatic session backup on user actions
   - Store reading bookmarks and positions

3. **Frontend Session Management**
   - Create `components/Session/StateManager.tsx`
   - Auto-save reading position periodically
   - Restore last reading position on subtitle load
   - Show reading progress indicator
   - Allow manual bookmark creation

#### 2.3 UI/UX Improvements (Priority: Medium)
**Current**: Basic layout with Bulma
**Target**: Modern, responsive, mobile-friendly interface

**Implementation Steps**:
1. **Responsive Layout**
   - Implement CSS Grid/Flexbox layout
   - Add mobile-first responsive design
   - Create breakpoint system for different screen sizes

2. **Centered UI with Max-Width**
   - Create main container with max-width (1200px)
   - Center content horizontally
   - Add proper padding and margins

3. **Mobile Optimization**
   - Create mobile-specific components
   - Implement touch-friendly interactions
   - Add responsive navigation

### Phase 3: Advanced Features (Weeks 7-9)

#### 3.1 Enhanced Dictionary System (Priority: High)
**Current**: Collins dictionary only
**Target**: Multiple dictionaries with fallback

**Implementation Steps**:
1. **Dictionary API Integration**
   - Research free dictionary APIs (Free Dictionary API, Merriam-Webster, etc.)
   - Create `server/dictionary.js` with multiple providers
   - Implement fallback system: Collins → Online APIs

2. **Dictionary Response Enhancement**
   - Standardize dictionary response format
   - Add pronunciation, etymology, examples
   - Implement caching for API responses

3. **Frontend Dictionary Display**
   - Enhance dictionary display component
   - Add audio pronunciation support
   - Create word bookmark system

#### 3.2 Export System Redesign (Priority: Medium)
**Current**: Basic export functionality
**Target**: Multiple export formats in header navigation

**Implementation Steps**:
1. **Remove Current Export Section**
   - Remove export UI from sidebar
   - Clean up related code and styles

2. **Header Navigation Export**
   - Create `components/Header/ExportButtons.tsx`
   - Implement export dropdown with multiple formats
   - Add export format handlers:
     - Eudic format (.csv with specific columns)
     - Anki format (.csv with front/back cards)

3. **Export Enhancement**
   - Add batch export functionality
   - Implement export history
   - Add export customization options

#### 3.3 LLM Translation Integration (Priority: Medium)
**Current**: No AI translation
**Target**: Context-aware translation with LLM

**Implementation Steps**:
1. **LLM API Integration**
   - Choose LLM provider (OpenAI, Anthropic, or local models)
   - Create `server/llm.js` with translation endpoints
   - Implement prompt templates for different scenarios

2. **Translation Features**
   - Word-in-context translation
   - Sentence/line translation
   - Cultural context explanation
   - Alternative meanings and examples

3. **Frontend Translation UI**
   - Add translation buttons to word lookup
   - Create translation history
   - Implement translation caching

### Phase 4: Learning System (Weeks 10-12)

#### 4.1 Ebbinghaus Memory System (Priority: High)
**Current**: No spaced repetition
**Target**: Complete spaced repetition learning system

**Implementation Steps**:
1. **Spaced Repetition Algorithm**
   - Implement Ebbinghaus forgetting curve algorithm
   - Create review scheduling system
   - Add difficulty adjustment based on user performance

2. **Card System Backend**
   - Create `server/cards.js` API endpoints
   - Implement card creation from selected words
   - Add review session management

3. **Frontend Card System**
   - Create `components/Cards/CardSystem.tsx`
   - Implement card review interface
   - Add study statistics and progress tracking

#### 4.2 AI Reading Assistant (Priority: Medium)
**Current**: No AI assistance
**Target**: AI-powered reading help

**Implementation Steps**:
1. **Reading Assistant Features**
   - Implement text difficulty analysis
   - Add reading comprehension questions
   - Create vocabulary suggestions

2. **AI Integration**
   - Connect to LLM for reading assistance
   - Implement context-aware help
   - Add reading progress tracking

3. **Frontend Reading Interface**
   - Create `components/Reading/Assistant.tsx`
   - Add reading mode toggle
   - Implement reading progress visualization

### Phase 5: Performance & Polish (Weeks 13-14)

#### 5.1 Performance Optimization
**Target**: Fast, responsive application

**Implementation Steps**:
1. **Frontend Optimization**
   - Implement code splitting and lazy loading
   - Add caching strategies
   - Optimize bundle size

2. **Backend Optimization**
   - Implement response caching
   - Add database query optimization
   - Implement rate limiting

3. **Mobile Performance**
   - Optimize mobile loading times
   - Implement progressive loading
   - Add offline support

#### 5.2 Final Testing & Deployment
**Target**: Production-ready application

**Implementation Steps**:
1. **Testing Implementation**
   - Add unit tests for critical components
   - Implement integration tests
   - Add end-to-end testing

2. **Deployment Setup**
   - Configure production environment
   - Set up CI/CD pipeline
   - Add monitoring and error tracking

## Technology Stack Recommendations

### Frontend
- **Framework**: Next.js 14 (React 18) or Vite + React 18
- **Styling**: Tailwind CSS
- **State Management**: Zustand or Redux Toolkit
- **UI Components**: Radix UI or Headless UI
- **Charts**: Chart.js or D3.js
- **Testing**: Jest + React Testing Library

### Backend
- **Framework**: Express.js (keep current)
- **Authentication**: JWT
- **File Processing**: Keep current subtitle libraries
- **API Documentation**: OpenAPI/Swagger
- **Testing**: Jest + Supertest

### DevOps
- **Build Tool**: Vite or Next.js built-in
- **Deployment**: Vercel, Netlify, or self-hosted
- **CI/CD**: GitHub Actions
- **Monitoring**: Sentry or LogRocket

## Migration Strategy

1. **Gradual Migration**: Start with new React components alongside existing Nuxt
2. **Feature Parity**: Ensure all current features work before removing old code
3. **Data Migration**: Preserve all user data and configurations
4. **Testing**: Comprehensive testing at each phase
5. **Documentation**: Update documentation throughout the process

## Risk Mitigation

- **Backup Strategy**: Regular backups of all data during migration
- **Rollback Plan**: Keep old system available during transition
- **Performance Monitoring**: Track performance improvements
- **User Feedback**: Gather feedback during beta testing

This plan provides a structured approach to modernizing the ls100 application while maintaining its core functionality and improving user experience significantly. 