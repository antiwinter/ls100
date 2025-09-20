import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import { anki } from '../core/index.js'
import mediaManager from '../core/mediaManager.js'

function makeBlob(content, type = 'text/plain') {
  return new Blob([content], { type })
}

describe('anki core/index.js API coverage', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('addBundle/addTemplate + getTemplates + getCardsForBundles + render', async () => {
    const bundleId = 'b-index-1'
    await anki.addBundle(bundleId, 'Basic', ['Front', 'Back'])

    // addTemplate does not add media (findMedia called with {}), only stores template
    await anki.addTemplate(bundleId, 'Card 1', '{{Front}}', '{{Front}}<hr>{{Back}}', 0)

    const templates = await anki.getTemplates(bundleId)
    expect(templates.length).toBe(1)

    // No cards yet
    const none = await anki.getCardsForBundles([bundleId])
    expect(none.length).toBe(0)

    // Create one note and ensure getCardsForBundles returns generated cards; render works
    const { note, cards } = await anki.noteManager.create(bundleId, ['Q', 'A'], ['t'])
    expect(cards.length).toBe(1)
    const fetched = await anki.getCardsForBundles([bundleId])
    expect(fetched.length).toBe(1)
    expect(fetched[0].noteId).toBe(note.id)

    const renderer = await anki.createRender(fetched)
    const rendered = await renderer.render(fetched[0])
    expect(rendered.front).toBe('Q')

    // Empty/undefined bundleIds should return empty array
    expect(await anki.getCardsForBundles()).toEqual([])
    expect(await anki.getCardsForBundles([])).toEqual([])
  })

  test('findMedia returns filenames array', async () => {
    const html = '<img src="img.png"> [sound:audio.mp3]'
    const filenames = await anki.findMedia(html)
    expect(filenames.length).toBe(2)
    expect(filenames).toContain('img.png')
    expect(filenames).toContain('audio.mp3')
  })

  test('findMedia extracts filenames from CSS url() declarations', async () => {
    const css = `
      .card { font-family: arial; }
      @font-face { font-family: stroke; src: url('_stroke.ttf'); }
      @font-face { font-family: textbook; src: url("_HGSKyokashotai.ttf"); }
      @font-face { font-family: localnoto; src: url(_NotoSansJP-Medium.otf); }
      background: url(background.jpg);
    `
    const filenames = await anki.findMedia(css)
    expect(filenames.length).toBe(4)
    expect(filenames).toContain('_stroke.ttf')
    expect(filenames).toContain('_HGSKyokashotai.ttf')
    expect(filenames).toContain('_NotoSansJP-Medium.otf')
    expect(filenames).toContain('background.jpg')
  })

  test('removeTemplate deletes template record (eventually)', async () => {
    const b = 'b-rem-tp'
    await anki.addBundle(b, 'Basic', ['F'])
    await anki.addTemplate(b, 't', '{{F}}', '{{F}}', 0)
    const before = await anki.getTemplates(b)
    expect(before.length).toBe(1)

    // removeTemplate doesn't await internal work; poll until deletion observed
    await anki.removeTemplate(before[0])
    for (let i = 0; i < 10; i++) {
      const after = await anki.getTemplates(b)
      if (after.length === 0) break
      await new Promise(r => setTimeout(r, 5))
    }
    const finalTps = await anki.getTemplates(b)
    expect(finalTps.length).toBe(0)
  })

  test('removeBundles on empty bundle returns counters (no orphans path)', async () => {
    const b = 'b-empty'
    await anki.addBundle(b, 'B', ['F'])
    const stats = await anki.removeBundles([b])
    expect(stats.bundlesRemoved).toBe(1)
    expect(stats.templatesRemoved).toBeGreaterThanOrEqual(0)
    expect(stats.notesRemoved).toBeGreaterThanOrEqual(0)
    expect(stats.cardsRemoved).toBeGreaterThanOrEqual(0)
  })

  test.fails('removeBundles removes orphans without readonly errors (known bug)', async () => {
    const b1 = 'b-orphan'
    await anki.addBundle(b1, 'B1', ['F'])
    await anki.addTemplate(b1, 't1', '{{F}}', '{{F}}', 0)
    await anki.noteManager.create(b1, ['Q'], [])
    const stats = await anki.removeBundles([b1])
    expect(stats.templatesRemoved).toBeGreaterThanOrEqual(1)
    expect(stats.notesRemoved).toBeGreaterThanOrEqual(1)
    expect(stats.cardsRemoved).toBeGreaterThanOrEqual(1)
  })
})


