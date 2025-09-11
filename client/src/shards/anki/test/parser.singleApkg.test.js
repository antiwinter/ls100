import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../storage/db'
import { parseApkgFile, importApkgData } from '../apkg/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function dumpDb(destFile) {
  const snap = {}
  for (const t of db.tables) snap[t.name] = await db[t.name].toArray()
  fs.writeFileSync(destFile, JSON.stringify(snap, null, 2))
}

describe('parse/import single APKG (debug)', () => {
  test('parse one specific .apkg and write outputs', async () => {
    const apkgDir = path.resolve(__dirname, 'apkg')
    const parsedDir = path.resolve(__dirname, 'parsed')
    if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

    const target = process.env.ANKI_APKG || 'Ultimate Geography [ZH].apkg'
    const apkgPath = path.join(apkgDir, target)

    if (!fs.existsSync(apkgPath)) {
      const available = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
      throw new Error(`APKG not found: ${target}. Available: ${available.join(', ')}`)
    }

    // Reset DB for clean import
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await db.media.clear()

    const buffer = fs.readFileSync(apkgPath)
    const outputName = target.replace('.apkg', '.json')

    try {
      const parsed = await parseApkgFile(buffer)
      fs.writeFileSync(path.join(parsedDir, outputName), JSON.stringify(parsed, null, 2))
      await importApkgData(parsed)
    } catch (e) {
      fs.writeFileSync(
        path.join(parsedDir, outputName),
        JSON.stringify({ error: String(e?.message || e), stack: e?.stack }, null, 2)
      )
    }

    await dumpDb(path.join(parsedDir, 'db-snapshot-single.json'))
    expect(true).toBe(true)
  }, 120_000)
})





