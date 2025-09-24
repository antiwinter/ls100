import { describe, test, expect, beforeEach } from 'vitest'
import { proxy } from 'valtio'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { StudyEngine } from '../core/studyEngine.js'

function store(init = {}) {
  return proxy({
    bundleIds: [], newCardOrder: 'gather', newReviewOrder: 'mixed',
    autoBurySiblings: false, maxNewCards: 9999, maxReviewCards: 9999,
    timeSegments: [], actionLog: [], pile: { new: [], review: [], done: [] }, day: 0, currentCard: null,
    ...init,
    
    // Mock session methods
    start() { return true },
    finish() {},
    updateHistory: () => {},
    getCurrentDay() { return Math.floor(Date.now() / (1000 * 60 * 60 * 24)) },
    setPreferences(pref) {
      Object.assign(this, pref || {})
    }
  })
}

async function seedOne(bundleId) {
  const now = Date.now()
  const noteId = 'n1'
  await db.notes.put({ id: noteId, bundleId, fields: ['Q', 'A'], tags: [] })
  await db.cards.put({ id: 'c1', noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine FSRS history basics', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('rate creates fsrs entry with rating and response_time', async () => {
    const b = 'b'; await seedOne(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    const c = e.draw()
    await e.rate(3)
    const updated = await db.cards.get(c.id)
    expect(Array.isArray(updated.fsrs)).toBe(true)
    expect(updated.fsrs[0]?.rating).toBe(3)
    expect((updated.fsrs[0]?.response_time || 0)).toBeGreaterThanOrEqual(0)
  })

  test('rate without current card throws', async () => {
    const b = 'b'; await seedOne(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    await expect(e.rate(3)).rejects.toThrow(/No active card/i)
  })

  test('invalid rating value throws (out-of-range)', async () => {
    const b = 'b'; await seedOne(b)
    const st = store({ bundleIds: [b] })
    const e = new StudyEngine(); await e.init(st)
    e.draw()
    await expect(e.rate(99)).rejects.toThrow()
  })
})


