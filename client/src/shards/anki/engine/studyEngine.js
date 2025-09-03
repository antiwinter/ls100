import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import { idb } from '../storage/storageManager.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'

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
  constructor(shardId, sessionStore) {
    this.shardId = shardId
    this.sessionStore = sessionStore
    this.deckIds = [] // Will be populated from shard metadata
    this.session = null
    this.currentCard = null
    this.studyQueue = []
    this.buriedCards = new Set() // Track cards buried during session
  }

  // Initialize study session
  async initSession(cards, options = {}) {
    // Extract unique deck IDs from cards
    this.deckIds = [...new Set(cards.map(card => card.deckId).filter(Boolean))]

    // Get persistent settings from session store
    const persistentSettings = this.sessionStore.getState().studySettings
    const {
      maxNewCards = persistentSettings.maxNewCards,
      maxReviewCards = persistentSettings.maxReviewCards,
      maxTime = persistentSettings.maxTime
    } = options

    this.session = {
      id: await genId('session', Date.now().toString()),
      shardId: this.shardId,
      deckIds: this.deckIds,
      startTime: Date.now(),
      maxNewCards,
      maxReviewCards,
      maxTime,
      cardsStudied: 0,
      correctAnswers: 0,
      ratings: { again: 0, hard: 0, good: 0, easy: 0 },
      timeSpent: 0
    }

    // Build study queue
    this.buildStudyQueue(cards)

    const preferences = this.sessionStore.getState().preferences
    log.info('Study session initialized:', {
      shardId: this.shardId,
      deckIds: this.deckIds,
      queueSize: this.studyQueue.length,
      sessionId: this.session.id,
      siblingBurying: {
        newCards: preferences.buryNewSiblings,
        reviewCards: preferences.buryReviewSiblings,
        note: 'Sibling burying applied dynamically during study (learning cards treated as review)'
      }
    })

    return this.session
  }

  // Build optimal study queue using FSRS (NO sibling filtering at build time)
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

    // Sort new cards according to user preference
    const sortedNewCards = this.sortNewCards(newCards)

    // Include ALL available cards - sibling burying happens dynamically during study
    this.studyQueue = [
      ...dueCards.slice(0, this.session.maxReviewCards),
      ...sortedNewCards.slice(0, this.session.maxNewCards)
    ]
  }

  // Sort new cards according to user preference (Anki-style ordering)
  sortNewCards(newCards) {
    const preferences = this.sessionStore.getState().preferences
    const order = preferences.newCardOrder

    switch (order) {
    case 'gather':
      // Keep original order (no sorting)
      return newCards

    case 'template':
      // Sort by template index (card type)
      return newCards.sort((a, b) => a.templateIdx - b.templateIdx)

    case 'random':
      // Fully random shuffle
      return this.shuffleArray([...newCards])

    case 'template-random':
      // Sort by template, then randomize within templates
      return newCards
        .sort((a, b) => a.templateIdx - b.templateIdx)
        .sort((a, b) => {
          if (a.templateIdx === b.templateIdx) {
            return Math.random() - 0.5 // Random within same template
          }
          return 0 // Keep template order
        })

    case 'note-random': {
      // Group by note, randomize notes, keep template order within notes
      const noteGroups = new Map()

      // Group cards by noteId
      for (const card of newCards) {
        if (!noteGroups.has(card.noteId)) {
          noteGroups.set(card.noteId, [])
        }
        noteGroups.get(card.noteId).push(card)
      }

      // Sort cards within each note by template
      for (const cards of noteGroups.values()) {
        cards.sort((a, b) => a.templateIdx - b.templateIdx)
      }

      // Randomize note order and flatten
      const shuffledNotes = this.shuffleArray([...noteGroups.values()])
      return shuffledNotes.flat()
    }

    default:
      return newCards
    }
  }

  // Fisher-Yates shuffle algorithm
  shuffleArray(array) {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Bury sibling cards after answering (Anki behavior)
  burySiblings(answeredCard) {
    const preferences = this.sessionStore.getState().preferences

    // Check if burying is enabled for this card type
    const cardState = answeredCard.fsrsCard?.state || STATES.NEW
    const shouldBury = cardState === STATES.NEW
      ? preferences.buryNewSiblings
      : preferences.buryReviewSiblings

    if (!shouldBury) {
      return // No burying enabled
    }

    // Find and bury all sibling cards (same noteId, different cardId)
    let buriedCount = 0
    for (const card of this.studyQueue) {
      if (card.noteId === answeredCard.noteId && card.id !== answeredCard.id) {
        this.buriedCards.add(card.id)
        buriedCount++
      }
    }

    log.debug('Buried siblings:', {
      answeredCard: answeredCard.id,
      noteId: answeredCard.noteId,
      buriedCount
    })
  }

  // Update sibling burying preferences (for testing/configuration)
  updateSiblingBuryingPreferences(preferences) {
    this.sessionStore.getState().setPreferences(preferences)
    log.info('Updated sibling burying preferences:', preferences)
  }

  // Calculate card priority for studying
  getCardPriority(fsrsCard) {
    const now = new Date()
    const overdueDays = Math.max(0, (now - fsrsCard.due) / (24 * 60 * 60 * 1000))
    const difficultyBonus = fsrsCard.difficulty * 0.1
    const stateBonus = fsrsCard.state === STATES.RELEARNING ? 2 : 0

    return overdueDays + difficultyBonus + stateBonus
  }

  // Get next card for study (skip buried cards)
  getNextCard() {
    const now = new Date()
    if (now - this.session.startTime >= this.session.maxTime) return null

    // Find next non-buried card
    while (this.studyQueue.length > 0) {
      const card = this.studyQueue.shift()

      // Skip buried cards
      if (this.buriedCards.has(card.id)) {
        continue
      }

      this.currentCard = card
      return this.currentCard
    }

    return null // No more cards available
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

    // Bury sibling cards after answering (Anki behavior)
    this.burySiblings(this.currentCard)

    this.currentCard = null
    return updatedCard
  }

  // Update session statistics
  updateSessionStats(rating) {
    this.session.cardsStudied++
    this.session.timeSpent = Date.now() - this.session.startTime

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
      this.session.endTime = Date.now()
      this.session.timeSpent = this.session.endTime - this.session.startTime

      // Update daily stats and study streak
      this.updateDailyStats()

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
      this.buriedCards.clear() // Reset buried cards for next session

      return sessionData
    }

    return null
  }

  // Update daily statistics and study streak
  updateDailyStats() {
    if (!this.session) return

    const today = new Date().toISOString().split('T')[0]
    const sessionStore = this.sessionStore.getState()

    // Count new vs review cards
    let newCardsStudied = 0
    let reviewCardsStudied = 0

    // Note: We could track this during the session, but for now estimate
    // This is a simplification - ideally we'd track during rateCard()
    newCardsStudied = this.session.cardsStudied // Simplified for now
    reviewCardsStudied = 0

    // Update daily stats
    sessionStore.updateDailyStats(today, {
      newCards: newCardsStudied,
      reviewCards: reviewCardsStudied,
      timeSpent: this.session.timeSpent
    })

    // Update study streak if cards were studied
    if (this.session.cardsStudied > 0) {
      sessionStore.updateStudyStreak()
    }
  }

  // Get session progress
  getProgress() {
    if (!this.session) return null

    const elapsed = Date.now() - this.session.startTime
    const remaining = Math.max(0, this.session.maxTime - elapsed)
    const cardsRemaining = this.studyQueue.length

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
