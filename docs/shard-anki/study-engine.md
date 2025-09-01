# Study Engine Module

The Study Engine manages spaced repetition scheduling using the FSRS algorithm and tracks learning progress, coordinating with the new Note+Template architecture.

## Purpose

Implements intelligent card scheduling and progress tracking for optimal learning outcomes using the Free Spaced Repetition Scheduler (FSRS) algorithm, working with dynamically rendered cards.

## Core Components

### FSRS Integration
- Uses `ts-fsrs` library for modern spaced repetition
- Replaces traditional SM-2 with more accurate scheduling
- Supports 4-rating system (Again, Hard, Good, Easy)
- Dynamic difficulty adjustment

### Progress Tracking
- Session statistics (cards studied, time spent)
- Long-term progress metrics per deck
- Learning streaks and milestones
- Performance analytics across note types

### Card Scheduling
- Due date calculation using FSRS
- Review interval optimization
- Difficulty assessment per card instance
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

### Card Progress State
```javascript
{
  cardId: string,
  due: timestamp,             // When card is next due
  stability: number,          // FSRS memory strength
  difficulty: number,         // Card difficulty (1-10)
  elapsed_days: number,       // Days since last review
  scheduled_days: number,     // Days scheduled for next review
  reps: number,               // Total repetitions
  lapses: number,             // Times forgotten
  state: string,              // new|learning|review|relearning
  last_review: timestamp      // Last study time
}
```

### Session Data
```javascript
{
  sessionId: string,
  deckId: string,
  startTime: timestamp,
  cardsStudied: number,
  correctAnswers: number,
  totalTime: number,
  ratings: {
    again: number,
    hard: number, 
    good: number,
    easy: number
  }
}
```

## Study Flow Integration

### Session Initialization
1. **Load Due Cards**: Query cards by due date using IndexedDB
2. **Dynamic Rendering**: Generate content via TemplateEngine
3. **FSRS Queue**: Order cards by priority and scheduling
4. **Session Setup**: Initialize timers and progress tracking

### Card Presentation Flow
1. **Card Selection**: FSRS picks next card from queue
2. **Content Rendering**: `cardGen.renderCard()` generates question/answer
3. **UI Display**: Show question with template-rendered content
4. **User Interaction**: Wait for answer reveal and rating

### Rating Processing
1. **User Rating**: Capture 1-4 rating with response time
2. **FSRS Update**: Calculate new scheduling parameters
3. **Progress Save**: Update localStorage with new state
4. **Session Stats**: Update study metrics
5. **Next Card**: Continue with optimized card order

## Integration with Note+Template System

### Dynamic Content Loading
```javascript
// StudyEngine works with card references
class StudyEngine {
  async getNextCard() {
    const card = this.studyQueue.shift()
    
    // Content rendered on-demand
    const rendered = await ankiApi.getStudyCard(card.id)
    
    return {
      id: card.id,
      question: rendered.question,    // From TemplateEngine
      answer: rendered.answer,        // From TemplateEngine
      template: rendered.template,    // Template name
      noteFields: rendered.note.fields
    }
  }
}
```

### Progress Tracking per Card Instance
```javascript
// Each card instance has separate progress
// Even if multiple cards from same note
async rateCard(cardId, rating) {
  const progress = progressStorage.getCardProgress(deckId, cardId)
  const fsrsCard = progressToCard(progress)
  
  // FSRS processes this specific card instance
  const schedulingCards = fsrs.repeat(fsrsCard, new Date())
  const updatedCard = schedulingCards[rating]
  
  // Save progress for this card only
  progressStorage.setCardProgress(deckId, cardId, cardToProgress(updatedCard.card))
}
```

## Storage Strategy

### localStorage Structure
```javascript
{
  'anki_progress_${deckId}': {
    [cardId]: {
      due: timestamp,
      stability: number,
      difficulty: number,
      // ... other FSRS state
    }
  },
  'anki_preferences': {
    studySettings: {
      maxCardsPerSession: number,
      maxTimePerSession: number,
      newCardLimit: number
    }
  }
}
```

### Session Persistence
- **Auto-save**: Progress saved after each card
- **Recovery**: Interrupted sessions restored on reload
- **Cross-tab**: BroadcastChannel for tab synchronization
- **Cleanup**: Completed sessions archived

## Performance Optimization

### Efficient Card Loading
- **Lazy Rendering**: Content generated only when displayed
- **Batch Queries**: Multiple cards loaded together
- **Prefetch**: Next cards rendered in background
- **Memory Management**: Rendered content cached briefly

### Study Algorithm Optimization
```javascript
// Efficient due card selection
async buildStudyQueue(deckId) {
  // Get all cards for deck
  const cards = await cardGen.getCardsForDeck(deckId)
  
  // Filter due cards with FSRS priority
  const now = Date.now()
  const dueCards = cards
    .filter(c => c.due <= now)
    .map(c => ({
      ...c,
      priority: this.calculatePriority(c)
    }))
    .sort((a, b) => b.priority - a.priority)
  
  return dueCards.slice(0, this.session.maxCards)
}
```

### Memory Efficiency
- **Card References**: Only IDs stored in study queue
- **On-demand Rendering**: Content generated when needed
- **Progress Batching**: Multiple updates saved together
- **Session Cleanup**: Clear cached data after session

## Integration Points

### AnkiApi Coordination
```javascript
// StudyEngine uses AnkiApi for card operations
this.currentCard = await ankiApi.getStudyCard(cardId)
await ankiApi.updateCardScheduling(cardId, newScheduling)
```

### TemplateEngine Integration
```javascript
// Cards rendered dynamically during study
const rendered = await templateEngine.render(template, noteFields)
// StudyEngine receives fully rendered content
```

### Storage Manager Integration
```javascript
// Progress saved via simplified storage interface
progressStorage.setCardProgress(deckId, cardId, fsrsState)
progressStorage.getDeckProgress(deckId) // Load all progress
```

## Multi-Pair Card Considerations

### Independent Scheduling
Each card from a note has separate progress:
```javascript
// Same note, different cards, different progress
Note: ["France", "Paris"]
Card1: "France → ?" (due: tomorrow, difficulty: 3.2)
Card2: "? → France" (due: next week, difficulty: 2.8) 
```

### Template-Aware Statistics
```javascript
// Study stats can show template performance
const stats = {
  "Country → Capital": { accuracy: 0.85, avgTime: 3.2 },
  "Capital → Country": { accuracy: 0.78, avgTime: 4.1 }
}
```

## Future Enhancements

### Advanced Scheduling
- **Cross-card Correlation**: Learning from related cards
- **Note-level Difficulty**: Adjust based on all cards from note
- **Template Difficulty**: Per-template learning curves
- **Adaptive Algorithms**: Machine learning optimization

### Enhanced Analytics
- **Learning Velocity**: Track improvement over time
- **Note Type Performance**: Statistics per note type
- **Template Effectiveness**: Which templates work best
- **Retention Prediction**: Forecast long-term retention

### Study Modes
- **Mixed Study**: Cards from multiple decks
- **Focused Sessions**: Single note type or template
- **Review Only**: Skip new cards
- **Cram Mode**: Intensive review before deadline

## Technical Implementation

### FSRS State Management
```javascript
// Convert between storage and FSRS formats
const progressToCard = (progress) => {
  const card = createEmptyCard(new Date(progress.due))
  card.stability = progress.stability
  card.difficulty = progress.difficulty
  // ... map all FSRS parameters
  return card
}

const cardToProgress = (fsrsCard) => ({
  due: fsrsCard.due.toISOString(),
  stability: fsrsCard.stability,
  difficulty: fsrsCard.difficulty,
  // ... extract all FSRS state
})
```

### Session Management
```javascript
class StudyEngine {
  constructor(deckId) {
    this.deckId = deckId
    this.session = null
    this.studyQueue = []
  }
  
  async initSession(options = {}) {
    this.session = {
      id: generateSessionId(),
      deckId: this.deckId,
      startTime: new Date(),
      maxCards: options.maxCards || 20,
      cardsStudied: 0,
      // ... session state
    }
    
    await this.buildStudyQueue()
  }
}
```

### Error Recovery
- **Progress Validation**: Check FSRS state consistency
- **Session Recovery**: Restore interrupted study sessions
- **Data Repair**: Fix corrupted progress data
- **Graceful Degradation**: Continue with default parameters if needed