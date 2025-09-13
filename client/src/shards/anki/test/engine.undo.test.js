import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../../../utils/mediaManager.js'
import { StudyEngine } from '../core/studyEngine.js'

function store(init = {}) {
  let s = {
    bundleIds: [], newCardOrder: 'gather', newReviewOrder: 'mixed',
    autoBurySiblings: false, maxNewCards: 9999, maxReviewCards: 9999,
    timeSegments: [], actionLog: [], pile: { new: [], review: [], done: [] }, day: 0, currentCard: null,
    ...init
  }
  return { start() {}, finish() {}, getState: () => s, updateTimeSegments: v => { s.timeSegments = v }, updateHistory: () => {}, setState: v => { s = { ...s, ...v } } }
}

async function seedSimple(bundleId) {
  const now = Date.now()
  const noteId1 = 'n1'
  const noteId2 = 'n2'
  await db.notes.put({ id: noteId1, bundleId, fields: ['f'], tags: [] })
  await db.notes.put({ id: noteId2, bundleId, fields: ['f'], tags: [] })
  await db.cards.put({ id: 'c1', noteId: noteId1, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c2', noteId: noteId2, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine.undo', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('returns null when insufficient actions', async () => {
    const b = 'b'; await seedSimple(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    e.draw() // one draw
    const res = await e.undo()
    expect(res).toBeNull()
  })

  test('undo one card restores current card (avoid fragile FSRS invariants)', async () => {
    const b = 'b'; await seedSimple(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    const card1 = e.draw()
    await e.rate(3)
    e.draw() // draw next
    const restored = await e.undo()
    expect(restored?.id).toBe(card1.id)
    expect(st.getState().currentCard?.id).toBe(card1.id)
  })
})


