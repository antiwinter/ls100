import { proxy, subscribe, snapshot } from 'valtio'
import { log } from '../../../utils/logger.js'

const stores = new Map()

export const AnkiSessionStore = (shardId) => {
  if (!shardId) throw new Error('shardId is required for AnkiSessionStore')
  if (stores.has(shardId)) return stores.get(shardId)

  const state = proxy({
    // Preferences / persistent options
    // These values are persisted and configure how a study day behaves.
    // They mirror the previous Zustand store for compatibility with the UI.
    bundleIds: [],
    maxNewCards: 18,      // Maximum new cards to study per day
    maxReviewCards: 188,  // Maximum review cards to study per day
    dailyResetTime: 4,    // Hour (0AM-6AM) when daily limits reset
    // New cards only graduate out of current session when next due is beyond this gap
    initialGap: 10,       // minutes
    // Display
    showAnswer: false,    // Auto-show answer after question (accessibility)
    autoReveal: false,    // Automatically reveal answer after delay
    // Study Flow
    newReviewOrder: 'mixed',  // 'mixed' | 'new-first' | 'review-first'
    // New card ordering
    newCardOrder: 'gather',   // 'gather' | 'random' | 'template-random'
    // Anki behavior
    autoBurySiblings: true,   // Hide sibling cards from same note during queue building

    // Session state
    // These values represent the in-progress session and are mutated freely
    // by the study engine. They are persisted so a session can be resumed.
    history: {},
    day: null,                    // Numeric day id; session active when not null
    currentCard: null,            // Currently shown card object
    pile: { raw: [], review: [], done: [] }, // Tri-queues for study
    actionLog: [],                // Stack of draw actions for undo
    timeSegments: [],             // [{start, end}] time tracking segments

    // Merge preference updates (used by settings UI)
    setPreferences(pref) {
      Object.assign(this, pref || {})
    },

    // Compute current day number with timezone and daily reset adjustment
    getCurrentDay() {
      const now = Date.now() / (60 * 1000)
      const resetOffs = (this.dailyResetTime || 0) * 60
      const tzOffs = new Date().getTimezoneOffset()
      const delta = now - resetOffs + tzOffs
      return Math.floor(delta / (60 * 24))
    },

    // Start a new (or resume existing) session for today
    start() {
      const today = this.getCurrentDay()
      if (this.day && this.day !== today) {
        this.updateHistory()
        log.info('New day, cleanup history', this.day)
      }
      if (this.day === today) {
        log.info('Same day, resume session', this.day)
        return
      }
      log.info('New session', this.day)
      this.day = today
      this.currentCard = null
      this.pile = { raw: [], review: [], done: [] }
      this.actionLog = []
      this.timeTracking = null
      return true
    },

    // Check if current session is finished (no more cards to study)
    isFinished() {
      return (this.pile?.raw?.length || 0) === 0 &&
             (this.pile?.review?.length || 0) === 0 &&
             !this.currentCard
    },

    // Finish current session; compact stats into history
    finish() {
      if (this.day) this.updateHistory()
    },

    // Compact the finished session into history (per-day aggregate)
    updateHistory() {
      if (!this.day) return
      const res = { raw: 0, learning: 0, review: 0, relearning: 0 }
      this.pile.done.forEach(card => {
        res[card.state?.toLowerCase() || 'raw']++
      })

      const totalCards = this.pile.raw.length + this.pile.review.length + this.pile.done.length
      this.history[this.day] = {
        ...res,
        ...this.timeTracking,
        completion: Math.round(this.pile.done.length / (totalCards + 0.01))
      }
    }
  })

  const storageKey = `ls100-anki-session-${shardId}`

  // Hydrate from storage
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const saved = JSON.parse(raw)
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(k => {
          if (typeof state[k] !== 'function') state[k] = saved[k]
        })
      }
    }
  } catch {
    // ignore hydration errors
  }

  // Persist on changes (serialize only plain data, exclude methods)
  subscribe(state, () => {
    try {
      const snap = snapshot(state)
      // Omit methods before persisting
      const {
        setPreferences: _1,
        getCurrentDay: _2,
        start: _3,
        isFinished: _4,
        finish: _5,
        updateHistory: _6,
        updateTimeSegments: _7,
        ...plain
      } = snap
      localStorage.setItem(storageKey, JSON.stringify(plain))
    } catch {
      // ignore persist errors
    }
  })

  stores.set(shardId, state)
  return state
}
