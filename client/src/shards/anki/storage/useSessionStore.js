import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

const stores = new Map()

export const useAnkiSessionStore = (shardId) => {
  if (!shardId) {
    throw new Error('shardId is required for useAnkiSessionStore')
  }

  if (stores.has(shardId)) {
    return stores.get(shardId)
  }

  const store = create(
    persist(
      immer((set, get) => ({
        // === Daily Study Limits (persistent) ===
        maxNewCards: 18, // Maximum new cards to study per day
        maxReviewCards: 188, // Maximum review cards to study per day
        dailyResetTime: 4, // Hour (0AM-6AM) when daily limits reset
        // (4 AM default prevents midnight interruptions for night owls)

        // === Study Limits Setters ===
        setMaxNewCards: (count) => set((state) => {
          state.maxNewCards = count
        }),
        setMaxReviewCards: (count) => set((state) => {
          state.maxReviewCards = count
        }),
        setDailyResetTime: (hour) => set((state) => {
          state.dailyResetTime = Math.max(0, Math.min(6, hour))
        }),

        // === Initial gap for new cards graduation (minutes) ===
        // New cards only graduate out of current session when next due is beyond this gap
        initialGap: 10,
        setInitialGap: (minutes) => set((state) => {
          const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 10
          state.initialGap = m
        }),

        // Study preferences (persistent)

        // === Display Settings ===
        showAnswer: false, // Auto-show answer after question (for accessibility)
        autoReveal: false, // Automatically reveal answer after delay

        // === Study Flow ===
        newReviewOrder: 'mixed', // How to mix new and review cards
        // Options: 'mixed' (reviews first, then new), 'new-first' (new cards priority),
        // 'review-first' (reviews only)

        // === New Card Ordering ===
        newCardOrder: 'gather', // How new cards are ordered before study
        // Options:
        // - 'gather': Keep import/creation order (fastest)
        // - 'random': Completely randomize all new cards

        // === Sibling Burying (Anki behavior) ===
        autoBurySiblings: true, // Hide sibling cards from same note during queue building
        // Note: Prevents seeing "front->back" and "back->front" in same session

        // === Preference Setters (for Settings UI) ===
        setShowAnswer: (show) => set((state) => {
          state.showAnswer = show
        }),
        setAutoReveal: (auto) => set((state) => {
          state.autoReveal = auto
        }),
        setStudyMode: (mode) => set((state) => {
          // 'mixed' | 'new-first' | 'review-first'
          state.studyMode = mode
        }),
        setNewCardOrder: (order) => set((state) => {
          // 'gather' | 'random' | 'template-random'
          state.newCardOrder = order
        }),
        setAutoBurySiblings: (bury) => set((state) => {
          state.autoBurySiblings = bury
        }),

        // === Session State Management (persistent) ===
        currentSession: null, // Active or paused session data
        lastSessionDate: null, // Last date a session was started (YYYY-MM-DD)
        // Note: sessionActive can be inferred as sessionState === 'active'
        sessionHistory: {},// { "2025-01-11": { newCards: 5, reviewCards: 12, timeSpent: 1200000 } }

        // Format: { [YYYY-MM-DD]: { newCards: number, reviewCards: number, timeSpent: ms } }
        updateSessionHistory: (stats) => set((state) => {
          const dateKey = get().getCurrentDay()
          state.sessionHistory[dateKey] = { ...state.sessionHistory[dateKey], ...stats }
        }),

        // Session management actions
        setCurrentSession: (session) => set((state) => {
          state.currentSession = session
          if (session) {
            state.lastSessionDate = get().getCurrentDay()
          }
        }),

        getCurrentDay: () => get(x => {
          const now = Date.now() / 60 / 1000 // in minutes
          const resetOffs = x.dailyResetTime * 60
          const tzOffs = new Date().getTimezoneOffset() // TZ offset in minutes

          // Adjust for timezone and daily reset time
          const delta = now - resetOffs + tzOffs

          // Calculate days since epoch (1970/1/1)
          return Math.floor(delta / 60 / 24)
        }),

        completeCurrentSession: () => set((state) => {
          state.currentSession = null
        })
      })),
      {
        name: `ls100-anki-session-${shardId}`,
        partialize: (state) => {
          // Persist everything including currentSession for resumption
          return state
        }
      }
    )
  )

  stores.set(shardId, store)
  return store
}

// Cleanup function to remove store when shard is no longer needed
export const cleanupAnkiSessionStore = (shardId) => {
  stores.delete(shardId)
}
