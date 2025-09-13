import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import anki from '../core/index.js'

function makeBlob(str, type = 'text/plain') {
  return new Blob([str], { type })
}

describe('MediaManager', () => {
  beforeEach(async () => {
    await db.media.clear()
    anki.mediaManager.clearCache()
  })

  test('addMedia maps filenames to NvIds and upserts media', async () => {
    const html = '<img src="a.png">'
    const cooked = await anki.mediaManager.addMedia(html, {
      'a.png': { blob: makeBlob('imgdata'), size: 7, type: 'image/png' }
    })
    expect(cooked).not.toContain('a.png')
  })

  test('retain/remove maintains refCounts and cleans up at 0', async () => {
    const html = '<img src="a.png">'
    const cooked = await anki.mediaManager.addMedia(html, {
      'a.png': { blob: makeBlob('imgdata'), size: 7, type: 'image/png' }
    })
    // Get the created media record id (nvId)
    const all = await db.media.toArray()
    expect(all.length).toBe(1)
    const nvId = all[0].id

    // Retain should increment refCount to 2
    await anki.mediaManager.retainMedia(cooked)
    const afterRetain = await db.media.get(nvId)
    expect(afterRetain.refCount).toBe(2)

    // Remove twice should drop to 0 and delete
    await anki.mediaManager.removeMedia(cooked)
    await anki.mediaManager.removeMedia(cooked)
    const afterRemove = await db.media.get(nvId)
    expect(afterRemove).toBeUndefined()
  })
})


