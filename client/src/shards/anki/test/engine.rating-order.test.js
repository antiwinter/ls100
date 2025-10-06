import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { createEngine } from '../core/studyEngine2.js'
import { AnkiSessionStore } from '../core/sessionStore.js'

let testCounter = 0

describe('StudyEngine2 rating and queue order', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('rated card should be placed after cards with older due dates', async () => {
    const bundleId = 'b1'
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000
    
    // Create a note
    await db.notes.put({
      id: 'n1',
      bundleId,
      fields: ['Q1', 'A1'],
      tags: []
    })

    // Card 1: Due yesterday (old), will be in queue head after rating
    await db.cards.put({
      id: 'c1',
      noteId: 'n1',
      bundleId,
      templateOrd: 0,
      due: yesterday,
      state: 'Review',
      fsrs: [{
        due: yesterday,
        state: 'Review',
        stability: 5,
        difficulty: 5
      }],
      created: now,
      modified: now
    })

    // Card 2: Due yesterday (will be rated as AGAIN)
    await db.cards.put({
      id: 'c2',
      noteId: 'n1',
      bundleId,
      templateOrd: 1,
      due: yesterday - 1000, // Slightly older
      state: 'Review',
      fsrs: [{
        due: yesterday - 1000,
        state: 'Review',
        stability: 5,
        difficulty: 5
      }],
      created: now,
      modified: now
    })

    const store = AnkiSessionStore(`test-${++testCounter}`)
    store.setState({ bundleIds: [bundleId], day: null, queue: null })
    const e = await createEngine({}, store)

    // Initial queue: [c2 (older), c1 (newer), null]
    expect(e.cards().length).toBe(2)
    expect(e.head().id).toBe('c2')

    // Rate c2 as AGAIN (rating 1)
    // This should schedule it for soon (e.g., 1-10 minutes from now)
    e.draw()
    await e.rate(1)

    // After rating, c2 should have a due date in the FUTURE (now + few minutes)
    // So it should be AFTER c1 (which is still due yesterday)
    const queueAfter = e.cards()
    console.log('Queue after rating:', queueAfter.map(c => ({
      id: c.id,
      due: new Date(c.due).toISOString(),
      fsrsDue: c.fsrs[0] ? new Date(c.fsrs[0].due).toISOString() : null
    })))

    // c1 should now be at the head (older due date)
    expect(e.head().id).toBe('c1')
    
    // c2 should be after c1 in the queue
    const c2Index = queueAfter.findIndex(c => c.id === 'c2')
    const c1Index = queueAfter.findIndex(c => c.id === 'c1')
    expect(c2Index).toBeGreaterThan(c1Index)
  })
})
