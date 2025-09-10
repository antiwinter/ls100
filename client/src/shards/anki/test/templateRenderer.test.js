import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import TemplateRenderer from '../core/templateEngine'

describe('TemplateRenderer', () => {
  beforeEach(async () => {
    await db.media.clear()
  })

  test('replaces fields and FrontSide', async () => {
    const bundle = { fields: [{ name: 'Front' }, { name: 'Back' }] }
    const renderer = new TemplateRenderer(bundle)
    const template = { qfmt: '{{Front}}', afmt: '{{Front}}<hr>{{Back}}' }
    const res = await renderer.render(template, ['Q', 'A'], 'b1')
    expect(res.question).toBe('Q')
    expect(res.answer).toContain('Q')
    expect(res.answer).toContain('A')
  })
})


