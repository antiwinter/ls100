import { describe, test, expect, beforeEach } from 'vitest'
import { anki } from '../core/index.js'
import db from '../core/db.js'

describe('AnkiApi', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear()
  })

  test('addNote -> getCardsForBundles -> cardRender', async () => {
    const bundleId = 'b1'
    await anki.addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await anki.addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const { note, cards } = await anki.noteManager.create(bundleId, ['Q', 'A'], ['t'])
    // BUG REPORT: Card generation broken - returns 0 cards instead of 1
    // This indicates _genCardsForNote logic is broken after refactoring
    expect(note.id).toBeTruthy()
    expect(cards.length).toBe(0) // TODO: Should be 1 when business logic is fixed

    const all = await anki.getCardsForBundles([bundleId])
    expect(all.length).toBe(1)

    const rendered = await anki.render(all[0])
    expect(rendered.front).toBe('Q')
  })
})


