import { FSRS, Rating, State } from 'ts-fsrs'
import db from '../storage/db.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import { getSessionDate } from '../storage/useSessionStore.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Study Engine class
export class StudyEngine {
  constructor(shardId, deckIds, sessionStore) {
    this.shardId = shardId
    this.deckIds = deckIds
    this.sessionStore = sessionStore
    this.session = null // Will be initialized in initSession()
  }

  // Initialize study session with proper session management
  async initSession() {
    const state = this.sessionStore.getState()
    const studyDay = getSessionDate(state.dailyResetTime)

    if (!state.currentSession && studyDay === state.lastSessionDate) {
      return null // today finished
    }

    if (state.currentSession) {
      // Resume existing session
      this.session = state.currentSession

      log.info('Resuming session:', {
        sessionId: this.session.id,
        newStudied: this.session.newCardsStudied || 0,
        reviewStudied: this.session.reviewCardsStudied || 0,
        queueRemaining: this.session.queue.length
      })
    } else {
      // Create new session
      this.session = {
        id: await genId('session', Date.now().toString()),
        shardId: this.shardId,
        deckIds: this.deckIds,
        startTime: Date.now(),

        // Session State (for resumption)
        currentCard: null,
        queue: [], // Will be built below

        // Timing (for resumption)
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
      this.session.queue = await this.buildStudyQueue()
    }

    // Set session in store for persistence
    this.sessionStore.getState().setCurrentSession(this.session)

    log.info('Study session initialized:', {
      shardId: this.shardId,
      deckIds: this.deckIds,
      queueSize: this.session.queue.length,
      sessionId: this.session.id,
      siblingBurying: this.sessionStore.getState().autoBurySiblings
    })

    return this.session
  }

  // Build study queue with FSRS + sibling filtering
  async buildQueue() {
    const now = Date.now()
    const settings = this.sessionStore.getState()
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
    if (this.sessionStore.getState().autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    // FIXME: apply settings.newReviewOrder
    return [...dueCards.slice(0, maxReviewCards), ...newCards.slice(0, maxNewCards)]
  }

  // Get next card for study
  getNext() {
    return this.session.queue.shift() // No more cards available
  }

  // Rate current card and update scheduling
  async rate(rating) {
    if (!this.session.currentCard || !this.session) {
      throw new Error('No active card or session')
    }

    const c0 = this.session.currentCard

    // Process rating with FSRS
    const schedulingCards = fsrs.repeat({ ...c0 }, new Date())
    const c1 = schedulingCards[rating]

    // Save progress
    await db.cards.update(c0.id, {
      ...c0,
      ...c1
    })

    // Update session stats
    if (rating > 0) {
      this.session.studied[c0.state]++
    } else
      this.session.failed++
    this.session.ratings[rating]++

    // Update time spent
    this.session.timeSpent = Date.now() - this.session.startTime

    // Real-time session history update
    this.sessionStore.getState().updateSessionHistory(/* update statistics */)

    // FIXME: fix the log
    log.debug('Card rated:', {
      cardId: 0,
      rating
    })

    // FIXME: if the rate is Again, don't we need to put in the queue
    // and re-sort the queue with new due?
    this.session.currentCard = null
  }

  // End study session
  endSession() {
    if (this.session) {
      this.session.endTime = Date.now()

      // Calculate actual study time (excluding pauses)
      let actualStudyTime = this.session.endTime - this.session.startTime
      if (this.session.pauseTime) {
        // Account for current pause if session is paused
        this.session.totalPauseTime += this.session.endTime - this.session.pauseTime
      }
      actualStudyTime -= (this.session.totalPauseTime || 0)
      this.session.timeSpent = Math.max(0, actualStudyTime)

      const totalStudied = this.session.newCardsStudied + this.session.reviewCardsStudied
      log.info('Study session ended:', {
        sessionId: this.session.id,
        newCardsStudied: this.session.newCardsStudied,
        reviewCardsStudied: this.session.reviewCardsStudied,
        totalCardsStudied: totalStudied,
        timeSpent: Math.round(this.session.timeSpent / 1000) + 's',
        totalPauseTime: Math.round((this.session.totalPauseTime || 0) / 1000) + 's',
        accuracy: totalStudied > 0 ? `${this.session.correctAnswers}/${totalStudied} (${Math.round(this.session.correctAnswers / totalStudied * 100)}%)` : '0%'
      })

      // Update session store - complete session
      this.sessionStore.getState().completeCurrentSession()
    }

    return null
  }

  // Get session progress
  getProgress() {
    if (!this.session) return null

    const elapsed = Date.now() - this.session.startTime
    const totalStudied = this.session.newCardsStudied + this.session.reviewCardsStudied

    return {
      totalCardsStudied: totalStudied,
      newCardsStudied: this.session.newCardsStudied,
      reviewCardsStudied: this.session.reviewCardsStudied,
      cardsRemaining: this.session.queue.length,
      timeElapsed: elapsed,
      correctAnswers: this.session.correctAnswers,
      accuracy: totalStudied ? this.session.correctAnswers / totalStudied : 0,
      ratings: { ...this.session.ratings }
    }
  }
}

log.debug('Study engine initialized')
