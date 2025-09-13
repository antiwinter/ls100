import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../../../utils/mediaManager.js'
import { importApkgData } from '../apkg/import.js'

describe('APKG import options', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await mediaManager.clear()
  })

  test('preserveScheduling=true stores fsrs history and mirrors due/state', async () => {
    const parsed = {
      bundles: {
        'm1': { name: 'Basic', flds: [{ name: 'Front' }, { name: 'Back' }], tmpls: [{ name: 'Card 1', qfmt: '{{Front}}', afmt: '{{Back}}', ord: 0 }] }
      },
      notes: [{ id: 1, mid: 'm1', flds: ['Q', 'A'], tags: '' }],
      cards: [{ id: 10, nid: 1, ord: 0, due: 1, type: 1 }],
      reviewHistory: { 10: [{ rating: 3, response_time: 1000, due: Date.now()+1000, state: 'Review', stability: 1, difficulty: 1, elapsed_days: 0, scheduled_days: 0, reps: 1, lapses: 0, last_review: new Date().toISOString() }] },
      media: {}
    }
    const res = await importApkgData(parsed, { preserveScheduling: true })
    const cards = await db.cards.where('bundleId').anyOf(res.bundleIds).toArray()
    expect(cards.length).toBe(1)
    expect(Array.isArray(cards[0].fsrs)).toBe(true)
    expect(cards[0].state).toBeTruthy()
    expect(cards[0].due).toBeTruthy()
  })

  test('invalid template format throws', async () => {
    const parsed = {
      bundles: { 'm1': { name: 'X', flds: [{ name: 'F' }], tmpls: [{ name: 't', qfmt: 123, afmt: 'a', ord: 0 }] } },
      notes: [], media: {}
    }
    await expect(importApkgData(parsed)).rejects.toThrow(/Invalid template format/i)
  })
})


