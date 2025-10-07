import { getStore } from '../../../stores/factory'

export const AnkiPrefsStore = (shardId = null) => {
  // Global when shardId is null/undefined; per-shard overrides when provided
  return getStore(
    { topic: 'anki-prefs', shardId },
    (set) => ({
      previewSide: 'back', // 'front' | 'back' | 'both' (for browse mode)

      // STUDY OPTIONS
      maxNewCards: 18,
      maxReviewCards: 188,
      dailyResetTime: 4, // in hours
      // New cards only graduate out of current session when next due is beyond this gap (minutes)
      gradGap: 10,

      // Accessibility
      autoReveal: false,
      autoPlayAudio: true,

      // Study Flow
      newReviewOrder: 'mixed',  // 'mixed' | 'new-first' | 'review-first'
      // New card ordering
      newCardOrder: 'gather',   // 'gather' | 'random' | 'template-random'
      // Anki behavior
      autoBurySiblings: true,   // Hide sibling cards from same note during queue building
      naturalCooldown: false,   // Use natural cooldown instead of daily reset

      setPreferences: (pref) => set((s) => Object.assign(s, pref || {}))
    })
  )
}

export default { AnkiPrefsStore }


