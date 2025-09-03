import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import { idb } from '../storage/storageManager.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import ankiApi from '../core/ankiApi.js'
import { getStudyDayKey } from '../storage/useSessionStore.js'
import _ from 'lodash'

// Study engine with FSRS integration
// Manages card scheduling, progress tracking, and study sessions

// FSRS instance with default parameters
const fsrs = new FSRS()

// Rating mappings
export const RATINGS = {
  AGAIN: Rating.Again,   // 1 - Forgot/wrong
  HARD: Rating.Hard,     // 2 - Correct but difficult
  GOOD: Rating.Good,     // 3 - Correct with effort
  EASY: Rating.Easy      // 4 - Correct and easy
}

// Learning states
export const STATES = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning
}

// Create new card for FSRS
const createFSRSCard = (_cardId) => {
  const card = createEmptyCard(new Date())
  card.stability = 0
  card.difficulty = 0
  card.elapsed_days = 0
  card.scheduled_days = 0
  card.reps = 0
  card.lapses = 0
  card.state = STATES.NEW
  card.last_review = new Date()
  return card
}

// Convert progress data to FSRS card
const progressToCard = (progress) => {
  if (!progress) return createFSRSCard()

  const card = createEmptyCard(new Date(progress.due))
  card.due = new Date(progress.due)
  card.stability = progress.stability || 0
  card.difficulty = progress.difficulty || 0
  card.elapsed_days = progress.elapsed_days || 0
  card.scheduled_days = progress.scheduled_days || 0
  card.reps = progress.reps || 0
  card.lapses = progress.lapses || 0
  card.state = progress.state || STATES.NEW
  card.last_review = progress.last_review ? new Date(progress.last_review) : new Date()
  return card
}

// Convert FSRS card to progress data
const cardToProgress = (card) => ({
  due: card.due.getTime(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  last_review: card.last_review.getTime()
})

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
    const studyDay = getStudyDayKey(state.studySettings.dailyResetTime)

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
        maxTime: state.studySettings.maxTime,

        // Study progress (for resumption)
        newCardsStudied: 0,
        reviewCardsStudied: 0,
        correctAnswers: 0, // Cards answered correctly (Hard/Good/Easy)

        // Session State (for resumption)
        currentCard: null,
        queue: [], // Will be built below

        // Timing (for resumption)
        timeSpent: 0,
        pauseTime: null,
        totalPauseTime: 0,

        // Statistics
        ratings: { again: 0, hard: 0, good: 0, easy: 0 }
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
      options: this.sessionStore.getState().studySettings,
      siblingBurying: {
        enabled: this.sessionStore.getState().preferences.autoBurySiblings,
        note: 'Sibling filtering applied during queue building'
      }
    })

    return this.session
  }

  // Build study queue with FSRS + sibling filtering
  async buildStudyQueue() {
    const cards = await ankiApi.getCardsForDecks(this.deckIds)
    const now = new Date()
    let dueCards = []
    let newCards = []

    cards.forEach(c => {
      const fsrsCard = progressToCard(c.fsrs)
      if (!c.fsrs || fsrsCard.state === STATES.NEW) {
        newCards.push({ ...c, fsrsCard })
      } else if (fsrsCard.due <= now) {
        dueCards.push({ ...c, fsrsCard, priority: this.getCardPriority(fsrsCard) })
      }
    })

    dueCards = _.orderBy(dueCards, 'priority', 'desc')
    newCards = this.sortNewCards(newCards)

    if (this.sessionStore.getState().preferences.autoBurySiblings) {
      dueCards = _.uniqBy(dueCards, 'noteId')
      newCards = _.uniqBy(newCards, 'noteId')
    }

    const { maxReviewCards, maxNewCards } = this.sessionStore.getState().studySettings
    return [...dueCards.slice(0, maxReviewCards), ...newCards.slice(0, maxNewCards)]
  }

  // Sort new cards according to user preference
  sortNewCards(cards) {
    const order = this.sessionStore.getState().preferences.newCardOrder

    switch (order) {
    case 'gather': return cards
    case 'template': return _.sortBy(cards, 'templateIdx')
    case 'random': return _.shuffle(cards)
    case 'template-random':
      return _(cards).sortBy('templateIdx').groupBy('templateIdx').values().map(_.shuffle).flatten().value()
    case 'note-random':
      return _(cards).groupBy('noteId').values().map(g => _.sortBy(g, 'templateIdx')).shuffle().flatten().value()
    default: return cards
    }
  }



  // Calculate card priority for studying
  getCardPriority(fsrsCard) {
    const now = new Date()
    const overdueDays = Math.max(0, (now - fsrsCard.due) / (24 * 60 * 60 * 1000))
    const difficultyBonus = fsrsCard.difficulty * 0.1
    const stateBonus = fsrsCard.state === STATES.RELEARNING ? 2 : 0

    return overdueDays + difficultyBonus + stateBonus
  }

  // Get next card for study
  getNextCard() {
    const now = new Date()
    if (now - this.session.startTime >= this.session.maxTime) return null

    // Get next card from queue (siblings already filtered during queue building)
    if (this.session.queue.length > 0) {
      const card = this.session.queue.shift()
      this.session.currentCard = card
      return this.session.currentCard
    }

    return null // No more cards available
  }

  // Rate current card and update scheduling
  async rateCard(rating) {
    if (!this.session.currentCard || !this.session) {
      throw new Error('No active card or session')
    }

    const { id } = this.session.currentCard
    const fsrsCard = this.session.currentCard.fsrsCard

    // Process rating with FSRS
    const schedulingCards = fsrs.repeat(fsrsCard, new Date())
    const updatedCard = schedulingCards[rating]

    // Save progress
    const progress = cardToProgress(updatedCard.card)
    const existing = await idb.get('cards', id)
    if (existing) {
      const updated = { ...existing, fsrs: progress, due: updatedCard.card.due.getTime() }
      await idb.put('cards', updated)
    }

    // Update session stats
    const isNewCard = !this.session.currentCard.fsrs ||
      this.session.currentCard.fsrsCard.state === STATES.NEW
    if (isNewCard) {
      this.session.newCardsStudied++
    } else {
      this.session.reviewCardsStudied++
    }

    // Update rating distribution
    const ratingNames = ['again', 'hard', 'good', 'easy']
    if (rating >= 1 && rating <= 4) {
      this.session.ratings[ratingNames[rating - 1]]++
    }

    // Count correct answers (Hard, Good, Easy are all "correct")
    if (rating >= 2) {
      this.session.correctAnswers++
    }

    // Update time spent
    this.session.timeSpent = Date.now() - this.session.startTime

    // Real-time session history update
    this.sessionStore.getState().updateSessionHistory(null, {
      newCards: this.session.newCardsStudied,
      reviewCards: this.session.reviewCardsStudied,
      timeSpent: this.session.timeSpent
    })

    log.debug('Card rated:', {
      cardId: id,
      rating,
      nextDue: updatedCard.card.due,
      state: updatedCard.card.state,
      isNewCard,
      newStudied: this.session.newCardsStudied,
      reviewStudied: this.session.reviewCardsStudied
    })

    this.session.currentCard = null
    return updatedCard
  }



  // Get cards due for review
  getDueCards(cards) {
    const now = new Date()
    return cards
      .map(c => {
        if (!c.fsrs) return { ...c, type: 'new', due: now }
        const fsrsCard = progressToCard(c.fsrs)
        return fsrsCard.due <= now ? { ...c, type: 'review', due: fsrsCard.due, state: fsrsCard.state } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.due - b.due)
  }

  // Get study statistics for deck
  getStudyStats(cards) {
    const now = new Date()
    const stats = { new: 0, learning: 0, review: 0, due: 0 }

    cards.forEach(c => {
      if (!c.fsrs) {
        stats.new++
      } else {
        const fsrsCard = progressToCard(c.fsrs)
        if (fsrsCard.state === STATES.NEW) stats.new++
        else if ([STATES.LEARNING, STATES.RELEARNING].includes(fsrsCard.state)) {
          stats.learning++
          if (fsrsCard.due <= now) stats.due++
        } else if (fsrsCard.state === STATES.REVIEW) {
          stats.review++
          if (fsrsCard.due <= now) stats.due++
        }
      }
    })

    return { total: cards.length, ...stats }
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

      // Final session history update
      this.sessionStore.getState().updateSessionHistory(null, {
        newCards: this.session.newCardsStudied,
        reviewCards: this.session.reviewCardsStudied,
        timeSpent: this.session.timeSpent
      })

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
      timeRemaining: Math.max(0, this.session.maxTime - elapsed),
      correctAnswers: this.session.correctAnswers,
      accuracy: totalStudied ? this.session.correctAnswers / totalStudied : 0,
      ratings: { ...this.session.ratings }
    }
  }
}

// Utility functions
export const formatInterval = (days) => {
  if (days < 1) {
    const minutes = Math.round(days * 24 * 60)
    return minutes < 60 ? `${minutes}m` : `${Math.round(minutes / 60)}h`
  } else if (days < 30) {
    return `${Math.round(days)}d`
  } else if (days < 365) {
    return `${Math.round(days / 30)}mo`
  } else {
    return `${Math.round(days / 365)}y`
  }
}

export const getRatingLabel = (rating) => {
  const labels = {
    [RATINGS.AGAIN]: 'Again',
    [RATINGS.HARD]: 'Hard',
    [RATINGS.GOOD]: 'Good',
    [RATINGS.EASY]: 'Easy'
  }
  return labels[rating] || 'Unknown'
}

log.debug('Study engine initialized')
