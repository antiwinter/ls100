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
    setPreferences(pref) {
      Object.assign(this, pref || {})
    }
  })
}

async function seedWithTemplateOrd(bundleId) {
  const now = Date.now()
  const noteId = 'n1'
  await db.notes.put({ id: noteId, bundleId, fields: ['f'], tags: [] })
  await db.cards.put({ id: 'c0', noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c1', noteId, bundleId, templateOrd: 1, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c2', noteId, bundleId, templateOrd: 2, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine new card ordering', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('gather preserves original order (no shuffle)', async () => {
    const b = 'b'; await seedWithTemplateOrd(b)
    const st = store({ bundleIds: [b], newCardOrder: 'gather' })
    const e = new StudyEngine(); await e.init(st)
    expect(st.pile.raw.map(c => c.id)).toEqual(['c0', 'c1', 'c2'])
  })

  test('template-random groups by templateOrd', async () => {
    const b = 'b'; await seedWithTemplateOrd(b)
    const st = store({ bundleIds: [b], newCardOrder: 'template-random' })
    const e = new StudyEngine(); await e.init(st)
    const ords = st.pile.raw.map(c => c.templateOrd)
    expect(new Set(ords)).toEqual(new Set([0,1,2]))
  })
})








