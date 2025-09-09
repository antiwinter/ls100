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
        bundleIds: [], // these are set when shard created

        // Daily Study Limits (persistent)
        maxNewCards: 18, // Maximum new cards to study per day
        maxReviewCards: 188, // Maximum review cards to study per day
        dailyResetTime: 4, // Hour (0AM-6AM) when daily limits reset
        // (4 AM default prevents midnight interruptions for night owls)

        // Initial gap for new cards graduation (minutes)
        // New cards only graduate out of current session when next due is beyond this gap
        initialGap: 10,

        // Display Settings
        showAnswer: false, // Auto-show answer after question (for accessibility)
        autoReveal: false, // Automatically reveal answer after delay

        // Study Flow
        newReviewOrder: 'mixed', // How to mix new and review cards
        // Options: 'mixed' (reviews first, then new), 'new-first' (new cards priority),
        // 'review-first' (reviews only)

        //  New Card Ordering
        newCardOrder: 'gather', // How new cards are ordered before study
        // Options:
        // - 'gather': Keep import/creation order (fastest)
        // - 'random': Completely randomize all new cards

        //  Sibling Burying (Anki behavior)
        autoBurySiblings: true, // Hide sibling cards from same note during queue building
        // Note: Prevents seeing "front->back" and "back->front" in same session

        setPreferences: (pref) => set((state) => {
          return { ...state, ...pref }
        }),

        // Session history
        history: {}, // { dayNumber: { newCards: 5, reviewCards: 12, timeSpent: 1200000 } }

        // Current session state (for resumption)
        day: null,
        currentCard: null,
        pile: { new: [], review: [], done: [] },
        actionLog: [],
        timeSegments: [],

        // Session active when day !== null

        getCurrentDay: () => get(x => {
          const now = Date.now() / 60 / 1000 // in minutes
          const resetOffs = x.dailyResetTime * 60
          const tzOffs = new Date().getTimezoneOffset() // TZ offset in minutes

          // Adjust for timezone and daily reset time
          const delta = now - resetOffs + tzOffs

          // Calculate days since epoch (1970/1/1)
          return Math.floor(delta / 60 / 24)
        }),

        start: () => set((state) => {
          const today = get().getCurrentDay()

          // If there's a previous session from a different day, compact it first
          if (state.day && state.day !== today) {
            get().updateHistory()
          }

          if (state.day === today) return // Already active for today

          state.day = today
          state.currentCard = null
          state.pile = { new: [], review: [], done: [] }
          state.actionLog = []
          state.timeSegments = []
        }),

        finish: () => set((state) => {
          if (state.day) {
            get().updateHistory() // Compact current session
          }

          state.day = null
        }),

        updateHistory: () => set((state) => {
          if (!state.day) return // No active session

          // Calculate card type counts from pile.done using FSRS state
          const cardCounts = { new: 0, learning: 0, review: 0, relearning: 0 }
          state.pile.done.forEach(card => {
            if (card.fsrs?.state) {
              const cardState = card.fsrs.state.toLowerCase()
              if (cardState in cardCounts) {
                cardCounts[cardState]++
              }
            } else {
              // Fallback for cards without FSRS state
              cardCounts.new++
            }
          })

          // Calculate total time from segments
          const totalTime = state.timeSegments.reduce((sum, segment) => {
            if (segment.start && segment.end) {
              return sum + (segment.end - segment.start)
            } else if (segment.start && !segment.end) {
              return sum + (Date.now() - segment.start)
            }
            return sum
          }, 0)

          // Calculate completion rate
          const totalCards = state.pile.new.length + state.pile.review.length +
            state.pile.done.length
          const completion = totalCards > 0 ? state.pile.done.length / totalCards : 0

          // Update history
          state.history[state.day] = {
            ...cardCounts,
            totalTime,
            segments: [...state.timeSegments],
            completion: Math.round(completion * 100) / 100 // Round to 2 decimals
          }
        }),

        updateTimeSegments: (segments) => set((state) => {
          state.timeSegments = [...segments]
        })
      })),
      {
        name: `ls100-anki-session-${shardId}`,
        partialize: (state) => {
          // Persist everything including session state for resumption
          return state
        }
      }
    )
  )

  stores.set(shardId, store)
  return store
}
