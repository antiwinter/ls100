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

  // Get next card for study
  draw() {
    const ss = this.session.getState()
    const { pile } = ss

    const _pick = (type) => pile[type].length > 0 ?
      { card: pile[type].shift(), from: type } : null

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
      ss.currentCard = result.card
      ss.actionLog.unshift({ id: result.card.id, from: result.from })
      return result.card
    }

    return null
  }

  // Rate current card and update scheduling
  async rate(rating) {
    const ss = this.session.getState()
    if (!ss.currentCard || !ss.day) {
      throw new Error('No active card or session')
    }

    // Process rating with FSRS and update DB
    const now = new Date()
    const base = ss.currentCard.fsrs || createEmptyCard(now)
    const next = fsrs.repeat(base, now)[rating]

    await db.cards.update(ss.currentCard.id, { fsrs: next.card })

    // Apply graduation rule: graduate if due beyond initial gap
    const updatedCard = { ...ss.currentCard, fsrs: next.card }
    const gapReached = next.card.due.getTime() - Date.now() >= (ss.initialGap || 0) * 60 * 1000

    if (gapReached) {
      ss.pile.done.push(updatedCard)
    } else {
      // Use lodash's sortedIndexBy for ordered insert
      const insertIndex = _.sortedIndexBy(ss.pile.review, updatedCard,
        c => c.fsrs?.due?.getTime?.() ?? c.fsrs?.due ?? Infinity)
      ss.pile.review.splice(insertIndex, 0, updatedCard)
    }

    this.session.updateHistory()
    log.debug('Card rated:', { cardId: ss.currentCard.id, rating })
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
    if (!ss.day || !Array.isArray(ss.actionLog) || ss.actionLog.length === 0) return null

    // Pop last draw action
    const lastDraw = ss.actionLog.shift()
    if (!lastDraw) return null

    // Return current card to its source pile
    const cur = ss.currentCard
    if (cur && lastDraw.id === cur.id) {
      if (lastDraw.from === 'new') ss.pile.new.unshift(cur)
      else if (lastDraw.from === 'review') ss.pile.review.unshift(cur)
    } else
      log.warn('Current card not found in action log:', {
        currentCard: cur,
        lastDraw
      })

    // Set current card from top of stack (if any)
    const topAction = ss.actionLog[0]
    if (topAction) {
      const card = await db.cards.get(topAction.id)
      ss.currentCard = card
    } else {
      ss.currentCard = null
    }

    return ss.currentCard
  }
}

log.debug('Study engine initialized')
