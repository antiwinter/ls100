import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { StudyEngine2, createEngine } from '../core/studyEngine2.js'
import db from '../core/db.js'
import { genId } from '../../../utils/idGenerator.js'
import { createEmptyCard } from 'ts-fsrs'

// Mock store for testing
const createMockStore = (initialState = {}) => {
  let state = {
    day: null,
    bundleId: null,
    queue: [],
    actions: [],
    ttd: null,
    ...initialState
  }
  
  return {
    getState: () => state,
    setState: (updates) => {
      state = { ...state, ...updates }
    }
  }
}

// Mock prefs
const mockPrefs = {
  maxNewCards: 5,
  maxReviewCards: 10,
  dailyResetTime: 0,
  naturalCooldown: false,
  autoBurySiblings: false,
  newCardOrder: 'random',
  newReviewOrder: 'mixed',
  gradCd: 24 * 60 // 24 hours in minutes
}

describe('StudyEngine2 Comprehensive Tests', () => {
  let bundleId, templateId, noteIds, cardIds
  let engine, store

  beforeEach(async () => {
    // Clear database
    await db.bundles.clear()
    await db.templates.clear()
    await db.notes.clear()
    await db.cards.clear()
    await db.history.clear()

    // Create test data
    bundleId = genId('bundle', 'test')
    templateId = genId('template', 'test')
    
    // Create bundle
    await db.bundles.put({
      id: bundleId,
      name: 'Test Bundle',
      fields: ['Front', 'Back'],
      css: '',
      created: Date.now()
    })

    // Create template
    await db.templates.put({
      id: templateId,
      bundleId,
      name: 'Basic',
      qfmt: '{{Front}}',
      afmt: '{{Back}}',
      ord: 0,
      created: Date.now()
    })

    // Create test notes and cards
    noteIds = []
    cardIds = []
    
    for (let i = 0; i < 8; i++) {
      const noteId = genId('note', `test-${i}`)
      const cardId = genId('card', `test-${i}`)
      
      await db.notes.put({
        id: noteId,
        bundleId,
        fields: [`Front ${i}`, `Back ${i}`],
        tags: [],
        created: Date.now(),
        modified: Date.now()
      })

      const now = Date.now()
      await db.cards.put({
        id: cardId,
        noteId,
        templateOrd: 0,
        bundleId,
        due: i < 4 ? now - 1000 : now + 1000, // First 4 are due, last 4 are new
        state: i < 4 ? 'Review' : 'New',
        fsrs: i < 4 ? [createEmptyCard(now)] : null,
        created: now,
        modified: now
      })

      noteIds.push(noteId)
      cardIds.push(cardId)
    }

    // Create store and engine
    store = createMockStore({ bundleId })
    engine = new StudyEngine2(mockPrefs, store)
    engine.bundleId = bundleId
  })

  afterEach(() => {
    engine?.exit()
  })

  describe('Undo Method Tests', () => {
    it('should undo a card rating and return card to front of queue', async () => {
      // Initialize engine
      await engine._init()
      
      // Get initial queue state
      const initialQueueLength = engine.cards().length
      expect(initialQueueLength).toBeGreaterThan(0)
      
      // Draw and rate a card
      const card = engine.draw()
      expect(card).toBeTruthy()
      expect(card.id).toBeTruthy()
      
      const initialActions = engine.actions.length
      await engine.schedule(card, 3) // Rate as Good
      
      // Verify card was rated
      expect(engine.actions.length).toBe(initialActions + 1)
      expect(engine.actions[0]).toEqual({ op: 3, id: card.id })
      
      // Undo the rating
      const undoneCard = await engine.undo()
      
      // Verify undo worked
      expect(undoneCard).toBeTruthy()
      expect(undoneCard.id).toBe(card.id)
      expect(engine.actions.length).toBe(initialActions)
      
      // Card should be at front of queue with reset due time
      const frontCard = engine.queue.find(c => c?.id === card.id)
      expect(frontCard).toBeTruthy()
      expect(frontCard.due).toBeLessThanOrEqual(Date.now())
    })

    it('should return null when undoing with empty actions', async () => {
      await engine._init()
      
      // Ensure no actions
      expect(engine.actions.length).toBe(0)
      
      // Try to undo
      const result = await engine.undo()
      expect(result).toBeNull()
    })

    it('should handle undo when card is not in queue (corrupted state)', async () => {
      await engine._init()
      
      // Get a real card from the queue, then remove it manually
      const realCard = engine.draw()
      expect(realCard).toBeTruthy()
      
      // Remove the card from queue manually (simulating corruption)
      const cardIndex = engine.queue.findIndex(c => c?.id === realCard.id)
      engine.queue.splice(cardIndex, 1)
      
      // Manually add an action for the removed card
      engine.actions = [{ op: 2, id: realCard.id }]
      
      // Try to undo
      const result = await engine.undo()
      expect(result).toBeNull()
      
      // Actions should be cleaned up
      expect(engine.actions.length).toBe(0)
    })

    it('should properly revert FSRS state on undo', async () => {
      await engine._init()
      
      const card = engine.draw()
      expect(card).toBeTruthy()
      
      // Store original FSRS state
      const originalFsrs = card.fsrs ? [...card.fsrs] : null
      
      // Rate the card
      await engine.schedule(card, 4) // Rate as Easy
      
      // Verify FSRS state changed
      const ratedCard = await db.cards.get(card.id)
      expect(ratedCard.fsrs).toBeTruthy()
      expect(ratedCard.fsrs.length).toBeGreaterThan(originalFsrs?.length || 0)
      
      // Undo
      const undoneCard = await engine.undo()
      expect(undoneCard).toBeTruthy()
      
      // Verify FSRS state was reverted in database
      const revertedCard = await db.cards.get(card.id)
      if (originalFsrs && originalFsrs.length > 0) {
        expect(revertedCard.fsrs).toEqual(originalFsrs)
      } else {
        // Cards that originally had null fsrs may become empty array after undo
        expect(revertedCard.fsrs).toEqual([])
      }
    })
  })

  describe('Reset Method Tests', () => {
    it('should clear actions and reset all cards in queue', async () => {
      await engine._init()
      
      // Rate some cards to create actions
      const card1 = engine.draw()
      await engine.schedule(card1, 2)
      
      const card2 = engine.draw()
      await engine.schedule(card2, 3)
      
      // Verify we have actions
      expect(engine.actions.length).toBe(2)
      
      // Reset
      await engine.reset()
      
      // Verify actions are cleared
      expect(engine.actions.length).toBe(0)
      
      // Verify queue is rebuilt (should contain sentinel)
      expect(engine.queue).toContain(null)
    })

    it('should revert all rated cards to previous state', async () => {
      await engine._init()
      
      const card = engine.draw()
      const originalFsrs = card.fsrs ? [...card.fsrs] : null
      
      // Rate the card
      await engine.schedule(card, 3)
      
      // Verify card state changed in database
      const ratedCard = await db.cards.get(card.id)
      expect(ratedCard.fsrs).not.toEqual(originalFsrs)
      
      // Reset
      await engine.reset()
      
      // Verify card state was reverted in database
      const resetCard = await db.cards.get(card.id)
      if (originalFsrs && originalFsrs.length > 0) {
        expect(resetCard.fsrs).toEqual(originalFsrs)
      } else {
        // Cards that originally had null fsrs may become empty array after reset
        expect(resetCard.fsrs).toEqual([])
      }
    })

    it('should properly sync state after reset', async () => {
      await engine._init()
      
      // Rate some cards
      const card1 = engine.draw()
      await engine.schedule(card1, 2)
      
      const card2 = engine.draw() 
      await engine.schedule(card2, 4)
      
      // Reset
      await engine.reset()
      
      // Verify store was flushed with correct keys
      const storeState = store.getState()
      expect(storeState.actions).toEqual([])
      expect(Array.isArray(storeState.queue)).toBe(true)
    })
  })

  describe('Extend Method Tests', () => {
    it('should extend queue when session is ended', async () => {
      await engine._init()
      
      // Manually set queue to ended state (sentinel at front)
      engine.queue = [null]
      
      const initialLength = engine.cards().length
      expect(initialLength).toBe(0) // Only sentinel
      
      // Extend with more cards
      await engine.extend(3, 5)
      
      // Should have new cards
      const newLength = engine.cards().length
      expect(newLength).toBeGreaterThan(0)
      expect(newLength).toBeLessThanOrEqual(8) // Max available cards
      
      // Store should be synced
      const storeState = store.getState()
      expect(Array.isArray(storeState.queue)).toBe(true)
    })

    it('should refuse to extend when session is not ended', async () => {
      await engine._init()
      
      // Ensure session is active (cards in queue)
      const initialCards = engine.cards()
      expect(initialCards.length).toBeGreaterThan(0)
      
      // Try to extend
      await engine.extend(2, 3)
      
      // Queue should be unchanged
      const finalCards = engine.cards()
      expect(finalCards.length).toBe(initialCards.length)
    })

    it('should properly flush queue state after extend', async () => {
      await engine._init()
      
      // Set to ended state
      engine.queue = [null]
      
      // Extend
      await engine.extend(2, 2)
      
      // Verify store was flushed
      const storeState = store.getState()
      expect(Array.isArray(storeState.queue)).toBe(true)
      expect(storeState.queue.length).toBeGreaterThan(1) // Should have cards + sentinel
    })
  })

  describe('Integration Tests', () => {
    it('should handle complex undo/reset scenarios', async () => {
      await engine._init()
      
      // Rate multiple cards
      const actions = []
      for (let i = 0; i < 3; i++) {
        const card = engine.draw()
        if (card) {
          await engine.schedule(card, 2 + i)
          actions.push({ card: card.id, rating: 2 + i })
        }
      }
      
      expect(engine.actions.length).toBe(actions.length)
      
      // Undo one
      const undone1 = await engine.undo()
      expect(undone1).toBeTruthy()
      expect(engine.actions.length).toBe(actions.length - 1)
      
      // Reset should clear remaining actions
      await engine.reset()
      expect(engine.actions.length).toBe(0)
    })

    it('should handle extend after partial session completion', async () => {
      await engine._init()
      
      // Complete some cards
      let completed = 0
      while (completed < 3) {
        const card = engine.draw()
        if (!card) break
        await engine.schedule(card, 3)
        completed++
      }
      
      // Check if session ended naturally
      const status = engine.status()
      
      if (status.done) {
        // Try to extend
        const initialCards = engine.cards().length
        await engine.extend(2, 2)
        const finalCards = engine.cards().length
        expect(finalCards).toBeGreaterThanOrEqual(initialCards)
      } else {
        // Session not ended, extend should fail
        const initialCards = engine.cards().length
        await engine.extend(2, 2)
        const finalCards = engine.cards().length
        expect(finalCards).toBe(initialCards)
      }
    })
  })
})
