import { describe, test, expect, beforeEach } from 'vitest'
import db from '../core/db.js'
import { anki } from '../core/index.js'
import mediaManager from '../core/mediaManager.js'

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

    // Fetch stored template and get nvId from media references (render-time cooking)
    const [tp] = await anki.getTemplates(bid)
    expect(tp.qfmt).toContain('a.png') // Raw filename stored
    
    // Get nvId from media references table
    const mediaRefs = await db.media.where('bundleId').equals(bid)
      .and(ref => ref.filename === 'a.png').toArray()
    expect(mediaRefs.length).toBeGreaterThan(0)
    const nvId = mediaRefs[0].nvId

    // Create a note that references the same media filename (raw)
    const fieldWithMedia = '<img src="a.png">' 
    const { note } = await anki.noteManager.create(bid, [fieldWithMedia], [], blobs)

    // Now remove the template; media is still referenced by the note
    await anki.removeTemplate(tp)

    // EXPECTATION: media reference should still exist (note still using it)
    const ref = await db.media.where('nvId').equals(nvId)
      .and(mediaRef => mediaRef.userId === note.id).first()
    expect(ref).toBeTruthy()
    expect(ref.userId).toBe(note.id)
  })

  test('media is deleted when no instances reference it anymore (template and note removed)', async () => {
    const bid = 'b-refcount-none'
    await anki.addBundle(bid, 'B', ['F'])

    const blobs = { 'a.png': makeBlob('a', 'image/png') }
    const qfmt = '<img src="a.png">'
    await anki.addTemplate(bid, 't', qfmt, '{{F}}', blobs)
    const [tp] = await anki.getTemplates(bid)

    // Get nvId from media references (render-time cooking approach)
    expect(tp.qfmt).toContain('a.png') // Raw filename stored
    const mediaRefs = await db.media.where('bundleId').equals(bid)
      .and(ref => ref.filename === 'a.png').toArray()
    expect(mediaRefs.length).toBeGreaterThan(0)
    const nvId = mediaRefs[0].nvId

    // Create a note referencing same media filename (raw)
    const fieldWithMedia = '<img src="a.png">'
    const { note } = await anki.noteManager.create(bid, [fieldWithMedia], [], blobs)

    // Remove template first (decrement)
    await anki.removeTemplate(tp)
    // Remove the note (decrement)
    await anki.noteManager.delete(note)

    // Verify no media references remain
    const remaining = await db.media.where('nvId').equals(nvId).count()
    expect(remaining).toBe(0)
  })
})


