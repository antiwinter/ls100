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
    
    // ✅ CORRECTED: Use proper anki rendering API
    const renderer = await anki.createRender([card])
    const res = await renderer.render(card)
    expect(res.front).toBe('Q')
    expect(res.back).toContain('Q')
    expect(res.back).toContain('A')
  })
})


