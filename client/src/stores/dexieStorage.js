import { shardApi } from '../shards/shardApi'
import { log } from '../utils/logger'

// Dexie-backed storage for Zustand persist
// Stores rows in db.kv with schema: { id: key, data, topic, shardId, updated_at }

export const createDexieStorage = () => {
  const db = shardApi.getDb()

  return {
    getItem: async (name) => {
      try {
        const row = await db.kv.get(name)
        // Return raw payload string if present
        return row ? row.data : null
      } catch (err) {
        log.warn('dexieStorage.getItem failed', { name }, err)
        return null
      }
    },
    setItem: async (name, value, meta = {}) => {
      try {
        // Persist raw string payload. Persist version if payload has { version } at top level.
        const data = typeof value === 'string' ? value : JSON.stringify(value)
        let version = null
        try {
          const parsed = JSON.parse(data)
          if (parsed && typeof parsed.version === 'number') {
            version = parsed.version
          }
        } catch {
          // ignore parse error: data may not be json (shouldn't happen for persist)
        }
        const { topic, shardId } = meta
        await db.kv.put({ id: name, data, topic, shardId, version })
      } catch (err) {
        log.warn('dexieStorage.setItem failed', { name }, err)
      }
    },
    removeItem: async (name) => {
      try {
        await db.kv.delete(name)
      } catch (err) {
        log.warn('dexieStorage.removeItem failed', { name }, err)
      }
    }
  }
}

export default createDexieStorage


