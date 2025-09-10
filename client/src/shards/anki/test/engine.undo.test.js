import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import { StudyEngine } from '../engine/studyEngine.js'

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
  const noteId = 'n1'
  await db.notes.put({ id: noteId, bundleId, fields: ['f'], tags: [] })
  await db.cards.put({ id: 'c1', noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine.undo', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('returns null when insufficient actions', async () => {
    const b = 'b'; await seedSimple(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    e.draw() // one draw
    const res = await e.undo()
    expect(res).toBeNull()
  })
})


