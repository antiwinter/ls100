# Storage Manager Module

The Storage Manager coordinates browser storage for Anki shard data, managing IndexedDB for deck files and localStorage for progress tracking.

## Purpose

Provides unified storage interface for Anki shard components while optimizing browser storage usage and ensuring data persistence.

## Storage Architecture

### Data Distribution
- **Backend**: Shard metadata only (via global shard API)
- **IndexedDB**: Binary deck files (.apkg), media files
- **localStorage**: Progress data, FSRS states, preferences
- **sessionStorage**: Temporary study session data

### Storage Quotas
- Monitor available storage space
- Implement cleanup strategies for old data
- Provide storage usage feedback to users
- Handle quota exceeded scenarios gracefully

## IndexedDB Management

### Database Structure
```javascript
{
  database: 'AnkiShardDB',
  version: 1,
  stores: {
    decks: { keyPath: 'deckId' },
    cards: { keyPath: 'cardId', indexes: ['deckId', 'due'] },
    media: { keyPath: 'mediaId' }
  }
}
```

### Deck Storage
- Store parsed .apkg file data
- Maintain card-deck relationships
- Handle deck updates and synchronization
- Support deck deletion with cleanup

### Media Handling
- Store images, audio files from cards
- Implement caching strategies
- Handle missing media gracefully
- Optimize storage for large files

## localStorage Management

### Progress Data Structure
```javascript
{
  'anki_decks': {
    [deckId]: {
      name: string,
      totalCards: number,
      studiedCards: number,
      lastStudied: Date
    }
  },
  'anki_cards_${deckId}': {
    [cardId]: {
      state: FSRSState,
      history: ReviewHistory[]
    }
  },
  'anki_preferences': {
    studySettings: StudySettings,
    uiPreferences: UIPreferences
  }
}
```

### Session Management
- Track active study sessions
- Handle browser refresh/reload
- Restore interrupted sessions
- Clean up completed sessions

## API Interface

### Deck Operations
- `storeDeck(deckData)` - Save parsed deck to IndexedDB
- `loadDeck(deckId)` - Retrieve deck data
- `deleteDeck(deckId)` - Remove deck and cleanup
- `listDecks()` - Get all available decks

### Card Operations  
- `getCard(cardId)` - Retrieve card data
- `updateCardProgress(cardId, progress)` - Save study progress
- `getCardsForReview(deckId)` - Get cards due for study
- `searchCards(query, deckId)` - Find cards by content

### Progress Operations
- `saveSession(sessionData)` - Store study session
- `loadProgress(deckId)` - Get deck progress
- `exportProgress()` - Backup progress data
- `importProgress(data)` - Restore from backup

## Data Synchronization

### Cross-Tab Communication
- Use BroadcastChannel for tab synchronization
- Handle concurrent study sessions
- Prevent data conflicts between tabs
- Share progress updates in real-time

### Backup Strategies
- Regular progress backups to JSON
- Export/import functionality for data migration  
- Recovery from corrupted storage
- Version compatibility handling

## Performance Optimization

### Caching Strategies
- Cache frequently accessed cards
- Prefetch upcoming cards
- Background loading of media files
- Intelligent cache eviction

### Memory Management
- Lazy loading of large datasets
- Efficient data structures
- Garbage collection of unused data
- Memory usage monitoring

### Transaction Optimization
- Batch operations for better performance
- Async operations to prevent UI blocking
- Transaction queuing for consistency
- Error handling and rollback support

## Error Handling

### Storage Errors
- Handle quota exceeded gracefully
- Provide fallback storage options
- User notification for critical errors
- Automatic retry mechanisms

### Data Integrity
- Validate data before storage
- Check for corruption on load
- Implement data repair utilities
- Maintain storage consistency

### Recovery Mechanisms
- Detect and handle corrupted databases
- Restore from backup when possible
- Reset storage as last resort
- User guidance for manual recovery

## Browser Compatibility

### Feature Detection
- Check IndexedDB availability
- localStorage capacity testing
- Progressive enhancement approach
- Fallback for limited storage

### Storage Limits
- Monitor browser-specific limits
- Adapt behavior based on available space
- Implement storage optimization
- User warnings for low storage

## Integration Points

### AnkiShard Engine
- Deck import/export coordination
- Metadata synchronization
- Storage initialization

### Study Engine
- Progress data persistence
- Session state management
- FSRS state storage

### AnkiReader Components
- Data loading for UI components
- Real-time progress updates
- Storage status indicators

## Future Enhancements

### Cloud Synchronization
- Prepare data structures for cloud sync
- Implement conflict resolution
- Support multiple device access
- Privacy-focused sync options

### Advanced Storage
- Compression for large datasets
- Encryption for sensitive data
- Storage analytics and optimization
- Automated cleanup policies
