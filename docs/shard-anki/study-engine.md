# Study Engine Module

The Study Engine manages spaced repetition scheduling using the FSRS algorithm and tracks learning progress.

## Purpose

Implements intelligent card scheduling and progress tracking for optimal learning outcomes using the Free Spaced Repetition Scheduler (FSRS) algorithm.

## Core Components

### FSRS Integration
- Uses `ts-fsrs` library for modern spaced repetition
- Replaces traditional SM-2 with more accurate scheduling
- Supports 4-rating system (Again, Hard, Good, Easy)
- Dynamic difficulty adjustment

### Progress Tracking
- Session statistics (cards studied, time spent)
- Long-term progress metrics
- Learning streaks and milestones
- Performance analytics per deck

### Card Scheduling
- Due date calculation
- Review interval optimization
- Difficulty assessment
- Retention prediction

## FSRS Algorithm Features

### Rating System
- **Again (1)**: Card forgotten, short interval
- **Hard (2)**: Difficult recall, reduced interval  
- **Good (3)**: Normal recall, standard interval
- **Easy (4)**: Easy recall, extended interval

### Scheduling Parameters
- **Stability**: Memory strength indicator
- **Difficulty**: Card inherent difficulty (1.0-10.0)
- **Retrievability**: Probability of successful recall
- **Interval**: Days until next review

### Learning States
- **New**: Never studied
- **Learning**: Initial learning phase
- **Review**: Spaced repetition phase
- **Relearning**: After forgetting

## Data Structures

### Card State
```javascript
{
  cardId: string,
  state: 'new' | 'learning' | 'review' | 'relearning',
  due: Date,
  stability: number,
  difficulty: number,
  elapsedDays: number,
  scheduledDays: number,
  reps: number,
  lapses: number,
  lastReview: Date
}
```

### Session Data
```javascript
{
  sessionId: string,
  startTime: Date,
  cardsStudied: number,
  correctAnswers: number,
  totalTime: number,
  deckId: string
}
```

## Study Flow

### Session Initialization
1. Load due cards from storage
2. Initialize FSRS parameters
3. Create study queue with optimal ordering
4. Start session timer

### Card Presentation
1. Select next card using FSRS algorithm
2. Present question side
3. Wait for user to reveal answer
4. Show answer with rating options

### Rating Processing
1. Record user rating and response time
2. Update card state using FSRS
3. Calculate next review date
4. Save progress to localStorage
5. Update session statistics

### Session Management
- Configurable session length (time/cards)
- Break reminders and session pausing
- Progress autosave every 5 cards
- Session summary on completion

## Storage Strategy

### localStorage Structure
```javascript
{
  'anki_progress_${deckId}': {
    cards: Map<cardId, cardState>,
    sessions: Array<sessionData>,
    stats: deckStatistics
  },
  'anki_session_current': currentSessionData
}
```

### Data Persistence
- Automatic save after each card
- Session backup every minute
- Recovery from interrupted sessions
- Cross-tab synchronization

## Performance Optimization

### Efficient Scheduling
- Pre-calculate due cards queue
- Lazy loading of card content
- Background progress synchronization
- Memory-efficient state management

### Study Algorithm
- Interleaving of different card types
- Optimal spacing calculations
- Adaptive session length
- Intelligent break suggestions

## Integration Points

### AnkiReader
- Study mode activation
- Progress display
- Session controls
- Statistics visualization

### Storage Manager
- Progress data coordination
- Backup and restore
- Storage quota management
- Data migration support

## Future Enhancements

### Advanced Features
- Custom FSRS parameters per user
- Machine learning optimization
- Cross-deck learning correlation
- Predictive scheduling

### Analytics
- Learning velocity tracking
- Retention rate analysis
- Difficulty trend identification
- Personalized study recommendations
