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
    
    const filenames = await anki.findMedia(html)
    expect(filenames).toHaveLength(1)
    expect(filenames[0]).toBe('a.png')
    
    // Add media to database  
    const mediaObject = { [filenames[0]]: blobs[filenames[0]] }
    await mediaManager.add('test-bundle-1', 'test-note-1', mediaObject)
    
    // Verify media reference was stored locally
    const ref = await db.media.where('filename').equals('a.png').first()
    expect(ref.userId).toBe('test-note-1')
    expect(ref.filename).toBe('a.png')
    expect(ref.nvId).toBeTruthy()
  })

  test('add/remove maintains references and cleans up when empty', async () => {
    const html = '<img src="a.png">'
    const blobs = { 'a.png': makeBlob('imgdata', 'image/png') }
    
    const filenames = await anki.findMedia(html)
    const filename = filenames[0]
    
    // Add media with different contexts
    const mediaObject = { [filename]: blobs[filename] }
    await mediaManager.add('test-bundle-1', 'test-note-1', mediaObject)
    await mediaManager.add('test-bundle-1', 0, mediaObject)
    
    // Should have 2 references in local media table
    const count = await db.media.where('filename').equals(filename).count()
    expect(count).toBe(2) // One for note, one for template

    // Remove note reference should keep media (template still using it)
    await mediaManager.remove('test-bundle-1', 'test-note-1', [filename])
    const afterRemove1 = await db.media.where('filename').equals(filename).count()
    expect(afterRemove1).toBe(1) // Template reference remains

    // Remove template reference should delete media (no references left)
    await mediaManager.remove('test-bundle-1', 0, [filename])
    const afterRemove2 = await db.media.where('filename').equals(filename).count()
    expect(afterRemove2).toBe(0) // No references left
  })

  // getStats method removed per coding rules

  test('same content gets deduplicated in OSS regardless of filename', async () => {
    const blobs1 = { 'file1.png': makeBlob('same content', 'image/png') }
    const blobs2 = { 'file2.png': makeBlob('same content', 'image/png') } // Same content, different blob object
    
    const filenames1 = await anki.findMedia('<img src="file1.png">')
    const filenames2 = await anki.findMedia('<img src="file2.png">')
    
    // Add both - should create different local references but same nvId in OSS
    const mediaObject1 = { [filenames1[0]]: blobs1[filenames1[0]] }
    const mediaObject2 = { [filenames2[0]]: blobs2[filenames2[0]] }
    await mediaManager.add('test-bundle-1', 'note1', mediaObject1)
    await mediaManager.add('test-bundle-1', 'note2', mediaObject2)
    
    // Should have 2 local references
    const refs = await db.media.toArray()
    expect(refs).toHaveLength(2)
    
    // But same nvId (content deduplication)
    expect(refs[0].nvId).toBe(refs[1].nvId)
    expect(refs[0].filename).toBe('file1.png')
    expect(refs[1].filename).toBe('file2.png')
  })
})