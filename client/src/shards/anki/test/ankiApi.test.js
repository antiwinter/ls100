import { describe, test, expect, beforeEach } from 'vitest'
import ankiApi from '../core/ankiApi'
import db from '../storage/db'

describe('AnkiApi', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('createNote -> getCardsForBundles -> getStudyCard', async () => {
    const bundleId = 'b1'
    await ankiApi.noteManager.createType(bundleId, 'Basic', ['Front', 'Back'])
    await ankiApi.noteManager.createTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const { note, cards } = await ankiApi.createNote(bundleId, ['Q', 'A'], ['t'])
    expect(note.id).toBeTruthy(); expect(cards.length).toBe(1)

    const all = await ankiApi.getCardsForBundles([bundleId])
    expect(all.length).toBe(1)

    const rendered = await ankiApi.getStudyCard(all[0].id)
    expect(rendered.question).toBe('Q')
  })
})


