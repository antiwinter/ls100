import { describe, test, expect, beforeEach } from 'vitest'
import { addBundle, addTemplate, getCardsForBundles } from '../core/api.js'
import { render } from '../core/renderDefault.js'
import { create } from '../core/noteManager.js'
import db from '../storage/db'

describe('AnkiApi', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('addNote -> getCardsForBundles -> cardRender', async () => {
    const bundleId = 'b1'
    await addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const { note, cards } = await create(bundleId, ['Q', 'A'], ['t'])
    expect(note.id).toBeTruthy(); expect(cards.length).toBe(1)

    const all = await getCardsForBundles([bundleId])
    expect(all.length).toBe(1)

    const rendered = await render(all[0])
    expect(rendered.question).toBe('Q')
  })
})


