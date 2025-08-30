import { log } from '../../../utils/logger'

// Storage Manager for Anki shard data
// Coordinates IndexedDB (deck files) and localStorage (progress)

const DB_NAME = 'AnkiShardDB'
const DB_VERSION = 1

// IndexedDB stores
const STORES = {
  decks: 'decks',
  cards: 'cards',
  media: 'media'
}

// localStorage keys
const KEYS = {
  decks: 'anki_decks',
  progress: 'anki_progress',
  prefs: 'anki_preferences',
  session: 'anki_session_current'
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

      // Decks store
      if (!db.objectStoreNames.contains(STORES.decks)) {
        const deckStore = db.createObjectStore(STORES.decks, { keyPath: 'id' })
        deckStore.createIndex('name', 'name', { unique: false })
      }

      // Cards store
      if (!db.objectStoreNames.contains(STORES.cards)) {
        const cardStore = db.createObjectStore(STORES.cards, { keyPath: 'id' })
        cardStore.createIndex('deckId', 'deckId', { unique: false })
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
      // Handle quota exceeded
      if (error.name === 'QuotaExceededError') {
        log.warn('localStorage quota exceeded, attempting cleanup')
        cleanupStorage()
      }
    }
  },

  remove(key) {
    localStorage.removeItem(key)
  }
}

// Deck operations
export const deckStorage = {
  async saveDeck(deckData) {
    const { id, name, cards, ...metadata } = deckData

    // Store deck metadata in IndexedDB
    await idb.put(STORES.decks, { id, name, ...metadata })

    // Store cards in IndexedDB
    for (const card of cards) {
      await idb.put(STORES.cards, { ...card, deckId: id })
    }

    // Update deck list in localStorage
    const decks = storage.get(KEYS.decks, {})
    decks[id] = {
      name,
      totalCards: cards.length,
      studiedCards: 0,
      lastStudied: null
    }
    storage.set(KEYS.decks, decks)

    log.info('Deck saved:', { id, name, cards: cards.length })
  },

  async loadDeck(deckId) {
    const deck = await idb.get(STORES.decks, deckId)
    if (!deck) return null

    const cards = await idb.query(STORES.cards, 'deckId', deckId)
    return { ...deck, cards }
  },

  async deleteDeck(deckId) {
    // Remove from IndexedDB
    await idb.delete(STORES.decks, deckId)

    const cards = await idb.query(STORES.cards, 'deckId', deckId)
    for (const card of cards) {
      await idb.delete(STORES.cards, card.id)
    }

    // Remove from localStorage
    const decks = storage.get(KEYS.decks, {})
    delete decks[deckId]
    storage.set(KEYS.decks, decks)

    // Remove progress data
    storage.remove(`${KEYS.progress}_${deckId}`)

    log.info('Deck deleted:', deckId)
  },

  listDecks() {
    return storage.get(KEYS.decks, {})
  }
}

// Progress operations
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
  },

  updateDeckStats(deckId, stats) {
    const decks = storage.get(KEYS.decks, {})
    if (decks[deckId]) {
      decks[deckId] = { ...decks[deckId], ...stats, lastStudied: new Date().toISOString() }
      storage.set(KEYS.decks, decks)
    }
  }
}

// Session operations
export const sessionStorage = {
  saveSession(sessionData) {
    storage.set(KEYS.session, sessionData)
  },

  loadSession() {
    return storage.get(KEYS.session)
  },

  clearSession() {
    storage.remove(KEYS.session)
  }
}

// Storage cleanup
const cleanupStorage = () => {
  // Remove old session data
  storage.remove(KEYS.session)

  // Keep only recent progress data (last 30 days)
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  Object.keys(localStorage).forEach(key => {
    if (key.startsWith(KEYS.progress)) {
      const progress = storage.get(key, {})
      let hasRecent = false

      Object.values(progress).forEach(cardProgress => {
        if (cardProgress.lastReview && new Date(cardProgress.lastReview) > cutoff) {
          hasRecent = true
        }
      })

      if (!hasRecent) {
        storage.remove(key)
        log.debug('Cleaned up old progress:', key)
      }
    }
  })
}

// Storage status
export const getStorageInfo = async () => {
  let quota = 0, usage = 0

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    quota = estimate.quota
    usage = estimate.usage
  }

  const decksCount = Object.keys(storage.get(KEYS.decks, {})).length

  return {
    quota,
    usage,
    decksCount,
    percentUsed: quota > 0 ? (usage / quota * 100).toFixed(1) : 0
  }
}

log.debug('Storage manager initialized')
