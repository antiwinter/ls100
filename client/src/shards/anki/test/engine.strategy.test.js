import { describe, test, expect, beforeEach, vi } from 'vitest'
import db from '../storage/db'
import { StudyEngine } from '../engine/studyEngine.js'

function store(init = {}) {
  let s = {
    bundleIds: [], newCardOrder: 'gather', newReviewOrder: 'mixed',
    autoBurySiblings: true, maxNewCards: 9999, maxReviewCards: 9999,
    timeSegments: [], actionLog: [], pile: { new: [], review: [], done: [] }, day: 0, currentCard: null,
    ...init
  }
  return { start() {}, finish() {}, getState: () => s, updateTimeSegments: v => { s.timeSegments = v }, updateHistory: () => {}, setState: v => { s = { ...s, ...v } } }
}

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

describe('StudyEngine strategies', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('new-first draws all new before review', async () => {
    const b = 'b'; await seed(b, { n: 2, r: 2 })
    const st = store({ bundleIds: [b], newReviewOrder: 'new-first' })
    const e = new StudyEngine(); await e.init(st)
    const first = e.draw(); const second = e.draw()
    expect(first.state).toBe('New'); expect(second.state).toBe('New')
  })

  test('review-first draws review first', async () => {
    const b = 'b'; await seed(b, { n: 1, r: 2 })
    const st = store({ bundleIds: [b], newReviewOrder: 'review-first' })
    const e = new StudyEngine(); await e.init(st)
    const c = e.draw()
    expect(c.state).toBe('Review')
  })

  test('mixed uses ratio via Math.random', async () => {
    const b = 'b'; await seed(b, { n: 1, r: 1 })
    const st = store({ bundleIds: [b], newReviewOrder: 'mixed' })
    const e = new StudyEngine(); await e.init(st)
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.0) // force new
    const c = e.draw(); spy.mockRestore()
    expect(c.state).toBe('New')
  })

  test('autoBurySiblings keeps unique noteIds', async () => {
    const b = 'b'; await seed(b, { n: 3, r: 3, siblings: true })
    const st = store({ bundleIds: [b], autoBurySiblings: true })
    const e = new StudyEngine(); await e.init(st)
    const s = st.getState()
    const noteIdsNew = new Set(s.pile.new.map(c => c.noteId))
    const noteIdsRev = new Set(s.pile.review.map(c => c.noteId))
    expect(noteIdsNew.size).toBeLessThanOrEqual(1)
    expect(noteIdsRev.size).toBeLessThanOrEqual(1)
  })
})


