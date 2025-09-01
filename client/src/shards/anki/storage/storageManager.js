import { log } from '../../../utils/logger'

// Storage Manager for Anki shard data
// New note+template architecture - simplified storage

const DB_NAME = 'AnkiShardDB'
const DB_VERSION = 3

// IndexedDB stores for new architecture
const STORES = {
  notes: 'notes',
  noteTypes: 'noteTypes',
  templates: 'templates',
  cards: 'cards',
  media: 'media'
}

// localStorage keys (minimal for new architecture)
const KEYS = {
  progress: 'anki_progress',
  prefs: 'anki_preferences'
}

let db = null

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db)

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      log.error('Failed to open IndexedDB:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      log.debug('IndexedDB initialized')
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // Notes store - field data + refCount
      if (!db.objectStoreNames.contains(STORES.notes)) {
        const noteStore = db.createObjectStore(STORES.notes, { keyPath: 'id' })
        noteStore.createIndex('typeId', 'typeId', { unique: false })
        noteStore.createIndex('refCount', 'refCount', { unique: false })
        noteStore.createIndex('modified', 'modified', { unique: false })
      }

      // NoteTypes store - schema definitions
      if (!db.objectStoreNames.contains(STORES.noteTypes)) {
        const typeStore = db.createObjectStore(STORES.noteTypes, { keyPath: 'id' })
        typeStore.createIndex('name', 'name', { unique: false })
      }

      // Templates store - rendering templates
      if (!db.objectStoreNames.contains(STORES.templates)) {
        const tmplStore = db.createObjectStore(STORES.templates, { keyPath: 'id' })
        tmplStore.createIndex('typeId', 'typeId', { unique: false })
        tmplStore.createIndex('idx', 'idx', { unique: false })
      }

      // Cards store - lightweight refs to note+template
      if (!db.objectStoreNames.contains(STORES.cards)) {
        const cardStore = db.createObjectStore(STORES.cards, { keyPath: 'id' })
        cardStore.createIndex('noteId', 'noteId', { unique: false })
        cardStore.createIndex('deckId', 'deckId', { unique: false })
        cardStore.createIndex('shardId', 'shardId', { unique: false })
        cardStore.createIndex('due', 'due', { unique: false })
      }

      // Media store
      if (!db.objectStoreNames.contains(STORES.media)) {
        db.createObjectStore(STORES.media, { keyPath: 'id' })
      }
    }
  })
}

// IndexedDB operations
export const idb = {
  async get(store, key) {
    const database = await initDB()
    const tx = database.transaction([store], 'readonly')
    const request = tx.objectStore(store).get(key)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  },

  async put(store, data) {
    const database = await initDB()
    const tx = database.transaction([store], 'readwrite')
    const request = tx.objectStore(store).put(data)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  },

  async delete(store, key) {
    const database = await initDB()
    const tx = database.transaction([store], 'readwrite')
    const request = tx.objectStore(store).delete(key)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  async getAll(store) {
    const database = await initDB()
    const tx = database.transaction([store], 'readonly')
    const request = tx.objectStore(store).getAll()
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  },

  async query(store, index, value) {
    const database = await initDB()
    const tx = database.transaction([store], 'readonly')
    const request = tx.objectStore(store).index(index).getAll(value)
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
}

// localStorage operations with JSON serialization
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      log.error('localStorage get error:', error)
      return defaultValue
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      log.error('localStorage set error:', error)
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      log.error('localStorage remove error:', error)
    }
  }
}

// Progress operations (keep for FSRS scheduling)
export const progressStorage = {
  getCardProgress(deckId, cardId) {
    const progress = storage.get(`${KEYS.progress}_${deckId}`, {})
    return progress[cardId] || null
  },

  setCardProgress(deckId, cardId, progressData) {
    const progress = storage.get(`${KEYS.progress}_${deckId}`, {})
    progress[cardId] = {
      ...progressData,
      lastReview: new Date().toISOString()
    }
    storage.set(`${KEYS.progress}_${deckId}`, progress)
  },

  getDeckProgress(deckId) {
    return storage.get(`${KEYS.progress}_${deckId}`, {})
  }
}

// Storage status
export const getStorageInfo = async () => {
  let quota = 0, usage = 0

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    quota = estimate.quota
    usage = estimate.usage
  }

  return {
    quota,
    usage,
    percentUsed: quota > 0 ? (usage / quota * 100).toFixed(1) : 0
  }
}

log.debug('Storage manager initialized (new architecture)')

// Debug function - expose basic operations to window for manual debugging
if (typeof window !== 'undefined') {
  window.debugAnkiStorage = {
    listNotes: async () => {
      const notes = await idb.getAll(STORES.notes)
      log.info('Notes:', notes.length)
      return notes
    },
    listCards: async () => {
      const cards = await idb.getAll(STORES.cards)
      log.info('Cards:', cards.length)
      return cards
    },
    listNoteTypes: async () => {
      const types = await idb.getAll(STORES.noteTypes)
      log.info('NoteTypes:', types.length)
      return types
    },
    clearAll: async () => {
      const stores = Object.values(STORES)
      for (const store of stores) {
        const items = await idb.getAll(store)
        for (const item of items) {
          await idb.delete(store, item.id)
        }
      }
      log.info('All data cleared')
    }
  }
  log.info('🛠️ Anki Storage Debug Available:', Object.keys(window.debugAnkiStorage))
}
