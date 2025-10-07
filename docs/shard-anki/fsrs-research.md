# FSRS Research & Findings

## Overview

This document records our investigation into Free Spaced Repetition Scheduler (FSRS) behavior, particularly regarding learning intervals and state transitions.

## Investigation: AGAIN → GOOD Interval

### Background

We observed that after rating a new card as AGAIN once, the next GOOD rating results in a 24-hour interval. This seemed potentially too aggressive for learning.

### Test Results

Using `ts-fsrs` (the JavaScript FSRS implementation), we tested several scenarios:

#### Scenario 1: New Card → AGAIN → GOOD

```javascript
const fsrs = new FSRS()
const now = new Date('2025-10-05 20:00:00')

// Initial card
let card = createEmptyCard(now)
// state: 0 (New), stability: 0, difficulty: 0

// Rate AGAIN
const afterAgain = fsrs.repeat(card, now)[Rating.Again]
// state: 1 (Learning)
// interval: 1 minute
// stability: 0.212
// difficulty: 6.4133

// Rate GOOD
const afterGood = fsrs.repeat(afterAgain.card, now)[Rating.Good]
// state: 2 (Review)
// interval: 24 hours (1440 minutes)
// stability: 0.24668919
// difficulty: 6.40211507
```

**Key Finding**: After AGAIN, the next GOOD rating **graduates the card directly to Review state** with a 24-hour interval.

#### Scenario 2: New Card → GOOD (Direct)

```javascript
// Rate GOOD on first review
const afterGood = fsrs.repeat(card, now)[Rating.Good]
// state: 1 (Learning) - stays in learning!
// interval: 10 minutes
// stability: 2.3065
// difficulty: 2.11810397
```

**Key Finding**: Rating GOOD directly keeps the card in Learning state with a 10-minute interval.

#### Scenario 3: New Card → AGAIN → HARD → GOOD

```javascript
// After AGAIN: 1 minute (Learning)
// After HARD: 6 minutes (Learning)
// After GOOD: 24 hours (Review)
```

**Key Finding**: Even with HARD between AGAIN and GOOD, the GOOD rating still graduates to 24 hours.

### Analysis

**This is the default ts-fsrs behavior**, not a bug. Key insights:

1. **State Transitions**: 
   - AGAIN puts card in Learning state (state=1)
   - Any subsequent GOOD rating graduates directly to Review state (state=2)
   - Graduation interval from Learning → Review is ~24 hours

2. **Different from Traditional Anki**:
   - Traditional Anki has "learning steps" (e.g., 1m, 10m, 1d)
   - You must pass through multiple steps before graduating
   - FSRS is more aggressive about graduation

3. **FSRS Philosophy**:
   - Research-based algorithm optimized for long-term retention
   - Trusts its memory model (stability/difficulty) over manual step progression
   - 24-hour graduation is based on calculated stability

## Anki's Hybrid Approach

### Code Investigation

We examined Anki's FSRS implementation (Rust code in `rslib/src/scheduler/`):

**Key Files**:
- `rslib/src/deckconfig/mod.rs` - Config includes `learn_steps` and `relearn_steps`
- `rslib/src/scheduler/states/steps.rs` - Learning steps logic
- `rslib/src/scheduler/answering/relearning.rs` - Hybrid FSRS + steps

### Critical Finding

**Anki uses BOTH FSRS AND learning steps!** From `relearning.rs`:

```rust
if let Some(states) = &ctx.fsrs_next_states {
    let interval = states.again.interval;
    let again_relearn = RelearnState {
        learning: LearnState {
            remaining_steps: ctx.relearn_steps.remaining_for_failed(),
            scheduled_secs: (interval * 86_400.0) as u32,  // FSRS interval
            ...
        },
        ...
    };
    // Check if short-term FSRS is enabled
    if ctx.fsrs_allow_short_term
        && (ctx.fsrs_short_term_with_steps_enabled || ctx.relearn_steps.is_empty())
        && interval < 0.5
    {
        again_relearn.into()  // Use FSRS short-term interval
    } else {
        again_review.into()   // Graduate to review
    }
}
```

**Anki has two FSRS modes**:

1. **FSRS with learning steps** (default):
   - Uses traditional steps (1m, 10m, etc.) for initial learning
   - FSRS calculates the **final** graduation interval
   - More gradual progression for learners

2. **Pure FSRS** (what we're using):
   - No learning steps
   - FSRS handles all scheduling from the start
   - Jumps to 24h after Learning → Review transition
   - Controlled by `fsrs_short_term_with_steps_enabled` config

## Decision

**We accept the 24-hour interval as correct FSRS behavior** for the following reasons:

1. **Research-based**: FSRS is an evidence-based algorithm, not arbitrary
2. **Performance-optimized**: 24h is calculated based on memory state (stability/difficulty)
3. **Simplicity**: Pure FSRS is simpler than hybrid approach
4. **Good enough**: For motivated learners, 24h after one failure is reasonable

### Future Considerations

If users find 24h too aggressive, we could:

1. **Add learning steps configuration** (like Anki's hybrid mode)
2. **Customize FSRS parameters** (if ts-fsrs supports it)
3. **Add a preference** to cap initial graduation intervals

But for now, **pure FSRS with 24h graduation is the intended behavior**.

## Related Issues

### Bug Fixed: Queue Ordering After Rating

During this investigation, we found a **separate bug** where rated cards were placed in the wrong queue position.

**Issue**: After rating, the card's `due` field in memory was stale, causing incorrect queue placement.

**Fix**: 
```javascript
// After updating FSRS
await db.cards.update(head.id, { fsrs: head.fsrs })

// Mirror db hook behavior in memory
head.due = head.fsrs[0].due
head.state = head.fsrs[0].state

// Use fresh due date for queue insertion
const newDue = head.fsrs[0].due
if (newDue - now.getTime() > gradGap * 60 * 1000) {
  // Graduated? Push to back
  idx = this.queue.length - 1
} else {
  // Insert by due order
  for (const [i, v] of this.queue.entries()) {
    if (v === null || v.due > newDue) {
      idx = i
      break
    }
  }
}
```

## References

- FSRS Paper: https://github.com/open-spaced-repetition/fsrs4anki
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs
- Anki FSRS Implementation: `anki/rslib/src/scheduler/fsrs/`

## Test Cases

Test file: `client/src/shards/anki/test/engine.rating-order.test.js`

Validates:
- Queue ordering after rating
- Cards with future due dates placed after older cards
- `head.due` synchronization with `head.fsrs[0].due`

---

**Last Updated**: October 2025  
**Authors**: Development team  
**Status**: Research complete, behavior accepted

