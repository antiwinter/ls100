import { describe, test, expect } from 'vitest'
import { detect } from '../AnkiShard.js'

describe('AnkiShard.detect', () => {
  test('recognizes .apkg by extension with high confidence', async () => {
    const buf = new Uint8Array([1,2,3])
    const r = await detect('foo.apkg', buf)
    expect(r.match).toBe(true)
    expect(r.confidence).toBeGreaterThan(0.9)
  })
})


