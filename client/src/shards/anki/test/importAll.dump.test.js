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
    const diffs = []
    
    for (const name of files) {
      log.debug(name)
      const buf = fs.readFileSync(path.join(apkgDir, name))
      const out = name.replace('.apkg', '.json')
      try {
        const parsed = await parseApkgFile(buf)
        fs.writeFileSync(path.join(parsedDir, out), JSON.stringify(parsed, null, 2))
        
        // Get media filenames from APKG media object (keys are filenames)
        const zipMediaFilenames = Object.keys(parsed.media || {})
        
        await importApkgData(parsed)
        
        // Get imported media for each bundle
        const bundleIds = Object.keys(parsed.bundles || {})
        for (const bundleId of bundleIds) {
          // Find the actual bundleId created during import
          const bundles = await db.bundles.toArray()
          const importedBundle = bundles.find(b => b.name === parsed.bundles[bundleId]?.name)
          
          if (importedBundle) {
            // Get media entries for this bundle
            const bundleMedia = await db.media.where('bundleId').equals(importedBundle.id).toArray()
            const importedFilenames = [...new Set(bundleMedia.map(m => m.filename))]
            
            // Compare zipMediaFilenames vs importedFilenames
            const missing = zipMediaFilenames.filter(filename => !importedFilenames.includes(filename))
            
            if (missing.length > 0) {
              diffs.push({
                apkg: name,
                bundle: parsed.bundles[bundleId]?.name,
                missing: missing
              })
            }
          }
        }
        
        ok++
      } catch (e) {
        log.error(`Failed to process ${name}:`, e.message || e)
        fs.writeFileSync(path.join(parsedDir, out), JSON.stringify({ error: String(e?.message || e) }, null, 2))
      }
    }

    // Output diff results
    console.log('\n=== MEDIA IMPORT DIFF ANALYSIS ===')
    
    // Get list of all processed APKGs
    const allApkgs = files.filter(f => f.endsWith('.apkg'))
    const apkgsWithDiffs = diffs.map(d => d.apkg)
    
    for (const apkg of allApkgs) {
      const diff = diffs.find(d => d.apkg === apkg)
      if (diff) {
        console.log(`${apkg}: ${diff.missing.length} diff`)
        for (const missing of diff.missing.slice(0, 10)) {  // Show first 10 for readability
          console.log(`- ${missing}`)
        }
        if (diff.missing.length > 10) {
          console.log(`... and ${diff.missing.length - 10} more files`)
        }
      } else {
        console.log(`${apkg}: 0 diff`)
      }
    }
    
    console.log('=====================================\n')

    // Dump Dexie snapshot
    const dumpFile = path.join(parsedDir, 'db-snapshot.json')
    await dumpDb(dumpFile)
    expect(fs.existsSync(dumpFile)).toBe(true)
    // At least one should succeed
    expect(ok).toBeGreaterThan(0)
  }, 180_000)
})





