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
  async saveDeck(deckData, shardId = null) {
    const { id, name, cards, ...metadata } = deckData
    const deckId = shardId ? `${shardId}_${id}` : id

    // Store deck in IndexedDB
    await idb.put(STORES.decks, { id: deckId, shardId, name, ...metadata })

    // Store cards in IndexedDB
    for (const card of cards) {
      await idb.put(STORES.cards, { ...card, deckId, shardId })
    }

    // Update deck list in localStorage
    const decks = storage.get(KEYS.decks, {})
    decks[deckId] = {
      name,
      shardId,
      totalCards: cards.length,
      studiedCards: 0,
      lastStudied: null
    }
    storage.set(KEYS.decks, decks)

    log.info('Deck saved:', { deckId, shardId, name, cards: cards.length })
  },

  async loadDeck(deckId) {
    const deck = await idb.get(STORES.decks, deckId)
    if (!deck) return null

    const cards = await idb.query(STORES.cards, 'deckId', deckId)

    // Debug logging to track card loading
    log.info('LoadDeck debug:', {
      deckId,
      deckName: deck.name,
      deckShardId: deck.shardId,
      cardsFound: cards.length,
      cardSample: cards.slice(0, 3).map(card => ({
        id: card.id,
        deckId: card.deckId,
        shardId: card.shardId,
        question: card.question?.substring(0, 50) + '...'
      }))
    })

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
  },

  async cleanupShard(shardId) {
    if (!shardId) return

    log.info('Cleaning up all decks/cards for shard:', shardId)

    // Get all decks for this shard
    const allDecks = storage.get(KEYS.decks, {})
    const shardDeckIds = Object.keys(allDecks).filter(deckId =>
      allDecks[deckId].shardId === shardId
    )

    // Delete each deck and its cards
    for (const deckId of shardDeckIds) {
      await this.deleteDeck(deckId)
    }

    log.info('Shard cleanup completed:', { shardId, cleanedDecks: shardDeckIds.length })
  },

  async cleanupOrphans(validShardIds = []) {
    log.info('Cleaning up orphaned data for non-existent shards...')

    const allDecks = storage.get(KEYS.decks, {})
    const validShardSet = new Set(validShardIds.filter(id => id && !id.startsWith('temp_')))
    let orphanedDecks = []
    let cleanedDecks = 0

    // Log current storage state for debugging
    log.info('Current storage state:', {
      localStorage: {
        totalDecks: Object.keys(allDecks).length,
        deckEntries: Object.entries(allDecks).map(([deckId, deckData]) => ({
          deckId,
          name: deckData.name,
          shardId: deckData.shardId,
          originalId: deckData.originalId
        }))
      },
      validShardIds,
      validShardSet: Array.from(validShardSet)
    })

    // Find decks that reference non-existent shards
    for (const [deckId, deckData] of Object.entries(allDecks)) {
      const shardId = deckData.shardId

      // Skip only temp shards (will be migrated later)
      if (shardId && shardId.startsWith('temp_')) continue

      // If shardId is null/undefined/empty OR shard doesn't exist in valid list, it's orphaned
      if (!shardId || !validShardSet.has(shardId)) {
        orphanedDecks.push({ deckId, shardId: shardId || 'null/undefined', name: deckData.name })
      }
    }

    if (orphanedDecks.length === 0) {
      log.info('No orphaned localStorage decks found, checking IndexedDB...')
      // Check IndexedDB directly for orphaned data
      const indexedDBCleanup = await this.deepCleanupIndexedDB(validShardSet)
      return indexedDBCleanup
    }

    log.warn('Found orphaned decks:', orphanedDecks.map(d => ({
      deck: d.name,
      orphanedShard: d.shardId
    })))

    // Clean up orphaned decks
    for (const orphan of orphanedDecks) {
      log.info('Removing orphaned deck:', orphan.name, 'from deleted shard:', orphan.shardId)
      await this.deleteDeck(orphan.deckId)
      cleanedDecks++
    }

    log.info('Orphan cleanup completed:', { cleanedDecks })
    return cleanedDecks
  },

  async deepCleanupIndexedDB(validShardSet) {
    log.info('Performing deep IndexedDB cleanup...')
    let cleanedItems = 0

    try {
      // Get all decks from IndexedDB
      const allIndexedDecks = await idb.getAll(STORES.decks)
      log.info('IndexedDB decks found:', allIndexedDecks.map(deck => ({
        id: deck.id,
        name: deck.name,
        shardId: deck.shardId,
        originalId: deck.originalId
      })))

      // Check for orphaned decks in IndexedDB
      for (const deck of allIndexedDecks) {
        const shardId = deck.shardId
        // Skip only temp shards (will be migrated later)
        if (shardId && shardId.startsWith('temp_')) continue

        // If shardId is null/undefined/empty OR shard doesn't exist in valid list, it's orphaned
        if (!shardId || !validShardSet.has(shardId)) {
          log.warn('Found orphaned IndexedDB deck:', {
            deckId: deck.id,
            name: deck.name,
            orphanedShardId: shardId || 'null/undefined'
          })

          // Delete orphaned deck from IndexedDB
          await idb.delete(STORES.decks, deck.id)
          cleanedItems++

          // Delete associated cards
          const orphanedCards = await idb.query(STORES.cards, 'deckId', deck.id)
          for (const card of orphanedCards) {
            await idb.delete(STORES.cards, card.id)
            cleanedItems++
          }

          log.info('Removed orphaned IndexedDB deck and cards:', deck.name)
        }
      }

      // AGGRESSIVE CARD CLEANUP - Check all cards for consistency
      const allCards = await idb.getAll(STORES.cards)
      const validDeckIds = new Set((await idb.getAll(STORES.decks)).map(d => d.id))

      log.info('Aggressive card cleanup - checking all cards...', {
        totalCards: allCards.length,
        validDecks: validDeckIds.size,
        validShards: validShardSet.size
      })

      for (const card of allCards) {
        let shouldDelete = false
        let reason = ''

        // Check 1: Card references non-existent deck
        if (!validDeckIds.has(card.deckId)) {
          shouldDelete = true
          reason = `orphaned deck reference: ${card.deckId}`
        }

        // Check 2: Card has null/undefined shard ID
        else if (!card.shardId) {
          shouldDelete = true
          reason = 'null/undefined shard ID'
        }

        // Check 3: Card references non-existent shard (but not temp)
        else if (!card.shardId.startsWith('temp_') && !validShardSet.has(card.shardId)) {
          shouldDelete = true
          reason = `orphaned shard reference: ${card.shardId}`
        }

        if (shouldDelete) {
          log.warn('Removing orphaned card:', {
            cardId: card.id,
            deckId: card.deckId,
            shardId: card.shardId,
            reason,
            question: card.question?.substring(0, 50) + '...'
          })
          await idb.delete(STORES.cards, card.id)
          cleanedItems++
        }
      }

    } catch (error) {
      log.error('Error during IndexedDB cleanup:', error)
    }

    log.info('Deep IndexedDB cleanup completed:', { cleanedItems })
    return cleanedItems
  },

  listDecksByShardId(shardId) {
    const allDecks = storage.get(KEYS.decks, {})
    const shardDecks = {}

    for (const [deckId, deckData] of Object.entries(allDecks)) {
      if (deckData.shardId === shardId) {
        shardDecks[deckId] = { ...deckData, id: deckId }
      }
    }

    return shardDecks
  },

  async forceCleanupAll() {
    log.warn('FORCE CLEANUP: Clearing all Anki data from storage...')

    try {
      // Clear localStorage
      storage.remove(KEYS.decks)
      storage.remove(KEYS.session)

      // Clear all progress data
      const allKeys = Object.keys(localStorage)
      for (const key of allKeys) {
        if (key.startsWith(`${KEYS.progress}_`)) {
          localStorage.removeItem(key)
        }
      }

      // Clear IndexedDB
      const allDecks = await idb.getAll(STORES.decks)
      const allCards = await idb.getAll(STORES.cards)

      log.warn('Force cleaning IndexedDB:', {
        decksToDelete: allDecks.length,
        cardsToDelete: allCards.length
      })

      // Delete all decks
      for (const deck of allDecks) {
        await idb.delete(STORES.decks, deck.id)
      }

      // Delete all cards
      for (const card of allCards) {
        await idb.delete(STORES.cards, card.id)
      }

      log.warn('FORCE CLEANUP COMPLETED - All Anki data cleared')
      return { decksCleared: allDecks.length, cardsCleared: allCards.length }

    } catch (error) {
      log.error('Error during force cleanup:', error)
      throw error
    }
  },

  async updateDeckShardAssociation(oldShardId, newShardId) {
    if (!oldShardId || !newShardId) return

    log.info('Updating deck shard association:', { from: oldShardId, to: newShardId })

    // Update decks in localStorage
    const allDecks = storage.get(KEYS.decks, {})
    let updatedDecks = {}
    let migrated = 0

    for (const [deckId, deckData] of Object.entries(allDecks)) {
      if (deckData.shardId === oldShardId) {
        // Calculate new deck ID
        const parts = deckId.split('_')
        const originalId = parts[parts.length - 1]
        const newDeckId = `${newShardId}_${originalId}`
        updatedDecks[newDeckId] = { ...deckData, shardId: newShardId }

        // Update IndexedDB deck
        const deck = await idb.get(STORES.decks, deckId)
        if (deck) {
          await idb.delete(STORES.decks, deckId)
          await idb.put(STORES.decks, { ...deck, id: newDeckId, shardId: newShardId })
        }

        // Update IndexedDB cards
        const cards = await idb.query(STORES.cards, 'deckId', deckId)
        for (const card of cards) {
          await idb.delete(STORES.cards, card.id)
          await idb.put(STORES.cards, { ...card, deckId: newDeckId, shardId: newShardId })
        }

        migrated++
      } else {
        // Keep existing deck
        updatedDecks[deckId] = deckData
      }
    }

    // Save updated decks to localStorage
    storage.set(KEYS.decks, updatedDecks)

    log.info('Migration completed:', { oldShardId, newShardId, migrated })

    return migrated
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

// Debug function - expose force cleanup to window for manual debugging
if (typeof window !== 'undefined') {
  window.debugAnkiStorage = {
    forceCleanupAll: () => deckStorage.forceCleanupAll(),
    listDecks: () => deckStorage.listDecks(),
    deepCleanup: (validShardIds = []) => deckStorage.cleanupOrphans(validShardIds),
    cleanupNullShards: () => deckStorage.cleanupOrphans([]), // Clean up null/undefined IDs
    listIndexedDBDecks: async () => {
      const allDecks = await idb.getAll(STORES.decks)
      log.info('IndexedDB Decks:', allDecks)
      return allDecks
    },
    listIndexedDBCards: async () => {
      const allCards = await idb.getAll(STORES.cards)
      log.info('IndexedDB Cards:', allCards.length, 'cards')
      return allCards
    }
  }
  log.info('🛠️ Anki Debug Tools Available:', Object.keys(window.debugAnkiStorage))
}
