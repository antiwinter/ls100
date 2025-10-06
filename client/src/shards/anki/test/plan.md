# Anki Components Test Plan

## Overview
This test plan ensures the correctness and alignment of the APKG parser and study engine components after the bundle/deck terminology refactor.

## Components Under Test

### 1. APKG Parser (`parser/apkgParser.js`)
- **parseApkgFile()** - Parses .apkg files into structured data
- **importApkgData()** - Converts parsed data to internal note+template structure
- Supporting functions: parseCollection, parseDecks, parseNotes, parseCards, parseMedia

### 2. Study Engine (`engine/studyEngine.js`)
- **StudyEngine class** - Main study session management
- **init()** - Session initialization and queue building
- **draw()** - Card selection with strategy-based drawing
- **rate()** - FSRS-based card rating and scheduling
- **undo()** - Action reversal functionality

## Test Setup and Cleanup

### Global Test Setup
```javascript
beforeEach(async () => {
  // Clear all database data at START of each test
  await db.notes.clear()
  await db.bundles.clear() 
  await db.templates.clear()
  await db.cards.clear()
  await db.media.clear()
  
  // Reset any global state
  // This ensures clean state for debugging after test completion
})

// No cleanup in afterEach - leave data for inspection
```

## Test Categories

### A. Unit Tests

#### A1. APKG Parser Unit Tests

##### A1.1 parseApkgFile() Tests
```javascript
describe('parseApkgFile', () => {
  test('should parse all sample APKG files and save results', async () => {
    // Parse all .apkg files in anki/test/apkg/
    const apkgDir = './anki/test/apkg'
    const parsedDir = './anki/test/parsed'
    
    const apkgFiles = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
    
    for (const filename of apkgFiles) {
      const buffer = fs.readFileSync(path.join(apkgDir, filename))
      const parsed = await parseApkgFile(buffer)
      
      // Save parsed result for manual inspection
      const outputName = filename.replace('.apkg', '.json')
      fs.writeFileSync(
        path.join(parsedDir, outputName), 
        JSON.stringify(parsed, null, 2)
      )
      
      // Basic validation
      expect(parsed).toHaveProperty('collection')
      expect(parsed).toHaveProperty('bundles')
      expect(parsed).toHaveProperty('notes')
      expect(parsed).toHaveProperty('cards')
    }
  })

  test('should handle anki21b collection format', async () => {
    // Test specific to latest format
  })

  test('should handle anki21 collection format', async () => {
    // Test legacy format 2
  })

  test('should handle anki2 collection format', async () => {
    // Test legacy format 1
  })

  test('should extract non-default deck names', async () => {
    // Test deck name extraction with real deck
  })

  test('should filter out default deck names', async () => {
    // Test Default deck filtering logic
  })

  test('should handle multiple deck names', async () => {
    // Test with multi-deck APKG
  })

  test('should parse media mapping file ("media") correctly', async () => {
    // Test media mapping file (Anki packs mapping at path "media")
  })

  test('should extract numbered media files', async () => {
    // Test 0, 1, 2... file extraction
  })

  test('should create proper blob metadata', async () => {
    // Test blob size, type properties
  })

  test('should throw error for non-ZIP files', async () => {
    // Test with plain text file
  })

  test('should throw error for corrupted ZIP', async () => {
    // Test with truncated ZIP
  })

  test('should throw error for missing collection database', async () => {
    // Test ZIP without collection.* file
  })

  test('should handle APKG with no notes', async () => {
    // Test minimal valid APKG
  })

  test('should handle APKG with only default content', async () => {
    // Test with empty user content
  })
})
```

##### A1.2 importApkgData() Tests
```javascript
describe('importApkgData', () => {
  test('should create bundles from Anki note types', async () => {
    // Verify bundle creation with correct field mappings
    // Test template creation with proper ordering
  })

  test('should import notes with cooked fields', async () => {
    // Test field content processing
    // Verify media reference cooking
    // Test tag preservation
  })

  test('should handle media cooking properly', async () => {
    // Test media filename -> NvId conversion
    // Verify reference counting
    // Test template format cooking
  })

  test('should return correct statistics', async () => {
    // Verify bundleIds, note counts, card counts
  })

  test('should handle import errors gracefully', async () => {
    // Test with invalid bundle data
    // Test with media processing failures
  })
})
```

#### A2. Study Engine Unit Tests

##### A2.1 StudyEngine.init() Tests
```javascript
describe('StudyEngine.init', () => {
  test('should initialize session correctly', async () => {
    // Test session start
    // Verify time tracking initialization
    // Test queue building
  })

  test('should build queues with correct card filtering', async () => {
    // Test new card filtering by bundleIds
    // Test due card filtering with time constraints
    // Verify queue limits (maxNewCards, maxReviewCards)
  })

  test('should handle "gather" card order', async () => {
    // Test default import order preservation
    // Verify cards maintain original sequence
  })

  test('should handle "random" card order', async () => {
    // Test complete randomization
    // Verify shuffle operation
  })

  test('should handle "template-random" card order', async () => {
    // Test template grouping with internal randomization
    // Verify templateIdx sorting then shuffle within groups
  })

  test('should handle sibling burying correctly', async () => {
    // Test autoBurySiblings functionality
    // Verify unique noteId filtering
  })
})
```

##### A2.2 StudyEngine.draw() Tests
```javascript
describe('StudyEngine.draw', () => {
  test('should implement "new-first" drawing strategy', async () => {
    // Test new cards prioritized over review
    // Verify review cards drawn only when new exhausted
  })

  test('should implement "review-first" drawing strategy', async () => {
    // Test review cards prioritized over new
    // Verify new cards drawn only when review exhausted  
  })

  test('should implement "mixed" drawing strategy', async () => {
    // Test probability-based distribution
    // Verify ratio matches queue lengths
  })

  test('should manage FSRS history properly', async () => {
    // Test new FSRS entry creation when latest is rated or stale (>24h)
    // Verify response_time is start timestamp until rated, then duration
    // Test entry reuse for short interruptions
  })

  test('should maintain action log for undo', async () => {
    // Verify action log entries
    // Test card source tracking
  })

  test('should return null when no cards available', async () => {
    // Test empty queue handling
  })
})
```

##### A2.3 StudyEngine.rate() Tests
```javascript
describe('StudyEngine.rate', () => {
  test('should update FSRS state correctly', async () => {
    // Test rating application with FSRS
    // Verify due date calculation
    // Test state transitions
  })

  test('should mirror FSRS state to card level', async () => {
    // Test database update with mirrored fields
    // Verify due and state field updates
  })

  test('should handle graduation rules properly', async () => {
    // Test gradGap-based graduation
    // Verify pile transitions (review -> done)
    // Test chronological insertion in review pile
  })

  test('should update session history', async () => {
    // Test history updates after rating
  })

  test('should handle rating errors gracefully', async () => {
    // Test with no active card
    // Test with invalid rating values
  })
})
```

##### A2.4 StudyEngine.undo() Tests
```javascript
describe('StudyEngine.undo', () => {
  test('should undo one card correctly', async () => {
    // Setup: Draw card1, rate it, draw card2
    const card1 = engine.draw()
    const fsrsBeforeRating = JSON.parse(JSON.stringify(card1.fsrs))
    
    await engine.rate(Rating.Good)
    const card2 = engine.draw()
    
    // Undo: Should restore card1 as current
    const restored = await engine.undo()
    
    expect(restored.id).toBe(card1.id)
    expect(restored.fsrs).toEqual(fsrsBeforeRating)
    expect(engine.session.getState().currentCard.id).toBe(card1.id)
  })

  test('should undo two cards correctly', async () => {
    // Setup: Draw card1, rate it, draw card2, rate it, draw card3
    const card1 = engine.draw()
    const card1FsrsBefore = JSON.parse(JSON.stringify(card1.fsrs))
    await engine.rate(Rating.Good)
    
    const card2 = engine.draw()
    const card2FsrsBefore = JSON.parse(JSON.stringify(card2.fsrs))
    await engine.rate(Rating.Hard)
    
    const card3 = engine.draw()
    
    // Undo twice: Should restore card1
    await engine.undo() // Back to card2
    const restored = await engine.undo() // Back to card1
    
    expect(restored.id).toBe(card1.id)
    expect(restored.fsrs).toEqual(card1FsrsBefore)
    
    // Verify card2 also restored to unrated state
    const card2Current = await db.cards.get(card2.id)
    expect(card2Current.fsrs).toEqual(card2FsrsBefore)
  })

  test('should restore card to correct pile', async () => {
    // Test pile restoration (new -> new, review -> review)
  })

  test('should clean up FSRS interruption entries', async () => {
    // Test removing only unrated interruption entry on undo
    // Verify timing reset to current time
  })

  test('should prevent undo with insufficient actions', async () => {
    // Test with only one card drawn (not rated)
    // Should return null
  })

  test('should handle action log inconsistencies', async () => {
    // Test mismatched action log entries
    // Should return null and log warning
  })
})
```

### B. Integration Tests

#### B1. Parser-Engine Integration
```javascript
describe('Parser-Engine Integration', () => {
  test('should create study session from imported APKG', async () => {
    // Import .apkg file -> create study session
    // Verify cards are accessible in study engine
    // Test bundle-based filtering
  })

  test('should handle bundle terminology consistently', async () => {
    // Verify bundleId usage throughout pipeline
    // Test API method alignment (getCardsForBundles, etc.)
  })

  test('should import via processData using returned bundleIds', async () => {
    // Ensure processData uses importApkgData result.bundleIds
    // Verify shard.metadata.bundleIds populated from return value
  })

  test('should preserve card scheduling data', async () => {
    // Test FSRS state preservation through import
    // Verify due dates and card states
  })
})
```

#### B2. Database Integration
```javascript
describe('Database Integration', () => {
  test('should store and retrieve parsed data correctly', async () => {
    // Test note/template/card storage
    // Verify media storage and reference counting
  })

  test('should render templates with media URL replacement', async () => {
    // Validate TemplateRenderer + mediaManager.replaceMediaUrls integration
  })

  test('should handle concurrent access properly', async () => {
    // Test multiple study sessions
    // Test import during active session
  })

  test('should maintain referential integrity', async () => {
    // Test cascade operations
    // Verify cleanup on bundle deletion
  })
})
```

### C. End-to-End Tests

#### C1. Complete Workflow Tests
```javascript
describe('Complete APKG Import and Study Workflow', () => {
  test('should complete full import-to-study cycle', async () => {
    // 1. Parse .apkg file
    // 2. Import to database
    // 3. Create study session
    // 4. Draw and rate cards
    // 5. Complete session
    // Verify each step and final state
  })

  test('should handle multiple APKG imports', async () => {
    // Test importing multiple files
    // Verify bundle isolation
    // Test shard-level aggregation
  })

  test('should support session persistence', async () => {
    // Test session interruption and resumption
    // Verify state persistence across browser restarts
  })
})
```

#### C2. Real-world Scenarios
```javascript
describe('Real-world Usage Scenarios', () => {
  test('should handle large APKG files (1000+ cards)', async () => {
    // Test performance with large datasets
    // Verify memory usage
    // Test queue building efficiency
  })

  test('should handle complex note types with media', async () => {
    // Test with image/audio-rich decks
    // Verify media cooking and rendering
    // Test template complexity
  })

  test('should support different study patterns', async () => {
    // Test cramming sessions (many cards)
    // Test spaced sessions (few cards)
    // Test mixed new/review scenarios
  })
})
```

### D. Error Handling and Edge Cases

#### D1. Parser Error Handling
```javascript
describe('Parser Error Handling', () => {
  test('should handle corrupted APKG files gracefully', async () => {
    // Test with truncated files
    // Test with invalid ZIP structure
    // Test with corrupted SQLite database
  })

  test('should handle unsupported Anki versions', async () => {
    // Test version compatibility
    // Verify graceful degradation
  })

  test('should handle media processing failures', async () => {
    // Test with corrupted media files
    // Test with missing media references
    // Verify partial import success
  })
})
```

#### D2. Study Engine Error Handling
```javascript
describe('Study Engine Error Handling', () => {
  test('should handle database connectivity issues', async () => {
    // Test with unavailable database
    // Test with transaction failures
    // Verify session recovery
  })

  test('should handle invalid session states', async () => {
    // Test with corrupted session store
    // Test with missing bundles
    // Verify error recovery
  })

  test('should handle timing edge cases', async () => {
    // Test with system clock changes
    // Test with very long sessions
    // Verify time tracking accuracy
  })
})
```

### E. Performance Tests

#### E1. Parser Performance
```javascript
describe('Parser Performance', () => {
  test('should parse large files within acceptable time', async () => {
    // Benchmark with various file sizes
    // Set performance thresholds
    // Monitor memory usage
  })

  test('should handle concurrent parsing requests', async () => {
    // Test multiple simultaneous imports
    // Verify resource management
  })
})
```

#### E2. Study Engine Performance
```javascript
describe('Study Engine Performance', () => {
  test('should build queues efficiently', async () => {
    // Benchmark queue building with large datasets
    // Test database query optimization
  })

  test('should handle rapid card interactions', async () => {
    // Test fast rating sequences
    // Verify FSRS calculation performance
  })
})
```

## Additional Test Suggestions

### Performance and Memory Tests
```javascript
describe('Performance Tests', () => {
  test('should complete parsing within time limits', async () => {
    // Benchmark parsing times for different file sizes
    // Set thresholds: <1s for small, <5s for large files
  })

  test('should not leak memory during long sessions', async () => {
    // Monitor memory usage over extended study session
    // Test with 100+ card ratings
  })

  test('should handle concurrent study sessions', async () => {
    // Test multiple StudyEngine instances
    // Verify no interference between sessions
  })
})
```

### Time-Controlled Tests
```javascript
describe('Time-Dependent Features', () => {
  test('should handle due date calculations correctly', async () => {
    // Use controlled time (jest.useFakeTimers)
    // Test FSRS due date progression
  })

  test('should handle day transitions in sessions', async () => {
    // Test session behavior across midnight
    // Verify daily limit resets
  })
})
```

### Bundle ID Consistency Tests
```javascript
describe('Bundle ID Generation', () => {
  test('should generate consistent bundle IDs', async () => {
    // Test same content -> same bundleId
    // Verify deterministic ID generation
  })

  test('should generate different IDs for different content', async () => {
    // Test content changes -> different bundleId
  })
})
```

### FSRS State Transition Tests
```javascript
describe('FSRS State Transitions', () => {
  test('should transition New -> Learning correctly', async () => {
    // Test first rating of new card
  })

  test('should transition Learning -> Review correctly', async () => {
    // Test graduation from learning
  })

  test('should handle Review -> Relearning correctly', async () => {
    // Test lapse scenarios
  })

  test('should maintain FSRS history order', async () => {
    // Test [newest, older, oldest] ordering
  })
})
```

### Session Serialization Tests
```javascript
describe('Session Persistence', () => {
  test('should serialize session state correctly', async () => {
    // Test session.getState() completeness
  })

  test('should restore session state correctly', async () => {
    // Test session restoration from stored state
  })

  test('should handle corrupted session data', async () => {
    // Test graceful degradation with invalid state
  })
})
```

### Core Module Unit Tests
```javascript
describe('TemplateRenderer', () => {
  test('should replace fields (case-insensitive) and FrontSide', async () => {})
  test('should replace NvIds with data URLs via mediaManager', async () => {})
  test('wouldRender should gate empty cards', () => {})
})

describe('CardGenerator', () => {
  test('should generate cards only when template would render', async () => {})
  test('should set default FSRS mirrored fields (due/state/fsrs)', async () => {})
})

describe('AnkiApi', () => {
  test('createNote should return note and cards', async () => {})
  test('getStudyCard should return rendered Q/A with media', async () => {})
  test('cleanupBundles should remove cards and orphan notes', async () => {})
})

describe('MediaManager', () => {
  test('addMedia should map filenames to NvIds and upsert media', async () => {})
  test('retainMedia/removeMedia should maintain refCounts and cleanup at 0', async () => {})
  test('replaceMediaUrls should map NvIds to data URLs in HTML', async () => {})
  test('getMediaDataUrl should cache data URLs', async () => {})
})
```

## Test Data Requirements

### Sample APKG Files (in `anki/test/apkg/`)
1. **basic.apkg** - Simple Q&A cards, no media, single note type
2. **complex.apkg** - Multiple note types, varied templates
3. **media-rich.apkg** - Images, audio, complex HTML formatting
4. **large.apkg** - 1000+ cards for performance testing
5. **minimal.apkg** - Edge case with minimal content
6. **multi-deck.apkg** - Multiple decks in single file
7. **cloze.apkg** - Cloze deletion note types
8. **anki21b.apkg** - Latest format test
9. **anki2.apkg** - Legacy format test

### Parsed Results (in `anki/test/parsed/`)
- Corresponding `.json` files for each `.apkg`
- Used for regression testing and manual inspection
- Versioned to catch parsing changes

### Mock Data Sets
1. **Bundle definitions** - Various field configurations
2. **Note collections** - Different content types and sizes
3. **Session states** - Various study progress scenarios
4. **Card states** - Different FSRS states and due dates

## Testing Infrastructure

### Test Environment Setup
```javascript
// Test database configuration
// Mock file system for APKG files
// Time control for scheduling tests
// Memory monitoring for performance tests
```

### Test Utilities
```javascript
// APKG file discovery and parsing utilities
const parseAllApkgFiles = async () => {
  // Automatically discover and parse all files in anki/test/apkg/
}

// Database state helpers
const setupTestCards = (count, states) => {
  // Create test cards with specific FSRS states
}

// Session state builders
const createSessionWithHistory = (cards, ratings) => {
  // Build session with predefined action history for undo testing
}

// FSRS state comparison helpers
const compareFsrsStates = (before, after) => {
  // Deep comparison of FSRS state arrays
}

// Time control utilities
const advanceTime = (milliseconds) => {
  // Control time for due date testing
}

// Memory monitoring
const trackMemoryUsage = () => {
  // Monitor memory consumption during tests
}

// Snapshot testing for parsed results
const compareWithSnapshot = (parsed, filename) => {
  // Compare parsed results with saved snapshots
}
```

## Success Criteria

### Correctness
- [ ] All unit tests pass with 100% success rate
- [ ] Individual test cases are granular and focused
- [ ] FSRS state transitions are verified before/after operations
- [ ] Undo functionality correctly restores all card states
- [ ] Bundle terminology is used consistently throughout
- [ ] Parsed APKG results match expected structure
- [ ] Integration tests verify component alignment
- [ ] Error handling prevents data corruption

### Performance
- [ ] APKG parsing completes within 1 second for basic files
- [ ] APKG parsing completes within 5 seconds for complex files
- [ ] Queue building completes within 1 second for 1000 cards
- [ ] Card rating updates complete within 100ms
- [ ] Memory usage remains stable during 100+ card sessions
- [ ] No memory leaks detected in long-running tests

### Reliability
- [ ] Database is clean at start of each test (for debugging)
- [ ] No data loss during error conditions
- [ ] Session state serialization/deserialization works correctly
- [ ] Concurrent study sessions don't interfere with each other
- [ ] Time-dependent features work correctly with controlled time
- [ ] Bundle ID generation is deterministic and consistent

## Test Execution Plan

### Phase 1: Unit Tests (Week 1)
- Implement parser unit tests
- Implement study engine unit tests
- Achieve 90%+ code coverage

### Phase 2: Integration Tests (Week 2)
- Build component integration tests
- Test database interactions
- Verify API alignment

### Phase 3: End-to-End Tests (Week 3)
- Create workflow tests
- Test real-world scenarios
- Performance benchmarking

### Phase 4: Error Handling (Week 4)
- Comprehensive error testing
- Edge case validation
- Stress testing

## Maintenance

### Continuous Integration
- Run all tests on every commit
- Performance regression detection with benchmarks
- Automated test data generation and validation
- Snapshot testing for parsed APKG results
- Memory usage monitoring and alerting

### Test Data Management
- Version control for sample APKG files in `anki/test/apkg/`
- Parsed results stored in `anki/test/parsed/` for inspection
- No automatic cleanup (preserve final state for debugging)
- Regular updates to test APKG files for new features
- Automated validation of parsed result schemas

---

*This test plan ensures comprehensive validation of the APKG parser and study engine components, with particular attention to the bundle/deck terminology alignment and overall system reliability.*
