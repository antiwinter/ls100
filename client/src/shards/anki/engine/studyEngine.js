import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import db from '../storage/db.js'
import { log } from '../../../utils/logger'
import { TimeSegments } from '../../../utils/timeTracker.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Study Engine class
export class StudyEngine {

  // Initialize study session with proper session management
  async init(session) {
    // Start session (handles day checks, previous session compaction, etc.)
    session.start()
    this.session = session

    await this._buildQueues()

    // Initialize time tracking with persistence
    const ss = session.getState()
    this.timeTracker = new TimeSegments({
      segments: ss.timeSegments,
      onSegmentChange: (segments) => {
        session.updateTimeSegments(segments)
      }
    })

    this.timeTracker.open()

    log.info('Study session initialized:', {
      day: ss.day,
      deckIds: ss.deckIds
    })

    return ss
  }

  // Build study queues with FSRS + sibling filtering
  async _buildQueues() {
    const now = Date.now()
    const ss = this.session.getState()

    // Get new cards for decks (optimized database query)
    let newCards =  await db.cards
      .where('deckId').anyOf(ss.deckIds)
      .and(card => !card.fsrs?.reps) // New cards have 0 reps
      .toArray()

    let dueCards = await db.cards
      .where('deckId').anyOf(ss.deckIds)
      .and(card => card.fsrs?.due <= now && card.fsrs?.reps > 0)
      .orderBy('fsrs.due')
      .toArray()

    // Sort new cards according to user preference
    function _sort(cards) {
      switch (ss.newCardOrder) {
      case 'random': return _.shuffle(cards)
      case 'template-random':
        return _(cards).sortBy('templateIdx').groupBy('templateIdx').values().map(_.shuffle).flatten().value()
      case 'gather': // fall through
      default:
        return cards
      }
    }
    newCards = _sort(newCards)

    // Apply auto-bury siblings if enabled
    if (ss.autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // Populate tri-queues; ordering within each queue already applied
    ss.pile = {
      new: newCards.slice(0, ss.maxNewCards),
      review: dueCards.slice(0, ss.maxReviewCards),
      done: []
    }
  }

  // Card Drawing with Strategy-Based Selection
  draw() {
    const ss = this.session.getState()
    const { pile } = ss

    // Helper: Extract card from pile if available
    const _pick = (type) => pile[type].length > 0 ?
      { card: pile[type].shift(), from: type } : null

    // Drawing Strategies:
    // - 'new-first': Prioritize new cards, then review
    // - 'review-first': Prioritize review cards, then new
    // - 'mixed': Probability based on queue ratio (fair distribution)
    const strategies = {
      'new-first': () => _pick('new') || _pick('review'),
      'review-first': () => _pick('review') || _pick('new'),
      'mixed': () => {
        const total = pile.new.length + pile.review.length
        if (total === 0) return null
        return _pick(Math.random() < pile.new.length / total
          ? 'new' : 'review')
      }
    }

    const pick = strategies[ss.newReviewOrder] || strategies.mixed
    const result = pick()

    if (result?.card) {
      const c0 = ss.currentCard = result.card

      // FSRS History Management:
      // Each card has fsrs = [newest, older, oldest...] (LIFO order)
      // Check if we need a new FSRS entry or can reuse existing one
      // If no fsrs OR latest entry is unrated (>24h old start time), create new entry
      if ((c0.fsrs?.[0]?.response_time || Infinity) > 24 * 60 * 1000) {
        c0.fsrs ||= []
        c0.fsrs.unshift(createEmptyCard(Date.now())) // Add new entry at front
        c0.fsrs[0].response_time = Date.now() // Store session start time
      }

      // Action Log: Stack of draw operations for undo functionality
      // Each entry: { id: cardId, from: 'new'|'review' }
      ss.actionLog.unshift({ id: result.card.id, from: result.from })
      return result.card
    }

    return null
  }

  // Rate current card and update scheduling
  async rate(rating) {
    const ss = this.session.getState()
    const c0 = ss.currentCard
    if (!c0)
      throw new Error('No active card or session')

    // FSRS Rating Process:
    // 1. Get current FSRS state (always at index 0 - newest entry)
    // 2. Calculate new FSRS state using user's rating
    // 3. Convert start time (stored in response_time) to actual duration
    const now = new Date()
    const next = fsrs.repeat(c0.fsrs[0], now)[rating]

    // Update the latest FSRS entry with calculated values and final response time
    c0.fsrs[0] = {
      ...next.card,
      response_time: now.getTime() - c0.fsrs[0].response_time // Duration in ms
    }

    await db.cards.update(c0.id, { fsrs: c0.fsrs })

    // Graduation Rule: Cards graduate to 'done' if due time exceeds initial gap
    // Cards that don't graduate go back to review pile, sorted by due time
    if (next.card.due - now < (ss.initialGap || 0) * 60 * 1000) {
      // Insert into review pile in chronological order (new cards without due = 0 go first)
      const insertIndex = _.sortedIndexBy(ss.pile.review, c0,
        c => c.fsrs[0]?.due || 0)
      ss.pile.review.splice(insertIndex, 0, c0)
    } else
      ss.pile.done.push(c0)

    this.session.updateHistory()
    log.debug('Card rated:', { cardId: c0.id, rating })
    ss.currentCard = null
  }

  // End study session
  finish() {
    // Update session store - complete session
    this.session.finish()
  }

  // getProgress removed, use session.getState().history instead

  // Undo last step using action log
  async undo() {
    const ss = this.session.getState()
    // Need at least 2 actions: can't undo if only one card drawn (not rated yet)
    if ((ss.actionLog?.length || 0) < 2)
      return null

    // Pop last draw action and verify it matches current card
    const lastDraw = ss.actionLog.shift()
    const c0 = ss.currentCard
    if (lastDraw?.id !== c0?.id) {
      log.warn('Current card not found in action log:', {
        c0,
        lastDraw
      })
      return null
    }

    // Return current (unrated) card to its source pile
    ss.pile[lastDraw.from || 'review'].unshift(c0)

    // Restore previous card from action stack
    const top = ss.actionLog[0]
    const c1 = await db.cards.get(top.id)
    ss.currentCard = c1

    // FSRS Cleanup: Remove the unrated entry added when c1 was interrupted
    // Action stack guarantees c1 was rated (otherwise couldn't draw next card)
    // So c1.fsrs = [unrated_entry_from_interruption, rated_entry, ...]
    c1.fsrs.shift() // Remove interruption entry
    c1.fsrs[0].response_time = Date.now() // Reset timing for new session
    return c1
  }
}

log.debug('Study engine initialized')
