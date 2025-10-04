import { getStore } from '../../../stores/factory'

export const AnkiSessionStore = (shardId) => {
  if (!shardId) throw new Error('shardId is required for AnkiSessionStore')

  return getStore(
    { topic: 'anki-session', shardId },
    (_set) => ({
      // Session aggregates / resumable data (engine state)
      history: {},
      day: null,
      bundleIds: [],
      // Persisted session state: allow pause/resume sessions
      currentCard: null,
      pile: { raw: [], review: [], done: [] },
      actionLog: [],
      // Time tracking persisted as { segments, total }
      timeTracking: null
    })
  )
}
