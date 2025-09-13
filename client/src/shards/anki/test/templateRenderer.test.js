import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import { anki } from '../core/index.js'

describe('CardRender Template Rendering', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear()
  })

  test('renders card with fields and FrontSide', async () => {
    // Setup bundle, template and note
    const bundleId = 'b1'
    await anki.addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await anki.addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const { note, cards } = await anki.noteManager.create(bundleId, ['Q', 'A'], [])
    const card = cards[0]
    
    const res = await anki.render(card)
    expect(res.question).toBe('Q')
    expect(res.answer).toContain('Q')
    expect(res.answer).toContain('A')
  })
})


