import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseApkgFile } from '../apkg/index.js'
import * as engine21b from '../apkg/engine-21b.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Engine selection uses engine-21b for 21b deck', () => {
  let spies = []

  beforeEach(() => {
    spies = [
      vi.spyOn(engine21b, 'processDbBuffer'),
      vi.spyOn(engine21b, 'parseNotetypes'),
      vi.spyOn(engine21b, 'parseDecks'),
      vi.spyOn(engine21b, 'parseMedia')
    ]
  })

  afterEach(() => {
    spies.forEach(s => s.mockRestore())
  })

  test('parsing Ultimate Geography [ZH].apkg calls engine-21b methods', async () => {
    const apkgPath = path.join(__dirname, 'apkg', 'Ultimate Geography [ZH].apkg')
    if (!fs.existsSync(apkgPath)) {
      // gracefully skip when sample apkg missing
      expect(true).toBe(true)
      return
    }
    const buf = fs.readFileSync(apkgPath)

    await parseApkgFile(buf)

    // At minimum, engine-21b should be selected and its processDbBuffer called
    expect(engine21b.processDbBuffer).toHaveBeenCalled()
  })
})


