import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import db from './db.js'
import { AnkiSessionStore } from './sessionStore.js'
import { log } from '../../../utils/logger.js'
import { TimeSegments } from '../../../utils/timeTracker.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Study Engine class
export class StudyEngine {
  _getCurrentDay(dailyResetTime) {
    const now = Date.now() / (60 * 1000)
    const resetOffs = (dailyResetTime || 0) * 60
    const tzOffs = new Date().getTimezoneOffset()
    const delta = now - resetOffs + tzOffs
    return Math.floor(delta / (60 * 24))
  }
  // Initialize study session with proper session management
  async init(prefs, shardId) {
    // prefs: plain state snapshot; session: per-shard engine state
    this.prefs = prefs || {}
    this.store = AnkiSessionStore(shardId)

    // initialize ephemeral fields
    const s = this.store.getState()
    this.day = s.day || null
    this.currentCard = s.currentCard || null
    this.pile = s.pile || { raw: [], review: [], done: [] }
    this.actionLog = s.actionLog || []
    this.timeTracking = s.timeTracking || null

    const today = this._getCurrentDay(this.prefs.dailyResetTime)
    const prevDay = this.store.getState().day
    if (!prevDay || prevDay !== today) {
      // new session, build queues
      await this._buildQueues()
      // Set day flag only after successful queue building
      this.day = today
      this.currentCard = null
      this.actionLog = []
      this.timeTracking = null
      this.flush(['day', 'currentCard', 'actionLog', 'timeTracking'])
    }

    this.timeTracker = new TimeSegments({
      segments: this.timeTracking?.segments,
      onSegmentChange: (segments, total) => {
        this.timeTracking = { segments, total }
        // persist time tracking so user can resume after breaks
        this.store.setState({ timeTracking: this.timeTracking })
      }
    })

    this.timeTracker.open()

    log.info('Study session initialized:')
    return this
  }

  // Build study queues with FSRS + sibling filtering
  async _buildQueues() {
    const now = Date.now()
    const prefs = this.prefs
    const ses = this.store.getState()
    // Get new cards for bundles (optimized database query using mirrored state)
    let newCards = await db.cards
      .where('bundleId').anyOf(ses.bundleIds)
      .and(card => card.state === 'New')
      .toArray()

    // Get due cards for review (optimized database query using mirrored due)
    let dueCards = await db.cards
      .where('bundleId').anyOf(ses.bundleIds)
      .and(card => card.state !== 'New' && card.due <= now)
      .sortBy('due')

    // Sort new cards according to user preference
    function _sort(cards) {
      switch (prefs.newCardOrder) {
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
    if (prefs.autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // Populate tri-queues; ordering within each queue already applied
    this.pile = {
      raw: newCards.slice(0, prefs.maxNewCards),
      review: dueCards.slice(0, prefs.maxReviewCards),
      done: []
    }
    log.debug('Built queues', this.pile)
    // persist queues to store so user can pause/resume
    this.flush(['pile'])
  }

  // Card Drawing with Strategy-Based Selection
  draw() {
    // Handle empty session gracefully
    const { pile } = this
    if (this.currentCard) return this.currentCard

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

    const pick = strategies[this.prefs.newReviewOrder] || strategies.mixed
    const result = pick()

    if (result?.card) {
      const c0 = this.currentCard = result.card

      c0._drawTs = Date.now()

      // Action Log: Stack of draw operations for undo functionality
      // Each entry: { id: cardId, from: 'raw'|'review' }
      this.actionLog.unshift({ id: result.card.id, from: result.from })
      // persist current card and action log
      this.flush(['currentCard', 'actionLog'])
      return result.card
    } else {
      this.finish()
    }

    return null
  }

  // Rate current card and update scheduling
  async rate(rating) {
    // Handle empty session gracefully
    const c0 = this.currentCard
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
      fsrs: c0.fsrs,
      due: c0.fsrs[0].due,
      state: c0.fsrs[0].state
    })

    // Graduation Rule: Cards graduate to 'done' if due time exceeds initial gap
    // Cards that don't graduate go back to review pile, sorted by due time
    const { gradGap } = this.prefs
    if (next.card.due - now.getTime() < (gradGap || 0) * 60 * 1000) {
      // Insert into review pile in chronological order (new cards without due = 0 go first)
      const insertIndex = _.sortedIndexBy(this.pile.review, c0,
        c => c.due || 0)
      this.pile.review.splice(insertIndex, 0, c0)
    } else
      this.pile.done.push(c0)

    this.updateHistory()
    log.debug('Card rated:', { cardId: c0.id, rating })
    this.currentCard = null
    // persist piles and clear current card
    this.flush(['pile', 'currentCard'])
  }

  // Undo last step using action log
  async undo() {
    // Handle empty session gracefully
    if (!this.actionLog?.length) return null
    // Need at least 2 actions: can't undo if only one card drawn (not rated yet)
    if ((this.actionLog?.length || 0) < 2)
      return null

    // Pop last draw action and verify it matches current card
    const lastDraw = this.actionLog.shift()
    const c0 = this.currentCard
    if (lastDraw?.id !== c0?.id) {
      log.warn('Current card not found in action log:', {
        c0,
        lastDraw
      })
      return null
    }

    // Return current (unrated) card to its source pile
    this.pile[lastDraw.from || 'review'].unshift(c0)

    // Restore previous card from action stack
    const top = this.actionLog[0]
    const c1 = await db.cards.get(top.id)
    this.currentCard = c1
    // persist undo state
    this.flush(['pile', 'currentCard', 'actionLog'])

    // FSRS Cleanup: Remove the latest rating that was just applied to c1
    // When we rated c1 and drew the next card (c0), c1's FSRS state was updated
    // We need to revert c1 back to its pre-rating state
    c1.fsrs.shift() // Remove the most recent rating entry

    // Persist the reverted state back to database
    if (c1.fsrs.length > 0) {
      await db.cards.update(c1.id, {
        fsrs: c1.fsrs,
        due: c1.fsrs[0].due,
        state: c1.fsrs[0].state
      })
    } else {
      // If no FSRS history remains, restore to initial New state
      await db.cards.update(c1.id, {
        fsrs: null,
        due: Date.now(),
        state: 'New'
      })
    }

    return c1
  }

  // Compact the finished session into history (per-day aggregate)
  updateHistory() {
    const day = this.store.getState().day
    if (!day) return
    const res = { raw: 0, learning: 0, review: 0, relearning: 0 }
    this.pile.done.forEach(card => {
      res[card.state?.toLowerCase() || 'raw']++
    })

    const totalCards = this.pile.raw.length + this.pile.review.length + this.pile.done.length
    const timeTracking = this.timeTracking || {}
    const completion = Math.round(this.pile.done.length / (totalCards + 0.01))
    this.store.setState((s) => ({
      history: {
        ...s.history,
        [day]: { ...res, ...timeTracking, completion }
      }
    }))
  }

  finish() {
    this.updateHistory()
  }

  flush(keys) {
    const payload = {}
    for (const k of keys) payload[k] = this[k]
    this.store.setState(payload)
  }
}

log.debug('Study engine initialized')
