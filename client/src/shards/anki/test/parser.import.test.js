import { describe, test, expect, beforeEach } from 'vitest'
import { anki } from '../core/index.js'
import db from '../core/db.js'
import mediaManager from '../../../utils/mediaManager.js'
import { importApkgData } from '../apkg/index.js'

describe('importApkgData', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('should create bundles, templates, notes and return stats', async () => {
    const parsed = {
      bundles: {
        '123': {
          name: 'Basic',
          flds: [ { name: 'Front' }, { name: 'Back' } ],
          tmpls: [
            { name: 'Card 1', qfmt: '{{Front}}', afmt: '{{Front}}<hr>{{Back}}', ord: 0 }
          ]
        }
      },
      notes: [
        { id: 1, mid: '123', flds: ['Q1', 'A1'], tags: [] }
      ],
      media: {}
    }

    const res = await importApkgData(parsed)

    expect(Array.isArray(res.bundleIds)).toBe(true)
    expect(res.bundles).toBe(1)
    expect(res.notes).toBe(1)
    expect(res.cards).toBe(1)

    const cards = await anki.getCardsForBundles(res.bundleIds)
    expect(cards.length).toBe(1)
    expect(cards[0].state).toBe('New')
  })
})


