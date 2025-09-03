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
      immer((set, _get) => ({
        // === Daily Study Limits (persistent) ===
        studySettings: {
          maxNewCards: 20, // Maximum new cards to study per day
          maxReviewCards: 200, // Maximum review cards to study per day
          maxTime: 30 * 60 * 1000, // Maximum study time per session (30 minutes in ms)
          dailyResetTime: 4 // Hour (0AM-6AM) when daily limits reset
          // (4 AM default prevents midnight interruptions for night owls)
        },
        setStudySettings: (settings) => set((state) => {
          state.studySettings = { ...state.studySettings, ...settings }
        }),
        // === Study Limits Setters ===
        setMaxNewCards: (count) => set((state) => {
          state.studySettings.maxNewCards = count
        }),
        setMaxReviewCards: (count) => set((state) => {
          state.studySettings.maxReviewCards = count
        }),
        setMaxTime: (timeMs) => set((state) => {
          state.studySettings.maxTime = timeMs
        }),
        setDailyResetTime: (hour) => set((state) => {
          state.studySettings.dailyResetTime = Math.max(0, Math.min(23, hour))
        }),

        // Study preferences (persistent)
        preferences: {
          // === Display Settings ===
          showAnswer: false, // Auto-show answer after question (for accessibility)
          autoReveal: false, // Automatically reveal answer after delay

          // === Study Flow ===
          studyMode: 'mixed', // How to mix new and review cards
          // Options: 'mixed' (reviews first, then new), 'new-first' (new cards priority),
          // 'review-first' (reviews only)

          // === New Card Ordering ===
          newCardOrder: 'gather', // How new cards are ordered before study
          // Options:
          // - 'gather': Keep import/creation order (fastest)
          // - 'template': Sort by card template/type (front→back, then back→front)
          // - 'random': Completely randomize all new cards
          // - 'template-random': Group by template, randomize within each template
          // - 'note-random': Randomize notes, keep template order within notes

          // === Sibling Burying (Anki behavior) ===
          autoBurySiblings: true // Hide sibling cards from same note during queue building
          // Note: Prevents seeing "front->back" and "back->front" in same session
        },
        setPreferences: (prefs) => set((state) => {
          state.preferences = { ...state.preferences, ...prefs }
        }),
        // === Preference Setters (for Settings UI) ===
        setShowAnswer: (show) => set((state) => {
          state.preferences.showAnswer = show
        }),
        setAutoReveal: (auto) => set((state) => {
          state.preferences.autoReveal = auto
        }),
        setStudyMode: (mode) => set((state) => {
          // 'mixed' | 'new-first' | 'review-first'
          state.preferences.studyMode = mode
        }),
        setNewCardOrder: (order) => set((state) => {
          // 'gather' | 'template' | 'random' | 'template-random' | 'note-random'
          state.preferences.newCardOrder = order
        }),
        setAutoBurySiblings: (bury) => set((state) => {
          state.preferences.autoBurySiblings = bury
        }),

        // === Session State Management (persistent) ===
        currentSession: null, // Active or paused session data
        lastSessionDate: null, // Last date a session was started (YYYY-MM-DD)
        // Note: sessionActive can be inferred as sessionState === 'active'
        sessionHistory: {},// { "2025-01-11": { newCards: 5, reviewCards: 12, timeSpent: 1200000 } }

        // Format: { [YYYY-MM-DD]: { newCards: number, reviewCards: number, timeSpent: ms } }
        updateSessionHistory: (stats) => set((state) => {
          const dateKey = getStudyDayKey(state.studySettings.dailyResetTime)
          state.sessionHistory[dateKey] = { ...state.sessionHistory[dateKey], ...stats }
        }),

        // Session management actions
        setCurrentSession: (session) => set((state) => {
          state.currentSession = session
          if (session) {
            state.lastSessionDate = getStudyDayKey(state.studySettings.dailyResetTime)
          }
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

// Helper to get study day date key (accounts for custom reset time)
export const getStudyDayKey = (resetHour = 4) => {
  const now = new Date()

  // If current time is before reset hour, use previous calendar day
  if (now.getHours() < resetHour) {
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    return yesterday.toISOString().split('T')[0]
  }

  // Otherwise use current calendar day
  return now.toISOString().split('T')[0]
}
