import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

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

describe('StudyEngine2', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
    // Don't clear localStorage - persist middleware needs it
  })

  test('handles empty queue gracefully', async () => {
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [], day: null, queue: null })
    const engine = await createEngine(prefs, store)

    // Should handle empty state gracefully
    expect(() => engine.draw()).not.toThrow()
    expect(engine.draw()).toBeNull()
    expect(() => engine.undo()).not.toThrow()
  })

  test('builds queue and draw selects a card', async () => {
    const bundleId = 'b1'
    await seedCards(bundleId, { new: 2, review: 2 })
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [bundleId], day: null, queue: null })
    const engine = await createEngine(prefs, store)

    expect(engine.cards().length).toBeGreaterThan(0)
    const card = engine.draw()
    expect(card).not.toBeNull()
  })

  test('rate updates FSRS and mirrors to card fields', async () => {
    const bundleId = 'b2'
    await seedCards(bundleId, { new: 1, review: 0 })
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [bundleId], day: null, queue: null }) // Force queue rebuild
    const engine = await createEngine(prefs, store)

    const c = engine.draw()
    expect(c).toBeTruthy()
    await engine.rate(3) // Good
    const updated = await db.cards.get(c.id)
    expect(updated.fsrs).toBeTruthy()
    expect(updated.state).toBeTruthy()
  })
})


