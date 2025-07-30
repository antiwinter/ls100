# 1. SubtitleViewer

## Purpose
Multi-language subtitle display with word selection and navigation.

## Layout Structure
```
┌─ Header ─────────────────────────────┐
│ Movie Name (gray)    [Review] (link) │
├─ Content ────────────────────────────┤
│ Timestamp Group 1:                   │
│   English: "Hello world"             │
│   Chinese: "你好世界"                │
│                                      │
│ Timestamp Group 2:                   │
│   English: "How are you?"            │
│   Chinese: "你好吗？"                │
└──────────────────────────────────────┘
```

## Props Interface
```javascript
// SubtitleViewer.jsx
{
  shard: object,           // Shard data with languages
  currentIndex: number,    // Current subtitle group index
  selectedWords: Set,      // Selected words state
  onWordClick: (word, element) => void, // Word selection handler
  onToolbarRequest: () => void, // Toolbar show request
  onReviewClick: () => void     // Review feature (placeholder)
}
```

## Multi-Language Support
- **Data Structure**: Groups by timestamp with language variants
- **Language Order**: Display languages in sequence per group
- **Styling**: Different colors/styles per language
- **Alignment**: Left-aligned with consistent spacing

## Word Interaction
- **Clickable Words**: Split text into clickable spans
- **Selection State**: Visual indication of selected words
- **Hover Effects**: Subtle highlight on word hover
- **Touch Friendly**: Minimum touch targets for mobile

## Navigation
- **Current Group**: Highlight current timestamp group
- **Full Width**: Use available space with small padding
- **Scroll Support**: Vertical scroll for long content. add fetch line by time range support to backend. use infinite scroll in frontend, fetch new content on demand.
- **Auto-Focus**: Scroll current group into view

## State Management
- **Selected Words**: Maintain across different subtitle groups
- **Persistence**: All instances of selected word show as selected
- **Visual Feedback**: Clear indication of selection state
- **Performance**: Efficient re-rendering for large subtitle files

---

# 2. Word Selection State Management

## State Architecture
- **Local State**: Immediate word selection in React state (Set of words)
- **Backend Sync**: Async worker syncs local changes to server
- **Initialization**: Load existing selections from backend on reader open
- **Persistence**: Selected words persist across subtitle lines and sessions

## Local State Interface
```javascript
// SubtitleReader state management
const [selectedWords, setSelectedWords] = useState(new Set())
const [syncQueue, setSyncQueue] = useState([])
const [lastSync, setLastSync] = useState(null)
```

## Async Sync Worker
- **Debounced**: Save after user stops interacting (2-3 seconds)
- **Queue System**: Track additions/removals for batch operations
- **Retry Logic**: Retry failed syncs with exponential backoff
- **Offline Support**: Queue changes when network unavailable

## Backend API Requirements
```javascript
// API endpoints needed
GET    /api/shards/:id/words        // Load selected words
POST   /api/shards/:id/words        // Add words to selection
DELETE /api/shards/:id/words/:word  // Remove word from selection
PUT    /api/shards/:id/words        // Batch update (add/remove)
```

## Sync Logic
```javascript
// Debounced sync function
const syncWords = useMemo(
  () => debounce(async (additions, removals) => {
    // Batch API call with additions and removals
    // Update lastSync timestamp
    // Clear sync queue on success
    // Retry on failure with backoff
  }, 2000),
  []
)
```

## Visual Feedback
- **Immediate**: Local state updates instantly for responsive UX
- **Sync Status**: Subtle indicator for sync state (syncing/synced/error)
- **Consistent**: Same word selected across all subtitle lines
- **Clear Selection**: Visual distinction between selected/unselected words

## Error Handling
- **Network Failures**: Queue changes for retry
- **Conflict Resolution**: Server state wins on conflicts
- **User Feedback**: Subtle error indication without disrupting flow
- **Recovery**: Auto-retry with progressive delays