import { describe, test, expect, beforeEach } from 'vitest'
import { anki } from '../core/index.js'
import mediaManager from '../core/mediaManager.js'
import db from '../core/db.js'

function makeBlob(content, type = 'text/plain') {
  return new Blob([content], { type })
}

describe('MediaManager', () => {
    beforeEach(async () => {
      // Clear media references in anki db
      await db.media.clear()
      await mediaManager.clear()
    })

  test('findMedia + add workflow handles filenames', async () => {
    const html = '<img src="a.png">'
    const blobs = { 'a.png': makeBlob('imgdata', 'image/png') }
    
    const result = await anki.findMedia(html, blobs)
    expect(result.media).toHaveLength(1)
    expect(result.media[0].filename).toBe('a.png')
    expect(result.media[0].blob).toBeTruthy()
    
    // Add media to database  
    await mediaManager.add(result.media, { noteId: 'test-note-1' })
    
    // Verify media reference was stored locally
    const ref = await db.media.where('filename').equals('a.png').first()
    expect(ref.noteId).toBe('test-note-1')
    expect(ref.filename).toBe('a.png')
    expect(ref.nvId).toBeTruthy()
  })

  test('add/remove maintains references and cleans up when empty', async () => {
    const html = '<img src="a.png">'
    const blobs = { 'a.png': makeBlob('imgdata', 'image/png') }
    
    const result = await anki.findMedia(html, blobs)
    const filename = result.media[0].filename
    
    // Add media with different contexts
    await mediaManager.add(result.media, { noteId: 'test-note-1' })
    await mediaManager.add(result.media, { bundleId: 'test-bundle-1', templateOrd: 0 })
    
    // Should have 2 references in local media table
    const count = await db.media.where('filename').equals(filename).count()
    expect(count).toBe(2) // One for note, one for template

    // Remove note reference should keep media (template still using it)
    await mediaManager.remove([filename], { noteId: 'test-note-1' })
    const afterRemove1 = await db.media.where('filename').equals(filename).count()
    expect(afterRemove1).toBe(1) // Template reference remains

    // Remove template reference should delete media (no references left)
    await mediaManager.remove([filename], { bundleId: 'test-bundle-1', templateOrd: 0 })
    const afterRemove2 = await db.media.where('filename').equals(filename).count()
    expect(afterRemove2).toBe(0) // No references left
  })

  test('getStats returns categorized media statistics', async () => {
    const blobs = {
      'image.png': makeBlob('imgdata', 'image/png'),
      'audio.mp3': makeBlob('audiodata', 'audio/mpeg')
    }
    
    const result1 = await anki.findMedia('<img src="image.png">', blobs)
    const result2 = await anki.findMedia('[sound:audio.mp3]', blobs)
    
    await mediaManager.add([...result1.media, ...result2.media], { noteId: 'test-note' })
    
    const stats = await mediaManager.getStats()
    expect(stats.uniqueMediaCount).toBe(2)
    expect(stats.totalReferences).toBe(2)
    expect(stats.mediaList).toHaveLength(2)
  })

  test('same content gets deduplicated in OSS regardless of filename', async () => {
    const blob1 = makeBlob('same content', 'image/png')
    const blob2 = makeBlob('same content', 'image/png') // Same content, different blob object
    
    const result1 = await anki.findMedia('<img src="file1.png">', { 'file1.png': blob1 })
    const result2 = await anki.findMedia('<img src="file2.png">', { 'file2.png': blob2 })
    
    // Add both - should create different local references but same nvId in OSS
    await mediaManager.add(result1.media, { noteId: 'note1' })
    await mediaManager.add(result2.media, { noteId: 'note2' })
    
    // Should have 2 local references
    const refs = await db.media.toArray()
    expect(refs).toHaveLength(2)
    
    // But same nvId (content deduplication)
    expect(refs[0].nvId).toBe(refs[1].nvId)
    expect(refs[0].filename).toBe('file1.png')
    expect(refs[1].filename).toBe('file2.png')
  })
})