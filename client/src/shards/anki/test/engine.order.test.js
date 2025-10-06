import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

async function seedWithTemplateOrd(bundleId) {
  const now = Date.now()
  const noteId = 'n1'
  await db.notes.put({ id: noteId, bundleId, fields: ['f'], tags: [] })
  await db.cards.put({ id: 'c0', noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c1', noteId, bundleId, templateOrd: 1, due: now, state: 'New', fsrs: null, created: now, modified: now })
  await db.cards.put({ id: 'c2', noteId, bundleId, templateOrd: 2, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine2 new card ordering', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('gather preserves original order (no shuffle)', async () => {
    const b = 'b'; await seedWithTemplateOrd(b)
    const prefs = { newCardOrder: 'gather' }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    expect(e.cards().map(c => c.id)).toEqual(['c0', 'c1', 'c2'])
  })

  test('template-random groups by templateOrd', async () => {
    const b = 'b'; await seedWithTemplateOrd(b)
    const prefs = { newCardOrder: 'template-random' }
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const ords = e.cards().map(c => c.templateOrd)
    expect(new Set(ords)).toEqual(new Set([0,1,2]))
  })
})








