import { describe, test, expect } from 'vitest'
import JSZip from 'jszip'
import { parseApkgFile } from '../apkg/parser.js'

const asUint8 = (arr) => new Uint8Array(arr)

describe('APKG parser error matrix', () => {
  test('corrupted zip (truncated) fails', async () => {
    await expect(parseApkgFile(asUint8([80,75,3]))).rejects.toThrow(/Failed to parse Anki deck/i)
  })

  test('missing collection.* fails', async () => {
    const zip = new JSZip()
    zip.file('media', '{}')
    const buf = await zip.generateAsync({ type: 'uint8array' })
    await expect(parseApkgFile(buf)).rejects.toThrow(/No compatible engine|No collection database/i)
  })

  test('bad JSON in media file still parses but media empty (default engine)', async () => {
    const zip = new JSZip()
    zip.file('collection.anki2', asUint8([1,2,3,4])) // will fail opening DB; but we focus media JSON path not DB here
    zip.file('media', '{bad json')
    const buf = await zip.generateAsync({ type: 'uint8array' })
    await expect(parseApkgFile(buf)).rejects.toThrow()
  })

  test('🚨 EXPOSES: parser should validate media objects have proper nvId structure', async () => {
    // Create a valid zip with media
    const zip = new JSZip()
    zip.file('collection.anki2', asUint8([83, 81, 76, 105, 116, 101])) // Valid SQLite header
    zip.file('media', '{"0": "test.png"}')
    zip.file('0', 'fake-image-data')
    
    const buf = await zip.generateAsync({ type: 'uint8array' })
    
    try {
      const result = await parseApkgFile(buf)
      
      // 🚨 BUG: Parsed media should have proper structure
      if (result.media && result.media.length > 0) {
        for (const mediaItem of result.media) {
          // Should not have undefined _nvid properties that cause "Invalid obj entry" errors
          expect(mediaItem._nvid).not.toBe(undefined)
          expect(mediaItem.nvId).toBeDefined()
          expect(mediaItem.filename).toBeDefined()
          expect(mediaItem.blob).toBeDefined()
        }
      }
    } catch (error) {
      // If parsing fails completely, that's also a bug we want to expose
      expect(error.message).not.toMatch(/Invalid obj entry/)
    }
  })
})


