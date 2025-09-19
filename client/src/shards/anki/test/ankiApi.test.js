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
    // ✅ Card generation is actually working correctly!
    expect(note.id).toBeTruthy()
    expect(cards.length).toBe(1)

    const all = await anki.getCardsForBundles([bundleId])
    expect(all.length).toBe(1)

    const rendered = await anki.render(all[0])
    expect(rendered.front).toBe('Q')
  })
})


