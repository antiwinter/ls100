import { describe, test, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../core/db.js'
import mediaManager from '../core/mediaManager.js'
import { parseApkgFile, importApkgData } from '../apkg/index.js'
import { log } from '../../../utils/logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function dumpDb(destFile) {
  const snap = {}
  for (const t of db.tables) snap[t.name] = await db[t.name].toArray()
  fs.writeFileSync(destFile, JSON.stringify(snap, null, 2))
}

describe('Import all APKGs and dump DB snapshot', () => {
  beforeEach(async () => {
    await db.notes.clear()
    await db.bundles.clear()
    await db.templates.clear()
    await db.cards.clear()
    await mediaManager.clear()
  })

  test('parse+import all and write parsed outputs + db snapshot', async () => {
    const apkgDir = path.resolve(__dirname, 'apkg')
    const parsedDir = path.resolve(__dirname, 'parsed')
    if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

    const files = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
    if (files.length === 0) throw new Error(`No .apkg samples found in ${apkgDir}; add fixtures under test/apkg`)

    let ok = 0
    for (const name of files) {
      log.debug(name)
      const buf = fs.readFileSync(path.join(apkgDir, name))
      const out = name.replace('.apkg', '.json')
      try {
        const parsed = await parseApkgFile(buf)
        fs.writeFileSync(path.join(parsedDir, out), JSON.stringify(parsed, null, 2))
        await importApkgData(parsed)
        ok++
      } catch (e) {
        log.error(`Failed to process ${name}:`, e.message || e)
        fs.writeFileSync(path.join(parsedDir, out), JSON.stringify({ error: String(e?.message || e) }, null, 2))
      }
    }

    // Dump Dexie snapshot
    const dumpFile = path.join(parsedDir, 'db-snapshot.json')
    await dumpDb(dumpFile)
    expect(fs.existsSync(dumpFile)).toBe(true)
    // At least one should succeed
    expect(ok).toBeGreaterThan(0)
  }, 180_000)
})





