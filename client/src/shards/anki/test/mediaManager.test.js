import { describe, test, expect, beforeEach } from 'vitest'
import db from '../storage/db'
import mediaManager from '../core/mediaManager'

function makeBlob(str, type = 'text/plain') {
  return new Blob([str], { type })
}

describe('MediaManager', () => {
  beforeEach(async () => {
    await db.media.clear()
    mediaManager.clearCache()
  })

  test('addMedia maps filenames to NvIds and upserts media', async () => {
    const html = '<img src="a.png">'
    const cooked = await mediaManager.addMedia(html, {
      'a.png': { blob: makeBlob('imgdata'), size: 7, type: 'image/png' }
    })
    expect(cooked).not.toContain('a.png')
  })
})


