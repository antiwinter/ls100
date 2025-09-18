import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import { anki } from '../core/index.js'
import mediaManager from '../../../utils/oss.js'

function makeBlob(content, type = 'text/plain') {
  return new Blob([content], { type })
}

describe('MediaManager users edge cases', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('media still referenced by a note should not be deleted when template is removed (users should not be empty)', async () => {
    const bid = 'b-refcount-still-used'
    await anki.addBundle(bid, 'B', ['F'])

    // Create template with raw media (ensures media blob stored, template as user)
    const blobs = { 'a.png': makeBlob('a', 'image/png') }
    const qfmt = '<img src="a.png">'
    await anki.addTemplate(bid, 't', qfmt, '{{F}}', blobs)

    // Fetch stored template and resolve nvId from cooked qfmt
    const [tp] = await anki.getTemplates(bid)
    const nvIdMatch = tp.qfmt.match(/\/media\/([a-zA-Z0-9-_]+)/)
    expect(nvIdMatch).toBeTruthy()
    const nvId = nvIdMatch[1]

    // Create a note that still references the same cooked media (no blobs provided)
    const cookedField = tp.qfmt // contains /media/<nvId>
    await anki.noteManager.create(bid, [cookedField], [])

    // Now remove the template; media is still referenced by the note
    await anki.removeTemplate(tp)

    // EXPECTATION: media record should still exist (users should contain note)
    const Dexie = (await import('dexie')).default
    const mediaDb = new Dexie('OssDB')
    mediaDb.version(1).stores({ media: 'id, type, created' })
    const stored = await mediaDb.media.get(nvId)
    expect(stored).toBeTruthy()
    expect(stored?.users || []).toContain(note.id)
  })

  test('media is deleted when no instances reference it anymore (template and note removed)', async () => {
    const bid = 'b-refcount-none'
    await anki.addBundle(bid, 'B', ['F'])

    const blobs = { 'a.png': makeBlob('a', 'image/png') }
    const qfmt = '<img src="a.png">'
    await anki.addTemplate(bid, 't', qfmt, '{{F}}', blobs)
    const [tp] = await anki.getTemplates(bid)

    // Extract nvId
    const nvIdMatch = tp.qfmt.match(/\/media\/([a-zA-Z0-9-_]+)/)
    const nvId = nvIdMatch && nvIdMatch[1]

    // Create a note referencing same cooked media
    const cookedField = tp.qfmt
    const { note } = await anki.noteManager.create(bid, [cookedField], [])

    // Remove template first (decrement)
    await anki.removeTemplate(tp)
    // Remove the note (decrement)
    await anki.noteManager.delete(note)

    // Verify the media record is gone
    const Dexie = (await import('dexie')).default
    const mediaDb = new Dexie('OssDB')
    mediaDb.version(1).stores({ media: 'id, type, created' })
    const stored = await mediaDb.media.get(nvId)
    expect(stored).toBeUndefined()
  })
})


