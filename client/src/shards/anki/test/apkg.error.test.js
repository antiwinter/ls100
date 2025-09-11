import { describe, test, expect } from 'vitest'
import { parseApkgFile } from '../apkg/parser.js'

const asUint8 = (arr) => new Uint8Array(arr)

describe('APKG error handling', () => {
  test('fails on non-zip buffer', async () => {
    await expect(parseApkgFile(asUint8([1,2,3,4]))).rejects.toThrow(/Failed to parse Anki deck/i)
  })
})


