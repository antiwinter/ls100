import { FSRS, Rating, createEmptyCard } from 'ts-fsrs'
import db from '../storage/db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import { getSessionDate } from '../storage/useSessionStore.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// FIXED: use FSRS card object directly (no JSON mapping)

// Study Engine class
export class StudyEngine {
  constructor(shardId, deckIds, store) {
    this.shardId = shardId
    this.deckIds = deckIds
    this.store = store
  }

  // Initialize study session with proper session management
  async init() {
    const store = this.store
    const day = store.getCurrentDay()
    let ss = store.currentSession

    if (ss?.day === day) {
      return null
    }

    // Create new session
    // Set session in store for persistence
    ss ||= {
      id: await genId('session', Date.now().toString()),
      shardId: this.shardId,
      deckIds: this.deckIds,

      // Session State (for resumption)
      currentCard: null,
      deckNew: [],
      deckReview: [],
      deckDone: [],
      actionLog: [],

      // Timing (for resumption)
      startTime: Date.now(),
      timeSpent: 0,
      pauseTime: null,
      totalPauseTime: 0,

      // Statistics
      // Study progress (for resumption)
      studied: [0, 0, 0, 0],
      failed: 0,
      ratings:[0, 0, 0, 0]
    }
    store.setCurrentSession(ss)

    await this._buildQueues()
    log.info('Study session initialized:',
      _.pick(ss, ['shardId', 'deckIds', 'deckNew',
        'deckReview', 'deckDone', 'sessionId',
        'autoBurySiblings']))

    return ss
  }

  // Build study queues with FSRS + sibling filtering
  async _buildQueues() {
    const now = Date.now()
    const store = this.store
    const ss = store.currentSession

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
      switch (store.newCardOrder) {
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
    if (store.autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // Populate tri-queues; ordering within each queue already applied
    ss.deckNew =  newCards.slice(0, store.maxNewCards)
    ss.deckReview = dueCards.slice(0, store.maxReviewCards)
    ss.deckDone = []
  }

  // Get next card for study
  draw() {
    const ss = this.store.currentSession

    const pickFromMixed = () => {
      const hasNew = ss.deckNew.length > 0
      const hasRev = ss.deckReview.length > 0
      if (!hasNew && !hasRev) return null
      if (hasNew && !hasRev) return { card: ss.deckNew.shift(), from: 'new' }
      if (!hasNew && hasRev) return { card: ss.deckReview.shift(), from: 'review' }
      // both available -> roll dice
      const roll = Math.random() < 0.5 ? 'review' : 'new'
      return roll === 'review'
        ? { card: ss.deckReview.shift(), from: 'review' }
        : { card: ss.deckNew.shift(), from: 'new' }
    }

    let chosen = null
    switch (this.store.newReviewOrder) {
    case 'new-first':
      chosen = ss.deckNew.length > 0
        ? { card: ss.deckNew.shift(), from: 'new' }
        : (ss.deckReview.length > 0 ? { card: ss.deckReview.shift(), from: 'review' } : null)
      break
    case 'review-first':
      chosen = ss.deckReview.length > 0
        ? { card: ss.deckReview.shift(), from: 'review' }
        : (ss.deckNew.length > 0 ? { card: ss.deckNew.shift(), from: 'new' } : null)
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
    const ss = this.store.currentSession
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

    // Update session stats
    if (rating !== Rating.Again) {
      const stateIndex = typeof base.state === 'number' ? base.state : 0
      ss.studied[stateIndex]++
    } else {
      ss.failed++
    }
    ss.ratings[rating]++

    // Update time spent
    ss.timeSpent = Date.now() - ss.startTime

    // Real-time session history update
    this.store.updateSessionHistory(
      _.pick(ss, ['startTime', 'timeSpent',
        'pauseTime', 'totalPauseTime',
        'studied', 'failed', 'ratings']))

    const dueTs = next.card.due.getTime()

    // Decide graduation vs reinsert based on type and timing
    const isNewCard = !(c0?.fsrs?.reps > 0)
    const initialGapMs = (this.store.initialGap || 0) * 60 * 1000
    const nowTs = Date.now()
    const updatedCard = { ...c0, fsrs: { ...next.card } }

    let to = null
    if (isNewCard) {
      // New card graduation requires due beyond initial gap
      const gapReached = dueTs - nowTs >= initialGapMs
      if (gapReached) {
        ss.deckDone.push(updatedCard)
        to = 'done'
      } else {
        // Keep within session: treat as immediate review candidate
        ss.deckReview = _.sortBy(
          [...ss.deckReview, updatedCard],
          c => (c.fsrs?.due?.getTime?.() ?? c.fsrs?.due ?? Infinity)
        )
        to = 'review'
      }
    } else {
      // Review cards always go back to review deck, sorted by due
      ss.deckReview = _.sortBy(
        [...ss.deckReview, updatedCard],
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
    if (!this.store.currentSession) return

    const ss = this.store.currentSession
    ss.endTime = Date.now()

    // Calculate actual study time (excluding pauses)
    let actualStudyTime = ss.endTime - ss.startTime
    if (ss.pauseTime) {
      // Account for current pause if session is paused
      ss.totalPauseTime += ss.endTime - ss.pauseTime
    }
    actualStudyTime -= (ss.totalPauseTime || 0)
    ss.timeSpent = Math.max(0, actualStudyTime)

    const totalStudied = ss.studied.reduce((sum, count) => sum + count, 0)
    log.info('Study session ended:', {
      sessionId: ss.id,
      totalCardsStudied: totalStudied,
      failed: ss.failed,
      timeSpent: Math.round(ss.timeSpent / 1000) + 's',
      totalPauseTime: Math.round((ss.totalPauseTime || 0) / 1000) + 's',
      ratings: ss.ratings
    })

    // Update session store - complete session
    this.store.completeCurrentSession()
  }

  // Get session progress
  getProgress() {
    if (!this.store.currentSession) return null

    const ss = this.store.currentSession
    const elapsed = Date.now() - ss.startTime
    const totalStudied = ss.studied.reduce((sum, count) => sum + count, 0)
    // ratings 1-3 are correct (Again=0 is incorrect, Hard/Good/Easy=1-3 are correct)
    const correctAnswers = ss.ratings.slice(1).reduce((sum, count) => sum + count, 0)

    return {
      cardsStudied: totalStudied,
      cardsRemaining:
        (ss.deckNew?.length || 0) +
        (ss.deckReview?.length || 0) +
        (ss.currentCard ? 1 : 0),
      timeElapsed: elapsed,
      correctAnswers,
      accuracy: totalStudied ? correctAnswers / totalStudied : 0,
      ratings: { ...ss.ratings }
    }
  }

  // Undo last step using action log
  async undo() {
    const ss = this.store.currentSession
    if (!ss || !Array.isArray(ss.actionLog) || ss.actionLog.length === 0) return null

    // If the last action was a draw, revert it first
    const last = ss.actionLog.pop()
    let rateAction = last
    if (last.t === 'draw') {
      // return currentCard to its source deck front
      const cur = ss.currentCard
      if (cur && last.id === cur.id) {
        if (last.from === 'new') ss.deckNew.unshift(cur)
        else if (last.from === 'review') ss.deckReview.unshift(cur)
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
    if (rateAction.to === 'done') removeById(ss.deckDone, rateAction.id)
    else if (rateAction.to === 'new') removeById(ss.deckNew, rateAction.id)
    else if (rateAction.to === 'review') removeById(ss.deckReview, rateAction.id)

    // Restore FSRS in DB and set as current
    await db.cards.update(rateAction.id, { fsrs: { ...rateAction.prev } })
    const card = await db.cards.get(rateAction.id)
    ss.currentCard = card
    ss.currentCard._from = rateAction.from

    // Revert stats
    if (rateAction.rating !== Rating.Again) {
      const idx = typeof rateAction.prev.state === 'number' ? rateAction.prev.state : 0
      ss.studied[idx] = Math.max(0, (ss.studied[idx] || 0) - 1)
    } else {
      ss.failed = Math.max(0, (ss.failed || 0) - 1)
    }
    ss.ratings[rateAction.rating] = Math.max(0, (ss.ratings[rateAction.rating] || 0) - 1)

    return ss.currentCard
  }
}

log.debug('Study engine initialized')
