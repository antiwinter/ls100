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
        studySettings: {
          maxNewCards: 20, // Maximum new cards to study per day
          maxReviewCards: 200, // Maximum review cards to study per day
          maxTime: 30 * 60 * 1000 // Maximum study time per session (30 minutes in ms)
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

        // === Daily Statistics (persistent, date-keyed) ===
        dailyStats: {}, // { "2025-01-11": { newCards: 5, reviewCards: 12, timeSpent: 1200000 } }
        // Format: { [YYYY-MM-DD]: { newCards: number, reviewCards: number, timeSpent: ms } }
        updateDailyStats: (date, stats) => set((state) => {
          const dateKey = date || new Date().toISOString().split('T')[0]
          state.dailyStats[dateKey] = { ...state.dailyStats[dateKey], ...stats }
        }),
        getDailyStats: (date) => {
          const dateKey = date || new Date().toISOString().split('T')[0]
          return get().dailyStats[dateKey] || { newCards: 0, reviewCards: 0, timeSpent: 0 }
        },

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
          buryNewSiblings: true, // Hide other new cards from same note until next session
          buryReviewSiblings: true // Hide other review cards from same note until next session
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
        setBuryNewSiblings: (bury) => set((state) => {
          state.preferences.buryNewSiblings = bury
        }),
        setBuryReviewSiblings: (bury) => set((state) => {
          state.preferences.buryReviewSiblings = bury
        }),

        // === Session State Management (persistent) ===
        currentSession: null, // Active or paused session data
        lastSessionDate: null, // Last date a session was started (YYYY-MM-DD)
        // Note: sessionActive can be inferred as sessionState === 'active'
        sessionHistory: [],

        // Session management actions
        setCurrentSession: (session) => set((state) => {
          state.currentSession = session
          if (session) {
            state.lastSessionDate = new Date().toISOString().split('T')[0]
          }
        }),

        completeCurrentSession: () => set((state) => {
          state.currentSession = null
          // TODO: summary session into history
        }),

        // Clear all data (for testing/reset)
        reset: () => set((state) => {
          state.dailyStats = {}
          state.studyStreak = { current: 0, longest: 0, lastStudyDate: null }
          state.currentSession = null
          state.sessionState = 'none'
          // Keep settings and preferences
        })
      })),
      {
        name: `ls100-anki-session-${shardId}`,
        partialize: (state) => {
          // Don't persist session state
          const { currentSession: _, ...persistedState } = state
          return persistedState
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

// Helper to get today's date key
export const getTodayDateKey = () => {
  return new Date().toISOString().split('T')[0]
}
