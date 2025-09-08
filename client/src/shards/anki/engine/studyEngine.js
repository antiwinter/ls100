import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import db from '../storage/db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import { TimeSegments } from '../../../utils/timeTracker.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Study Engine class
export class StudyEngine {

  // Initialize study session with proper session management
  async init(deckIds, store) {
    const day = store.getCurrentDay()
    let ss = store.getState().currentSession

    if (ss?.day === day) {
      return null
    }

    // Create new session
    ss ||= {
      id: await genId('session', Date.now().toString()),
      deckIds: this.deckIds,
      day,

      // Session State (for resumption)
      currentCard: null,
      pile: { new: [], review: [], done: [] },
      actionLog: [],
      timeSegments: []

      // Statistics: calc from queues & cards
    }
    store.setCurrentSession(ss)

    await this._buildQueues()

    // Initialize time tracking with persistence
    this.timeTracker = new TimeSegments({
      segments: ss.timeSegments,
      onSegmentChange: (segments) => {
        ss.timeSegments = [...segments]
        this.store.setCurrentSession(ss)
      }
    })

    this.timeTracker.open()

    log.info('Study session initialized:',
      _.pick(ss, ['id', 'deckIds', 'day']))

    this.store = store
    this.deckIds = deckIds
    return ss
  }

  // Build study queues with FSRS + sibling filtering
  async _buildQueues() {
    const now = Date.now()
    const store = this.store
    const ss = store.getState().currentSession

    // Get new cards for decks (optimized database query)
    let newCards =  await db.cards
      .where('deckId').anyOf(this.deckIds)
      .and(card => !card.fsrs?.reps) // New cards have 0 reps
      .toArray()

    let dueCards = await db.cards
      .where('deckId').anyOf(this.deckIds)
      .and(card => card.fsrs?.due <= now && card.fsrs?.reps > 0)
      .orderBy('fsrs.due')
      .toArray()

    // Sort new cards according to user preference
    function _sort(cards) {
      switch (store.getState().newCardOrder) {
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
    if (store.getState().autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // Populate tri-queues; ordering within each queue already applied
    ss.pile.new =  newCards.slice(0, store.getState().maxNewCards)
    ss.pile.review = dueCards.slice(0, store.getState().maxReviewCards)
    ss.pile.done = []
  }

  // Get next card for study
  draw() {
    const ss = this.store.getState().currentSession

    const pickFromMixed = () => {
      const hasNew = ss.pile.new.length > 0
      const hasRev = ss.pile.review.length > 0
      if (!hasNew && !hasRev) return null
      if (hasNew && !hasRev) return { card: ss.pile.new.shift(), from: 'new' }
      if (!hasNew && hasRev) return { card: ss.pile.review.shift(), from: 'review' }
      // both available -> roll dice
      const roll = Math.random() < 0.5 ? 'review' : 'new'
      return roll === 'review'
        ? { card: ss.pile.review.shift(), from: 'review' }
        : { card: ss.pile.new.shift(), from: 'new' }
    }

    let chosen = null
    switch (this.store.getState().newReviewOrder) {
    case 'new-first':
      chosen = ss.pile.new.length > 0
        ? { card: ss.pile.new.shift(), from: 'new' }
        : (ss.pile.review.length > 0 ? { card: ss.pile.review.shift(), from: 'review' } : null)
      break
    case 'review-first':
      chosen = ss.pile.review.length > 0
        ? { card: ss.pile.review.shift(), from: 'review' }
        : (ss.pile.new.length > 0 ? { card: ss.pile.new.shift(), from: 'new' } : null)
      break
    case 'mixed':
    default:
      chosen = pickFromMixed()
    }

    const next = chosen?.card || null
    if (next) next._from = chosen.from
    ss.currentCard = next
    if (next) ss.actionLog.push({ t: 'draw', id: next.id, from: chosen.from })
    return next
  }

  // Rate current card and update scheduling
  async rate(rating) {
    const ss = this.store.getState().currentSession
    if (!ss.currentCard || !ss) {
      throw new Error('No active card or session')
    }

    const c0 = ss.currentCard

    // Process rating with FSRS
    // Use only fsrs payload for scheduling to avoid schema drift
    const now = new Date()
    // FIXED: create default FSRS card via library and store it directly
    const base = c0.fsrs || createEmptyCard(now)
    const scheduling = fsrs.repeat(base, now)
    const next = scheduling[rating]

    const prevFsrs = { ...base }
    const nextFsrs = { ...next.card }
    await db.cards.update(c0.id, { fsrs: nextFsrs })

    // Real-time session history update
    this.store.updateSessionHistory({
      totalTime: this.timeTracker.total()
    })

    const dueTs = next.card.due.getTime()

    // Decide graduation vs reinsert based on type and timing
    const isNewCard = !(c0?.fsrs?.reps > 0)
    const initialGapMs = (this.store.getState().initialGap || 0) * 60 * 1000
    const nowTs = Date.now()
    const updatedCard = { ...c0, fsrs: { ...next.card } }

    let to = null
    if (isNewCard) {
      // New card graduation requires due beyond initial gap
      const gapReached = dueTs - nowTs >= initialGapMs
      if (gapReached) {
        ss.pile.done.push(updatedCard)
        to = 'done'
      } else {
        // Keep within session: treat as immediate review candidate
        ss.pile.review = _.sortBy(
          [...ss.pile.review, updatedCard],
          c => (c.fsrs?.due?.getTime?.() ?? c.fsrs?.due ?? Infinity)
        )
        to = 'review'
      }
    } else {
      // Review cards always go back to review deck, sorted by due
      ss.pile.review = _.sortBy(
        [...ss.pile.review, updatedCard],
        c => (c.fsrs?.due?.getTime?.() ?? c.fsrs?.due ?? Infinity)
      )
      to = 'review'
    }

    ss.actionLog.push({
      t: 'rate',
      id: c0.id,
      rating,
      from: c0._from,
      to,
      prev: prevFsrs,
      next: nextFsrs
    })

    // FIXME: fix the log
    log.debug('Card rated:', {
      // FIXED: include real card id
      cardId: c0.id,
      rating
    })

    // current cleared; next card will be drawn by caller
    ss.currentCard = null
  }

  // End study session
  finish() {
    if (!this.store.getState().currentSession) return

    const totalTime = this.timeTracker.total()
    this.timeTracker.destroy()

    log.info('Study session ended:', {
      sessionId: this.store.getState().currentSession.id,
      totalTime: Math.round(totalTime / 1000) + 's'
    })

    // Update session store - complete session
    this.store.completeCurrentSession()
  }

  // Get session progress
  getProgress() {
    if (!this.store.getState().currentSession) return null

    const ss = this.store.getState().currentSession

    return {
      cardsRemaining:
        (ss.pile.new?.length || 0) +
        (ss.pile.review?.length || 0) +
        (ss.currentCard ? 1 : 0),
      timeElapsed: this.timeTracker?.total() || 0
    }
  }

  // Undo last step using action log
  async undo() {
    const ss = this.store.getState().currentSession
    if (!ss || !Array.isArray(ss.actionLog) || ss.actionLog.length === 0) return null

    // If the last action was a draw, revert it first
    const last = ss.actionLog.pop()
    let rateAction = last
    if (last.t === 'draw') {
      // return currentCard to its source deck front
      const cur = ss.currentCard
      if (cur && last.id === cur.id) {
        if (last.from === 'new') ss.pile.new.unshift(cur)
        else if (last.from === 'review') ss.pile.review.unshift(cur)
        ss.currentCard = null
      }
      rateAction = ss.actionLog.pop() || null
    }

    if (!rateAction || rateAction.t !== 'rate') return ss.currentCard

    // Remove the card from its destination queue if present
    const removeById = (arr, id) => {
      const i = arr.findIndex(c => c.id === id)
      if (i >= 0) arr.splice(i, 1)
    }
    if (rateAction.to === 'done') removeById(ss.pile.done, rateAction.id)
    else if (rateAction.to === 'new') removeById(ss.pile.new, rateAction.id)
    else if (rateAction.to === 'review') removeById(ss.pile.review, rateAction.id)

    // Restore FSRS in DB and set as current
    await db.cards.update(rateAction.id, { fsrs: { ...rateAction.prev } })
    const card = await db.cards.get(rateAction.id)
    ss.currentCard = card
    ss.currentCard._from = rateAction.from

    return ss.currentCard
  }
}

log.debug('Study engine initialized')
