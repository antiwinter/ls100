import { getStore } from '../../../stores/factory'

export const AnkiSessionStore = (shardId) => {
  if (!shardId) throw new Error('shardId is required for AnkiSessionStore')

  return getStore(
    {
      topic: 'anki-session',
      shardId,
      partialize: ({ bundleId: _, ...rest }) => rest // Exclude bundleIds from persistence
    },
    (_set) => ({
      // Session state for studyEngine2
      day: null,
      bundleId: null,  // Runtime only - loaded from shard.meta
      queue: null,    // Array of card IDs (hydrated on load), null = sentinel at head
      actions: [],    // Undo stack: ids of rated cards in queue
      ttd: null       // Time tracking data: { base, total, slices }
    })
  )
}
