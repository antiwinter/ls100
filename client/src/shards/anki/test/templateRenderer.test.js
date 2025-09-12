import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import cardRender from '../core/renderDefault'
import { ankiApi } from '../core'

describe('CardRender Template Rendering', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('renders card with fields and FrontSide', async () => {
    // Setup bundle, template and note
    const bundleId = 'b1'
    await ankiApi.addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await ankiApi.addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)
    
    const { note, cards } = await ankiApi.addNote(bundleId, ['Q', 'A'], [])
    const card = cards[0]
    
    const res = await cardRender.render(card)
    expect(res.question).toBe('Q')
    expect(res.answer).toContain('Q')
    expect(res.answer).toContain('A')
  })
})


