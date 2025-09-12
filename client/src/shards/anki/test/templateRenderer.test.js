import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import { render } from '../core/renderDefault'
import { addBundle, addTemplate } from '../core/api.js'
import { create } from '../core/noteManager.js'

describe('CardRender Template Rendering', () => {
  beforeEach(async () => {
    await db.notes.clear(); await db.bundles.clear(); await db.templates.clear(); await db.cards.clear(); await db.media.clear()
  })

  test('renders card with fields and FrontSide', async () => {
    // Setup bundle, template and note
    const bundleId = 'b1'
    await addBundle(bundleId, 'Basic', ['Front', 'Back'])
    await addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)
    
    const { note, cards } = await create(bundleId, ['Q', 'A'], [])
    const card = cards[0]
    
    const res = await render(card)
    expect(res.question).toBe('Q')
    expect(res.answer).toContain('Q')
    expect(res.answer).toContain('A')
  })
})


