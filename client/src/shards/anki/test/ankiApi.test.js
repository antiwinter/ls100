import { describe, test, expect, beforeEach } from 'vitest'
import { ankiApi, cardRender } from '../core'
import db from '../storage/db'

describe('AnkiApi', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('addNote -> getCardsForBundles -> cardRender', async () => {
    const bundleId = 'b1'
    await ankiApi.addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await ankiApi.addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const { note, cards } = await ankiApi.addNote(bundleId, ['Q', 'A'], ['t'])
    expect(note.id).toBeTruthy(); expect(cards.length).toBe(1)

    const all = await ankiApi.getCardsForBundles([bundleId])
    expect(all.length).toBe(1)

    const rendered = await cardRender.render(all[0])
    expect(rendered.question).toBe('Q')
  })
})


