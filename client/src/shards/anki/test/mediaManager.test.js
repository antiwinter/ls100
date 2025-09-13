import { describe, test, expect, beforeEach } from 'vitest'
import { anki } from '../core/index.js'
import mediaManager from '../../../utils/mediaManager.js'

function makeBlob(content, type = 'text/plain') {
  return new Blob([content], { type })
}

describe('MediaManager', () => {
  beforeEach(async () => {
    // Clear media database (separate from anki db now)
    const mediaDb = new (await import('dexie')).default('MediaDB')
    mediaDb.version(1).stores({ media: 'id, type, refCount, created' })
    await mediaDb.media.clear()
  })

  test('parseFields + add workflow maps filenames to nvIds', async () => {
    const html = '<img src="a.png">'
    const blobs = { 'a.png': makeBlob('imgdata', 'image/png') }
    
    // Parse fields to get cooked content and media
    const result = await anki.parseFields(html, blobs)
    
    expect(result.cooked).toMatch(/src="\/media\//)
    expect(result.media).toHaveLength(1)
    expect(result.media[0].nvId).toBeTruthy()
    expect(result.media[0].filename).toBe('a.png')
    
    // Add media to database
    await mediaManager.add(result.media)
    
    // Verify media was stored with refCount = 1
    const mediaDb = new (await import('dexie')).default('MediaDB')
    mediaDb.version(1).stores({ media: 'id, type, refCount, created' })
    const stored = await mediaDb.media.get(result.media[0].nvId)
    expect(stored.refCount).toBe(1)
    expect(stored.type).toBe('image/png')
  })

  test('add/remove maintains refCounts and cleans up at 0', async () => {
    const html = '<img src="a.png">'
    const blobs = { 'a.png': makeBlob('imgdata', 'image/png') }
    
    const result = await anki.parseFields(html, blobs)
    const nvId = result.media[0].nvId
    
    // Add media twice
    await mediaManager.add(result.media)
    await mediaManager.add(result.media)
    
    // Should have refCount = 2
    const mediaDb = new (await import('dexie')).default('MediaDB')
    mediaDb.version(1).stores({ media: 'id, type, refCount, created' })
    const afterAdd = await mediaDb.media.get(nvId)
    expect(afterAdd.refCount).toBe(2)

    // Remove once should decrement to 1
    await mediaManager.remove([nvId])
    const afterRemove1 = await mediaDb.media.get(nvId)
    expect(afterRemove1.refCount).toBe(1)

    // Remove again should delete (refCount 0)
    await mediaManager.remove([nvId])
    const afterRemove2 = await mediaDb.media.get(nvId)
    expect(afterRemove2).toBeUndefined()
  })

  test('getStats returns categorized media statistics', async () => {
    const blobs = {
      'image.png': makeBlob('imgdata', 'image/png'),
      'audio.mp3': makeBlob('audiodata', 'audio/mpeg')
    }
    
    const result1 = await anki.parseFields('<img src="image.png">', blobs)
    const result2 = await anki.parseFields('[sound:audio.mp3]', blobs)
    
    await mediaManager.add([...result1.media, ...result2.media])
    
    const stats = await mediaManager.getStats()
    expect(stats.fileCount).toBe(2)
    expect(stats.byType.image.fileCount).toBe(1)
    expect(stats.byType.audio.fileCount).toBe(1)
    expect(stats.byType.image.files[0].filename).toBe('image.png')
    expect(stats.byType.audio.files[0].filename).toBe('audio.mp3')
  })

  test('blob2NvId generates same ID for same content regardless of filename', async () => {
    const blob1 = makeBlob('same content', 'image/png')
    const blob2 = makeBlob('same content', 'image/png') // Same content, different blob object
    
    const nvId1 = await mediaManager.blob2NvId(blob1)
    const nvId2 = await mediaManager.blob2NvId(blob2)
    
    expect(nvId1).toBe(nvId2) // Same content = same nvId
    expect(nvId1).toBeTruthy()
  })
})