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

        // Session state (non-persistent)
        currentSession: null,
        sessionActive: false,
        setCurrentSession: (session) => set((state) => {
          state.currentSession = session
          state.sessionActive = !!session
        }),
        endCurrentSession: () => set((state) => {
          state.currentSession = null
          state.sessionActive = false
        }),

        // === Study Streak Tracking (persistent) ===
        studyStreak: {
          current: 0, // Current consecutive days studied
          longest: 0, // Longest streak ever achieved
          lastStudyDate: null // Last date studied (YYYY-MM-DD format)
        },
        updateStudyStreak: () => set((state) => {
          const today = new Date().toISOString().split('T')[0]
          const lastDate = state.studyStreak.lastStudyDate

          if (lastDate === today) {
            // Already studied today, no change
            return
          }

          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]

          if (lastDate === yesterdayStr) {
            // Consecutive day, increment streak
            state.studyStreak.current += 1
            state.studyStreak.longest = Math.max(state.studyStreak.longest,
              state.studyStreak.current)
          } else {
            // Streak broken, restart
            state.studyStreak.current = 1
          }

          state.studyStreak.lastStudyDate = today
        }),
        resetStudyStreak: () => set((state) => {
          state.studyStreak.current = 0
          state.studyStreak.lastStudyDate = null
        }),

        // Helper functions
        getTodayProgress: () => {
          const today = new Date().toISOString().split('T')[0]
          const stats = get().dailyStats[today] || { newCards: 0, reviewCards: 0, timeSpent: 0 }
          const settings = get().studySettings

          return {
            newProgress: stats.newCards / settings.maxNewCards,
            reviewProgress: stats.reviewCards / settings.maxReviewCards,
            timeProgress: stats.timeSpent / settings.maxTime,
            newRemaining: Math.max(0, settings.maxNewCards - stats.newCards),
            reviewRemaining: Math.max(0, settings.maxReviewCards - stats.reviewCards),
            timeRemaining: Math.max(0, settings.maxTime - stats.timeSpent)
          }
        },

        // Clear all data (for testing/reset)
        reset: () => set((state) => {
          state.dailyStats = {}
          state.studyStreak = { current: 0, longest: 0, lastStudyDate: null }
          state.currentSession = null
          state.sessionActive = false
          // Keep settings and preferences
        })
      })),
      {
        name: `ls100-anki-session-${shardId}`,
        partialize: (state) => {
          // Don't persist session state
          const { currentSession: _, sessionActive: __, ...persistedState } = state
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
