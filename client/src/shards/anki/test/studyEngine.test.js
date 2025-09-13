import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../../../utils/mediaManager.js'
import { StudyEngine } from '../core/studyEngine.js'

// Minimal session store mock matching useAnkiSessionStore API
function createSessionStore(initial = {}) {
  let state = {
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
    ...initial
  }
  return {
    start() {},
    finish() {},
    getState: () => state,
    updateTimeSegments: (segments) => { state.timeSegments = segments },
    updateHistory: () => {},
    setState: (partial) => { state = { ...state, ...partial } }
  }
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

  test('init builds queues and draw selects a card', async () => {
    const bundleId = 'b1'
    await seedCards(bundleId, { new: 2, review: 2 })
    const session = createSessionStore({ bundleIds: [bundleId] })
    const engine = new StudyEngine()
    await engine.init(session)
    const ss = session.getState()
    expect(ss.pile.new.length + ss.pile.review.length).toBeGreaterThan(0)
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


