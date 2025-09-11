import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseApkgFile } from '../parser/apkgParser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('parseApkgFile (real APKGs)', () => {
  test('should parse all sample APKG files and save results', async () => {
    const apkgDir = path.resolve(__dirname, 'apkg')
    const parsedDir = path.resolve(__dirname, 'parsed')
    if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

    const apkgFiles = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
    expect(apkgFiles.length).toBeGreaterThan(0)

    for (const filename of apkgFiles) {
      const buffer = fs.readFileSync(path.join(apkgDir, filename))
      const parsed = await parseApkgFile(buffer)

      const outputName = filename.replace('.apkg', '.json')
      fs.writeFileSync(
        path.join(parsedDir, outputName),
        JSON.stringify(parsed, null, 2)
      )

      expect(parsed).toHaveProperty('collection')
      expect(parsed).toHaveProperty('bundles')
      expect(parsed).toHaveProperty('notes')
      expect(parsed).toHaveProperty('cards')
    }
  }, 120_000)
})


