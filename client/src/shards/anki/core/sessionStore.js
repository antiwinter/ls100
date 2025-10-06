import { getStore } from '../../../stores/factory'

export const AnkiSessionStore = (shardId) => {
  if (!shardId) throw new Error('shardId is required for AnkiSessionStore')

  return getStore(
    { topic: 'anki-session', shardId },
    (_set) => ({
      // Session state for studyEngine2
      day: null,
      bundleIds: [],
      queue: null, // Array of card IDs (hydrated on load), null = sentinel at head
      ttd: null    // Time tracking data: { base, total, slices }
    })
  )
}
