import { getStore } from '../../../stores/factory'

export const AnkiPrefsStore = (shardId = null) => {
  // Global when shardId is null/undefined; per-shard overrides when provided
  return getStore(
    { topic: 'anki-prefs', shardId },
    (set) => ({
      // STUDY OPTIONS
      maxNewCards: 18,
      maxReviewCards: 188,
      dailyResetTime: 4,
      // New cards only graduate out of current session when next due is beyond this gap (minutes)
      initialGap: 10,

      // Display
      showAnswer: false,
      autoReveal: false,
      previewSide: 'back', // 'front' | 'back' | 'both'

      // Study Flow
      newReviewOrder: 'mixed',  // 'mixed' | 'new-first' | 'review-first'
      // New card ordering
      newCardOrder: 'gather',   // 'gather' | 'random' | 'template-random'
      // Anki behavior
      autoBurySiblings: true,   // Hide sibling cards from same note during queue building

      setPreferences: (pref) => set((s) => Object.assign(s, pref || {}))
    })
  )
}

export default { AnkiPrefsStore }


