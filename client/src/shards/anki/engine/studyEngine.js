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
// Helper: compute next daily reset timestamp based on settings hour
const nextDailyResetAt = (resetHour = 4) => {
  const hour = Math.max(0, Math.min(23, resetHour || 0))
  const now = new Date()
  const reset = new Date(now)
  reset.setHours(hour, 0, 0, 0)
  if (now >= reset) reset.setDate(reset.getDate() + 1)
  return reset.getTime()
}

// Helper: insert a card back into queue ordered by fsrs.due (ascending),
// placing items without fsrs at the end
const insertByDue = (queue, card) => {
  const dueTs = card?.fsrs?.due?.getTime ? card.fsrs.due.getTime() : card?.fsrs?.due
  if (!Number.isFinite(dueTs)) {
    queue.push(card)
    return
  }
  let i = 0
  for (; i < queue.length; i++) {
    const qDue = queue[i]?.fsrs?.due?.getTime ? queue[i].fsrs.due.getTime() : queue[i]?.fsrs?.due
    if (!Number.isFinite(qDue) || qDue > dueTs) break
  }
  queue.splice(i, 0, card)
}

// Study Engine class
export class StudyEngine {
  constructor(shardId, deckIds, sessionStore) {
    this.shardId = shardId
    this.deckIds = deckIds
    this.store = sessionStore.getState()
    this.session = null // Will be initialized in initSession()
  }

  // Initialize study session with proper session management
  async initSession() {
    const settings = this.store
    const studyDay = getSessionDate(settings.dailyResetTime)
    let ss = this.session

    if (!settings.currentSession && studyDay === settings.lastSessionDate) {
      return null // today finished
    }

    if (settings.currentSession) {
      // Resume existing session
      ss = this.session = settings.currentSession

      log.info('Resuming session:', {
        sessionId: ss.id,
        newStudied: ss.newCardsStudied || 0,
        reviewStudied: ss.reviewCardsStudied || 0,
        queueRemaining: ss.queue.length
      })
    } else {
      // Create new session
      ss = this.session = {
        id: await genId('session', Date.now().toString()),
        shardId: this.shardId,
        deckIds: this.deckIds,

        // Session State (for resumption)
        currentCard: null,
        queue: [], // Will be built below

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

      // Build queue asynchronously after session object is created
      ss.queue = await this.buildQueue()
    }

    // Set session in store for persistence
    settings.setCurrentSession(ss)

    log.info('Study session initialized:', {
      shardId: this.shardId,
      deckIds: this.deckIds,
      queueSize: ss.queue.length,
      sessionId: ss.id,
      siblingBurying: settings.autoBurySiblings
    })

    return ss
  }

  // Build study queue with FSRS + sibling filtering
  async buildQueue() {
    const now = Date.now()
    const settings = this.store
    const { maxReviewCards, maxNewCards } = settings

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
      switch (settings.newCardOrder) {
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
    if (settings.autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // FIXED: apply settings.newReviewOrder (basic: reviews-first/new-first/mixed)
    const clampDue = dueCards.slice(0, maxReviewCards)
    const clampNew = newCards.slice(0, maxNewCards)
    switch (settings.newReviewOrder) {
    case 'new-first':
      return [...clampNew, ...clampDue]
    case 'review-first':
      return [...clampDue, ...clampNew]
    case 'mixed': {
      // FIXED: shuffle new into the due, keeping due relative order
      if (clampDue.length === 0) return _.shuffle(clampNew)
      const out = [...clampDue]
      const shuffledNew = _.shuffle(clampNew)
      for (const n of shuffledNew) {
        const idx = Math.floor(Math.random() * (out.length + 1))
        out.splice(idx, 0, n)
      }
      return out
    }
    default:
      return [...clampDue, ...clampNew]
    }
  }

  // Get next card for study
  getNext() {
    const next = this.session.queue.shift()
    // FIXED: keep single source of truth for the current card in engine
    this.session.currentCard = next || null
    return next // No more cards available
  }

  // Rate current card and update scheduling
  async rate(rating) {
    const ss = this.session
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

    // Save progress
    await db.cards.update(c0.id, { fsrs: { ...next.card } })

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
    // FIXED: write full timing and counters only per-rating (no start/end writes)
    this.store.updateSessionHistory({
      startTime: ss.startTime,
      timeSpent: ss.timeSpent,
      pauseTime: ss.pauseTime,
      totalPauseTime: ss.totalPauseTime,
      studied: [...ss.studied],
      failed: ss.failed,
      ratings: [...ss.ratings]
    })

    // FIXED: requeue Again cards due before next reset
    const nextReset = nextDailyResetAt(this.store.dailyResetTime)
    const dueTs = next.card.due.getTime()
    if (rating === Rating.Again && dueTs <= nextReset) {
      const updatedCard = { ...c0, fsrs: { ...next.card } }
      insertByDue(ss.queue, updatedCard)
    }

    // FIXME: fix the log
    log.debug('Card rated:', {
      // FIXED: include real card id
      cardId: c0.id,
      rating
    })

    // FIXME: if the rate is Again, don't we need to put in the queue
    // and re-sort the queue with new due?
    // FIXED: handled above by insertByDue until next reset
    ss.currentCard = null
  }

  // End study session
  endSession() {
    if (!this.session) return

    const ss = this.session
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
    if (!this.session) return null

    const ss = this.session
    const elapsed = Date.now() - ss.startTime
    const totalStudied = ss.studied.reduce((sum, count) => sum + count, 0)
    // ratings 1-3 are correct (Again=0 is incorrect, Hard/Good/Easy=1-3 are correct)
    const correctAnswers = ss.ratings.slice(1).reduce((sum, count) => sum + count, 0)

    return {
      cardsStudied: totalStudied,
      cardsRemaining: ss.queue.length,
      timeElapsed: elapsed,
      correctAnswers,
      accuracy: totalStudied ? correctAnswers / totalStudied : 0,
      ratings: { ...ss.ratings }
    }
  }
}

log.debug('Study engine initialized')
