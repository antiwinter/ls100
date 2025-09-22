import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import db from './db.js'
import { snapshot } from 'valtio'
import { log } from '../../../utils/logger.js'
import { TimeSegments } from '../../../utils/timeTracker.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Study Engine class
export class StudyEngine {
  constructor(sessionStore) {
    this.sessionStore = sessionStore
    this.session = null
    this.timeTracker = null
  }

  // Initialize study session with proper session management
  async init(session) {
    // Valtio session
    this.session = session

    if (session.start())
      // new session, build queues
      await this._buildQueues()

    this.timeTracker = new TimeSegments({
      segments: session.timeTracking?.segments,
      onSegmentChange: (segments, total) => {
        session.timeTracking = { segments, total }
      }
    })

    this.timeTracker.open()

    log.info('Study session initialized:', snapshot(session))
    return session
  }

  // Build study queues with FSRS + sibling filtering
  async _buildQueues() {
    const now = Date.now()
    const ss = this.session

    // Get new cards for bundles (optimized database query using mirrored state)
    let newCards = await db.cards
      .where('bundleId').anyOf(ss.bundleIds)
      .and(card => card.state === 'New')
      .toArray()

    // Get due cards for review (optimized database query using mirrored due)
    let dueCards = await db.cards
      .where('bundleId').anyOf(ss.bundleIds)
      .and(card => card.state !== 'New' && card.due <= now)
      .sortBy('due')

    // Sort new cards according to user preference
    function _sort(cards) {
      switch (ss.newCardOrder) {
      case 'random': return _.shuffle(cards)
      case 'template-random':
        return _(cards).sortBy('templateOrd').groupBy('templateOrd').values().map(_.shuffle).flatten().value()
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
      raw: newCards.slice(0, ss.maxNewCards),
      review: dueCards.slice(0, ss.maxReviewCards),
      done: []
    }
  }

  // Card Drawing with Strategy-Based Selection
  draw() {
    // Handle empty session gracefully
    if (!this.session) return null
    const ss = this.session
    const { pile } = ss

    if (ss.currentCard) return ss.currentCard

    // Helper: Extract card from pile if available
    const _pick = (type) => pile[type].length > 0 ?
      { card: pile[type].shift(), from: type } : null

    // Drawing Strategies:
    // - 'new-first': Prioritize new cards, then review
    // - 'review-first': Prioritize review cards, then new
    // - 'mixed': Probability based on queue ratio (fair distribution)
    const strategies = {
      'new-first': () => _pick('raw') || _pick('review'),
      'review-first': () => _pick('review') || _pick('raw'),
      'mixed': () => {
        const total = pile.raw.length + pile.review.length
        if (total === 0) return null
        return _pick(Math.random() < pile.raw.length / total
          ? 'raw' : 'review')
      }
    }

    const pick = strategies[ss.newReviewOrder] || strategies.mixed
    const result = pick()

    if (result?.card) {
      const c0 = ss.currentCard = result.card

      c0._drawTs = Date.now()

      // Action Log: Stack of draw operations for undo functionality
      // Each entry: { id: cardId, from: 'raw'|'review' }
      ss.actionLog.unshift({ id: result.card.id, from: result.from })
      return result.card
    } else
      ss.finish()

    return null
  }

  // Rate current card and update scheduling
  async rate(rating) {
    // Handle empty session gracefully
    if (!this.session) return
    const ss = this.session
    const c0 = ss.currentCard
    if (!c0)
      throw new Error('No active card')

    // FSRS Rating Process:
    // 1. Get current FSRS state (always at index 0 - newest entry)
    // 2. Calculate new FSRS state using user's rating
    // 3. Convert start time (stored in response_time) to actual duration
    const now = new Date()

    // Update the latest FSRS entry with calculated values and final response time
    const next = fsrs.repeat(c0.fsrs?.[0] || createEmptyCard(Date.now()), now)[rating]
    c0.fsrs ||= []
    c0.fsrs.unshift({
      ...next.card,
      rating,
      response_time: now.getTime() - c0._drawTs
    })
    delete c0._drawTs

    // Mirror latest FSRS state to card level for fast queries
    await db.cards.update(c0.id, {
      fsrs: snapshot(c0.fsrs),
      due: c0.fsrs[0].due,
      state: c0.fsrs[0].state
    })

    // Graduation Rule: Cards graduate to 'done' if due time exceeds initial gap
    // Cards that don't graduate go back to review pile, sorted by due time
    if (next.card.due - now < (ss.initialGap || 0) * 60 * 1000) {
      // Insert into review pile in chronological order (new cards without due = 0 go first)
      const insertIndex = _.sortedIndexBy(ss.pile.review, c0,
        c => c.due || 0)
      ss.pile.review.splice(insertIndex, 0, c0)
    } else
      ss.pile.done.push(c0)

    this.session.updateHistory()
    log.debug('Card rated:', { cardId: c0.id, rating })
    ss.currentCard = null
  }

  // Undo last step using action log
  async undo() {
    const ss = this.session
    // Handle empty session gracefully
    if (!ss) return null
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
    return c1
  }
}

log.debug('Study engine initialized')
