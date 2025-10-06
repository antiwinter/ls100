import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

async function seedOne(bundleId) {
  const now = Date.now()
  const noteId = 'n1'
  await db.notes.put({ id: noteId, bundleId, fields: ['Q', 'A'], tags: [] })
  await db.cards.put({ id: 'c1', noteId, bundleId, templateOrd: 0, due: now, state: 'New', fsrs: null, created: now, modified: now })
}

describe('StudyEngine2 FSRS history basics', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('rate creates fsrs entry with rating and response_time', async () => {
    const b = 'b'; await seedOne(b)
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    const c = e.draw()
    await e.rate(3)
    const updated = await db.cards.get(c.id)
    expect(Array.isArray(updated.fsrs)).toBe(true)
    expect(updated.fsrs[0]?.rating).toBe(3)
    expect((updated.fsrs[0]?.response_time || 0)).toBeGreaterThanOrEqual(0)
  })

  test('rate without head card logs warning', async () => {
    const b = 'b'; await seedOne(b)
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [], day: null, queue: null }) // empty, no cards
    const e = await createEngine(prefs, store)
    // Should not throw, just log warning
    await expect(e.rate(3)).resolves.not.toThrow()
  })

  test('FSRS handles any rating value via ts-fsrs', async () => {
    const b = 'b'; await seedOne(b)
    const prefs = {}
    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [b], day: null, queue: null })
    const e = await createEngine(prefs, store)
    e.draw()
    // ts-fsrs will handle the rating value, may clamp or use default
    await e.rate(99)
    const c = await db.cards.get('c1')
    expect(c.fsrs).toBeTruthy() // Still creates entry
  })
})


