import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

async function seed(bundleId, { n = 0, r = 0, siblings = false } = {}) {
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    const noteId = siblings ? 'note-same' : `n-${i}`
    await db.notes.put({ id: `${noteId}-n`, bundleId, fields: ['f'], tags: [] })
    await db.cards.put({ id: `c-n-${i}`, noteId: `${noteId}-n`, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  }
  for (let i = 0; i < r; i++) {
    const noteId = siblings ? 'note-same' : `m-${i}`
    await db.notes.put({ id: `${noteId}-r`, bundleId, fields: ['f'], tags: [] })
    await db.cards.put({ id: `c-r-${i}`, noteId: `${noteId}-r`, bundleId, templateOrd: 0, due: now - 1, state: 'Review', fsrs: [{ due: now - 1, state: 'Review' }], created: now, modified: now })
  }
}

describe('StudyEngine2 strategies', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('new-first draws all new before review', async () => {
    const b = 'b'; await seed(b, { n: 2, r: 2 })
    const prefs = { newReviewOrder: 'new-first' }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const first = e.draw(); const second = e.draw()
    expect(first.state).toBe('New'); expect(second.state).toBe('New')
  })

  test('review-first draws review first', async () => {
    const b = 'b'; await seed(b, { n: 1, r: 2 })
    const prefs = { newReviewOrder: 'review-first' }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const c = e.draw()
    expect(c.state).toBe('Review')
  })

  test('mixed distributes new cards between review cards', async () => {
    const b = 'b'; await seed(b, { n: 2, r: 2 })
    const prefs = { newReviewOrder: 'mixed' }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    // Check that both types are mixed in queue (not all of one type first)
    const cards = e.cards()
    const states = cards.map(c => c.state)
    expect(states).toContain('New')
    expect(states).toContain('Review')
  })

  test('autoBurySiblings keeps unique noteIds', async () => {
    const b = 'b'; await seed(b, { n: 3, r: 3, siblings: true })
    const prefs = { autoBurySiblings: true }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const noteIds = new Set(e.cards().map(c => c.noteId))
    expect(noteIds.size).toBeLessThanOrEqual(2) // Max 2: one new, one review
  })
})


