import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

async function seedSimple(bundleId) {
  const now = Date.now()
  const noteId1 = 'n1'
  const noteId2 = 'n2'
  await db.notes.put({ id: noteId1, bundleId, fields: ['f'], tags: [] })
  await db.notes.put({ id: noteId2, bundleId, fields: ['f'], tags: [] })
  await db.cards.put({ id: 'c1', noteId: noteId1, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c2', noteId: noteId2, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine2.undo', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('returns null when no actions to undo', async () => {
    const b = 'b'; await seedSimple(b)
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    e.draw() // just draw, no rate
    const res = await e.undo()
    expect(res).toBeNull()
  })

  test('undo reverts last rated card and moves it back to front', async () => {
    const b = 'b'; await seedSimple(b)
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const card1 = e.draw()
    await e.rate(3)
    const restored = await e.undo()
    expect(restored?.id).toBe(card1.id)
    expect(e.head()?.id).toBe(card1.id)
  })
})


