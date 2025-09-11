import { describe, test, expect, vi } from 'vitest'
vi.mock('../apkg/index.js', () => ({
  parseApkgFile: vi.fn().mockResolvedValue({ name: null }),
  importApkgData: vi.fn()
}))
import { detect } from '../AnkiShard.js'

describe('AnkiShard.detect', () => {
  test('recognizes .apkg by extension with high confidence', async () => {
    const buf = new Uint8Array([1,2,3])
    const r = await detect('foo.apkg', buf)
    expect(r.match).toBe(true)
    expect(r.confidence).toBeGreaterThan(0.9)
  })
})


