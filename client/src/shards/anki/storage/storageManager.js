import { log } from '../../../utils/logger'

// Storage Manager for Anki shard data
// Coordinates IndexedDB (deck files) and localStorage (progress)

const DB_NAME = 'AnkiShardDB'
const DB_VERSION = 3

// IndexedDB stores
const STORES = {
  decks: 'decks',
  notes: 'notes',
  noteTypes: 'noteTypes', 
  templates: 'templates',
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

// Card content hashing - generates unique ID from all card content
const hashCardContent = async (card) => {
  const content = {
    question: card.question || '',
    answer: card.answer || '',
    fields: card.note?.flds || [],
    noteType: card.noteType?.name || '',
    templateOrd: card.ord || 0,
    mediaUrls: extractMediaUrls(card)
  }

  const text = JSON.stringify(content, Object.keys(content).sort())
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)

  return 'card_' + Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

// Extract media URLs from card content for hashing
const extractMediaUrls = (card) => {
  const urls = []
  const content = (card.question || '') + (card.answer || '')

  // Extract src= URLs
  const srcMatches = content.match(/src="([^"]+)"/g) || []
  srcMatches.forEach(match => {
    const url = match.match(/src="([^"]+)"/)[1]
    urls.push(url)
  })

  return urls.sort()
}

// Deck operations
export const deckStorage = {
  async saveDeck(deckData, shardId = null) {
    const { id, name, cards, ...metadata } = deckData
    const deckId = shardId ? `${shardId}_${id}` : id

    // Store deck in IndexedDB
    await idb.put(STORES.decks, { id: deckId, shardId, name, ...metadata })

    // Process cards with reference counting
    let newCards = 0
    let reusedCards = 0

    for (const card of cards) {
      const cardId = await hashCardContent(card)

      // Get or create card
      let storedCard = await idb.get(STORES.cards, cardId)

      if (storedCard) {
        // Card exists - increment refCount
        storedCard.refCount = (storedCard.refCount || 0) + 1
        await idb.put(STORES.cards, storedCard)
        reusedCards++
      } else {
        // New card - store with refCount = 1
        storedCard = {
          id: cardId,
          question: card.question,
          answer: card.answer,
          fields: card.note?.flds || [],
          noteType: card.noteType?.name || '',
          templateOrd: card.ord || 0,
          mediaUrls: extractMediaUrls(card),
          refCount: 1,
          progress: {}, // FSRS scheduling data
          lastModified: new Date().toISOString()
        }
        await idb.put(STORES.cards, storedCard)
        newCards++
      }

      // Add card reference
      await idb.put(STORES.cardRefs, {
        shardId,
        deckId,
        cardId,
        addedAt: new Date().toISOString()
      })
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

    log.info('Deck saved:', { deckId, shardId, name, total: cards.length, newCards, reusedCards })
  },

  async loadDeck(deckId) {
    const deck = await idb.get(STORES.decks, deckId)
    if (!deck) return null

    // Get card references for this deck
    const refs = await idb.getAll(STORES.cardRefs)
    const deckRefs = refs.filter(ref => ref.deckId === deckId)

    // Load actual cards
    const cards = []
    for (const ref of deckRefs) {
      const card = await idb.get(STORES.cards, ref.cardId)
      if (card) {
        cards.push(card)
      }
    }

    log.info('✅ Loaded:', deck.name, `(${cards.length} cards)`)
    return { ...deck, cards }
  },

  async deleteDeck(deckId) {
    // Get card references for this deck
    const refs = await idb.getAll(STORES.cardRefs)
    const deckRefs = refs.filter(ref => ref.deckId === deckId)

    // Decrement refCount for each referenced card
    for (const ref of deckRefs) {
      const card = await idb.get(STORES.cards, ref.cardId)
      if (card) {
        card.refCount = (card.refCount || 1) - 1

        if (card.refCount <= 0) {
          // Delete card when no more references
          await idb.delete(STORES.cards, ref.cardId)
        } else {
          // Update refCount
          await idb.put(STORES.cards, card)
        }
      }

      // Remove the reference
      await idb.delete(STORES.cardRefs, [ref.shardId, ref.deckId, ref.cardId])
    }

    // Remove deck
    await idb.delete(STORES.decks, deckId)

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
      log.info('No orphaned decks found, checking cards...')
      const cardCleanup = await this.deepCleanupIndexedDB()
      return cardCleanup
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

    // Also clean up any orphaned cards
    const cardCleanup = await this.deepCleanupIndexedDB()

    log.info('Orphan cleanup completed:', { cleanedDecks, orphanedCards: cardCleanup })
    return cleanedDecks + cardCleanup
  },

  async deepCleanupIndexedDB() {
    log.info('Deep cleanup: checking orphaned cards...')
    let cleanedItems = 0

    try {
      // Clean up cards with refCount === 0 or no refCount (legacy)
      const allCards = await idb.getAll(STORES.cards)

      for (const card of allCards) {
        const refCount = card.refCount

        if (refCount === 0 || refCount === undefined) {
          log.warn('Removing orphaned card:', {
            cardId: card.id,
            refCount,
            question: card.question?.substring(0, 50) + '...'
          })

          await idb.delete(STORES.cards, card.id)
          cleanedItems++
        }
      }
    } catch (error) {
      log.error('Error during card cleanup:', error)
    }

    log.info('Orphaned card cleanup completed:', { cleanedItems })
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
