import { describe, test, expect, beforeEach } from 'vitest'
import { proxy } from 'valtio'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { StudyEngine } from '../core/studyEngine.js'

// Valtio-compatible session store mock
function createSessionStore(initial = {}) {
  const state = proxy({
    bundleIds: [],
    newCardOrder: 'gather',
    newReviewOrder: 'mixed',
    autoBurySiblings: true,
    maxNewCards: 9999,
    maxReviewCards: 9999,
    timeSegments: [],
    actionLog: [],
    pile: { new: [], review: [], done: [] },
    day: 0,
    currentCard: null,
    ...initial,
    
    // Mock session methods
    start() { 
      // Always start a new session for tests
      return true 
    },
    finish() {},
    updateHistory: () => {},
    setPreferences(pref) {
      Object.assign(this, pref || {})
    }
  })
  
  return state
}

async function seedCards(bundleId, counts) {
  const now = Date.now()
  const ids = []
  for (let i = 0; i < counts.new; i++) {
    const noteId = `n-new-${i}`
    await db.notes.put({ id: noteId, bundleId, fields: ['f1'], tags: [] })
    const id = `c-new-${i}`
    ids.push(id)
    await db.cards.put({ id, noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  }
  for (let i = 0; i < counts.review; i++) {
    const noteId = `n-rev-${i}`
    await db.notes.put({ id: noteId, bundleId, fields: ['f1'], tags: [] })
    const id = `c-rev-${i}`
    ids.push(id)
    await db.cards.put({ id, noteId, bundleId, templateOrd: 0, due: now - 1000, state: 'Review', fsrs: [{ due: now - 1000, state: 'Review' }], created: now, modified: now })
  }
  return ids
}

describe('StudyEngine', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('🚨 EXPOSES: study engine should handle empty card piles gracefully', async () => {
    const sessionStore = createSessionStore()
    const engine = new StudyEngine(sessionStore)
    
    // 🚨 BUG: Empty piles should not cause study engine to crash or behave unexpectedly
    expect(() => engine.draw()).not.toThrow()
    expect(() => engine.rate(0)).not.toThrow()
    expect(() => engine.undo()).not.toThrow()
    
    // Should handle empty state gracefully
    expect(engine.draw()).toBeNull()
  })

  test('init builds queues and draw selects a card', async () => {
    const bundleId = 'b1'
    await seedCards(bundleId, { new: 2, review: 2 })
    const session = createSessionStore({ bundleIds: [bundleId] })
    const engine = new StudyEngine()
    await engine.init(session)
    expect(session.pile.new.length + session.pile.review.length).toBeGreaterThan(0)
    const card = engine.draw()
    expect(card).not.toBeNull()
  })

  test('rate updates mirrored fields and piles', async () => {
    const bundleId = 'b2'
    await seedCards(bundleId, { new: 1, review: 0 })
    const session = createSessionStore({ bundleIds: [bundleId] })
    const engine = new StudyEngine()
    await engine.init(session)
    const c = engine.draw()
    expect(c).toBeTruthy()
    await engine.rate(3) // Good
    const updated = await db.cards.get(c.id)
    expect(updated.fsrs).toBeTruthy()
    expect(updated.state).toBeTruthy()
  })
})


