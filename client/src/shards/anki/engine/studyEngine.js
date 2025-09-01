import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import { idb } from '../storage/storageManager.js'
import { log } from '../../../utils/logger'

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
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsed_days: card.elapsed_days,
  scheduled_days: card.scheduled_days,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  last_review: card.last_review.toISOString()
})

// Study Engine class
export class StudyEngine {
  constructor(deckId) {
    this.deckId = deckId
    this.session = null
    this.currentCard = null
    this.studyQueue = []
  }

  // Initialize study session
  initSession(cards, options = {}) {
    const { maxCards = 20, maxTime = 30 * 60 * 1000 } = options // 30 minutes default

    this.session = {
      id: `session_${Date.now()}`,
      deckId: this.deckId,
      startTime: new Date(),
      maxCards,
      maxTime,
      cardsStudied: 0,
      correctAnswers: 0,
      ratings: { again: 0, hard: 0, good: 0, easy: 0 },
      timeSpent: 0
    }

    // Build study queue
    this.buildStudyQueue(cards)

    log.info('Study session initialized:', {
      deckId: this.deckId,
      queueSize: this.studyQueue.length,
      sessionId: this.session.id
    })

    return this.session
  }

  // Build optimal study queue using FSRS
  buildStudyQueue(cards) {
    const now = new Date()
    const dueCards = []
    const newCards = []

    for (const c of cards) {
      const progress = c.fsrs
      const fsrsCard = progressToCard(progress)

      if (!progress || fsrsCard.state === STATES.NEW) {
        newCards.push({ ...c, fsrsCard })
      } else if (fsrsCard.due <= now) {
        dueCards.push({ ...c, fsrsCard, priority: this.getCardPriority(fsrsCard) })
      }
    }

    // Sort by priority (higher number = higher priority)
    dueCards.sort((a, b) => b.priority - a.priority)

    // Mix new and due cards (prefer due cards)
    this.studyQueue = [
      ...dueCards.slice(0, this.session.maxCards * 0.8),
      ...newCards.slice(0, this.session.maxCards * 0.2)
    ].slice(0, this.session.maxCards)
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
    if (this.studyQueue.length === 0) return null
    if (this.session.cardsStudied >= this.session.maxCards) return null

    const now = new Date()
    if (now - this.session.startTime >= this.session.maxTime) return null

    this.currentCard = this.studyQueue.shift()
    return this.currentCard
  }

  // Rate current card and update scheduling
  async rateCard(rating) {
    if (!this.currentCard || !this.session) {
      throw new Error('No active card or session')
    }

    const { id } = this.currentCard
    const fsrsCard = this.currentCard.fsrsCard

    // Process rating with FSRS
    const schedulingCards = fsrs.repeat(fsrsCard, new Date())
    const updatedCard = schedulingCards[rating]

    // Save progress
    const progress = cardToProgress(updatedCard.card)
    // persist on the card
    const existing = await idb.get('cards', id)
    if (existing) {
      const updated = { ...existing, fsrs: progress, due: updatedCard.card.due.getTime() }
      await idb.put('cards', updated)
    }

    // Update session stats
    this.updateSessionStats(rating)

    log.debug('Card rated:', {
      cardId: id,
      rating,
      nextDue: updatedCard.card.due,
      state: updatedCard.card.state
    })

    this.currentCard = null
    return updatedCard
  }

  // Update session statistics
  updateSessionStats(rating) {
    this.session.cardsStudied++
    this.session.timeSpent = Date.now() - this.session.startTime.getTime()

    // Count rating
    const ratingNames = ['again', 'hard', 'good', 'easy']
    if (rating >= 1 && rating <= 4) {
      this.session.ratings[ratingNames[rating - 1]]++
    }

    // Count correct answers (Good or Easy)
    if (rating >= 3) {
      this.session.correctAnswers++
    }
  }

  // Get cards due for review
  getDueCards(cards) {
    const now = new Date()
    const due = []

    for (const c of cards) {
      const progress = c.fsrs
      if (!progress) {
        due.push({ ...c, type: 'new', due: now })
      } else {
        const fsrsCard = progressToCard(progress)
        if (fsrsCard.due <= now) {
          due.push({ ...c, type: 'review', due: fsrsCard.due, state: fsrsCard.state })
        }
      }
    }

    return due.sort((a, b) => a.due - b.due)
  }

  // Get study statistics for deck
  getStudyStats(cards) {
    let newCards = 0
    let learningCards = 0
    let reviewCards = 0
    let dueCards = 0

    const now = new Date()

    for (const c of cards) {
      const progress = c.fsrs

      if (!progress) {
        newCards++
      } else {
        const fsrsCard = progressToCard(progress)

        switch (fsrsCard.state) {
        case STATES.NEW:
          newCards++
          break
        case STATES.LEARNING:
        case STATES.RELEARNING:
          learningCards++
          if (fsrsCard.due <= now) dueCards++
          break
        case STATES.REVIEW:
          reviewCards++
          if (fsrsCard.due <= now) dueCards++
          break
        }
      }
    }

    return {
      total: cards.length,
      new: newCards,
      learning: learningCards,
      review: reviewCards,
      due: dueCards
    }
  }

  // End study session
  endSession() {
    if (this.session) {
      this.session.endTime = new Date()
      this.session.timeSpent = this.session.endTime - this.session.startTime

      // Note: card progress persisted on each rating

      log.info('Study session ended:', {
        sessionId: this.session.id,
        cardsStudied: this.session.cardsStudied,
        timeSpent: Math.round(this.session.timeSpent / 1000) + 's',
        accuracy: this.session.cardsStudied > 0
          ? Math.round(this.session.correctAnswers / this.session.cardsStudied * 100) + '%'
          : '0%'
      })

      const sessionData = { ...this.session }
      this.session = null
      this.currentCard = null
      this.studyQueue = []

      return sessionData
    }

    return null
  }

  // Get session progress
  getProgress() {
    if (!this.session) return null

    const elapsed = Date.now() - this.session.startTime.getTime()
    const remaining = Math.max(0, this.session.maxTime - elapsed)
    const cardsRemaining = Math.max(0, this.session.maxCards - this.session.cardsStudied)

    return {
      cardsStudied: this.session.cardsStudied,
      cardsRemaining,
      timeElapsed: elapsed,
      timeRemaining: remaining,
      accuracy: this.session.cardsStudied > 0
        ? this.session.correctAnswers / this.session.cardsStudied
        : 0,
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
