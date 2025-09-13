import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import mediaManager from '../../../utils/mediaManager.js'
import { processData } from '../AnkiShard.js'

describe('AnkiShard.processData', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('populates metadata.bundleIds using importApkgData return', async () => {
    const parsed = {
      bundles: {
        '123': {
          name: 'Basic',
          flds: [ { name: 'Front' }, { name: 'Back' } ],
          tmpls: [ { name: 'Card 1', qfmt: '{{Front}}', afmt: '{{Front}}<hr>{{Back}}', ord: 0 } ]
        }
      },
      notes: [ { id: 1, mid: '123', flds: ['Q', 'A'], tags: [] } ],
      media: {}
    }
    const shard = { id: 's1', name: 'Test', data: { bundles: [parsed] }, metadata: {} }
    await processData(shard)
    expect(Array.isArray(shard.metadata.bundleIds)).toBe(true)
    expect(shard.metadata.bundleIds.length).toBeGreaterThan(0)
    expect(shard.metadata.totalCards).toBe(1)
  })
})


