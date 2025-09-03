import { FSRS, Rating, State, createEmptyCard } from 'ts-fsrs'
import { idb } from '../storage/storageManager.js'
import { log } from '../../../utils/logger'
import { genId } from '../../../utils/idGenerator.js'
import ankiApi from '../core/ankiApi.js'
import { getStudyDayKey } from '../storage/useSessionStore.js'

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
        queueRemaining: this.session.queue.length,
        buriedCount: Object.keys(this.session.buried || {}).length
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
        buried: {}, // cardId -> true (object operations)

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
        newCards: this.sessionStore.getState().preferences.buryNewSiblings,
        reviewCards: this.sessionStore.getState().preferences.buryReviewSiblings,
        note: 'Sibling burying applied dynamically during study (learning cards treated as review)'
      }
    })

    return this.session
  }

  // Build optimal study queue using FSRS (NO sibling filtering at build time)
  async buildStudyQueue() {
    // Get all cards for this shard's decks
    const cards = await ankiApi.getCardsForDecks(this.deckIds)
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
    const queue = [
      ...dueCards.slice(0, this.sessionStore.getState().studySettings.maxReviewCards),
      ...sortedNewCards.slice(0, this.sessionStore.getState().studySettings.maxNewCards)
    ]

    return queue
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
  async burySiblings(answeredCard) {
    const preferences = this.sessionStore.getState().preferences

    // Check if burying is enabled for this card type
    const cardState = answeredCard.fsrsCard?.state || STATES.NEW
    const shouldBury = cardState === STATES.NEW
      ? preferences.buryNewSiblings
      : preferences.buryReviewSiblings

    if (!shouldBury) {
      return // No burying enabled
    }

    // Get ALL cards for this note from stable source (not the modified queue)
    const allCards = await ankiApi.getCardsForDecks(this.deckIds)
    const siblings = allCards.filter(c =>
      c.noteId === answeredCard.noteId && c.id !== answeredCard.id
    )

    // Bury using object operations
    siblings.forEach(card => {
      this.session.buried[card.id] = true
    })

    // Persist session immediately for real-time updates
    this.sessionStore.getState().setCurrentSession(this.session)

    log.debug('Buried siblings:', {
      answeredCard: answeredCard.id,
      noteId: answeredCard.noteId,
      buriedCount: siblings.length,
      totalBuried: Object.keys(this.session.buried).length
    })
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
    while (this.session.queue.length > 0) {
      const card = this.session.queue.shift()

      // Skip buried cards using object operations
      if (this.session.buried[card.id]) {
        continue
      }

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

    // Bury sibling cards after answering (Anki behavior)
    await this.burySiblings(this.session.currentCard)

    this.session.currentCard = null
    return updatedCard
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

  // Get session progress with detailed breakdown
  getProgress() {
    if (!this.session) return null

    const elapsed = Date.now() - this.session.startTime
    const remaining = Math.max(0, this.session.maxTime - elapsed)
    const cardsRemaining = this.session.queue.length
    const totalStudied = this.session.newCardsStudied + this.session.reviewCardsStudied

    return {
      // Detailed card progress (for resumption)
      totalCardsStudied: totalStudied, // Calculated on-demand
      newCardsStudied: this.session.newCardsStudied,
      reviewCardsStudied: this.session.reviewCardsStudied,
      cardsRemaining,

      // Timing
      timeElapsed: elapsed,
      timeRemaining: remaining,

      // Quality metrics
      correctAnswers: this.session.correctAnswers,
      accuracy: totalStudied > 0
        ? this.session.correctAnswers / totalStudied
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
