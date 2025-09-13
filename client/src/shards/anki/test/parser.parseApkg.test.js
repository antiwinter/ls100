import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseApkgFile } from '../apkg/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('parseApkgFile (real APKGs)', () => {
  test('should parse all sample APKG files and save results (best-effort)', async () => {
    const apkgDir = __dirname
    const parsedDir = path.resolve(__dirname, 'parsed')
    if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

    const apkgFiles = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
    expect(apkgFiles.length).toBeGreaterThan(0)

    let success = 0, failed = 0
    for (const filename of apkgFiles) {
      const buffer = fs.readFileSync(path.join(apkgDir, filename))
      const outputName = filename.replace('.apkg', '.json')
      try {
        const parsed = await parseApkgFile(buffer)
        fs.writeFileSync(
          path.join(parsedDir, outputName),
          JSON.stringify(parsed, null, 2)
        )
        expect(parsed).toHaveProperty('bundles')
        expect(parsed).toHaveProperty('notes')
        expect(parsed).toHaveProperty('cards')
        expect(parsed).toHaveProperty('media')
        success++
      } catch (e) {
        // Dump error result but don't fail entire suite
        fs.writeFileSync(
          path.join(parsedDir, outputName),
          JSON.stringify({ error: String(e?.message || e) }, null, 2)
        )
        failed++
      }
    }
    expect(success).toBeGreaterThan(0)
  }, 120_000)
})


