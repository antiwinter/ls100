import { describe, test, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from '../core/db.js'
import mediaManager from '../../../utils/oss.js'
import { parseApkgFile, importApkgData } from '../apkg/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function dumpDb(destFile) {
  const snap = {}
  for (const t of db.tables) snap[t.name] = await db[t.name].toArray()
  fs.writeFileSync(destFile, JSON.stringify(snap, null, 2))
}

// Extract media filenames from content (similar to mediaManager._findMedia)
function extractMediaFilenames(content) {
  if (!content || typeof content !== 'string') return []
  
  const filenames = []
  
  // Extract filenames from [sound:filename] tags
  const soundMatches = content.match(/\[sound:([^\]]+)\]/g) || []
  for (const match of soundMatches) {
    const filename = match.replace(/\[sound:([^\]]+)\]/, '$1')
    if (filename) filenames.push(filename)
  }
  
  // Extract filenames from HTML media tags
  const htmlMatches = content.match(/<(img|audio|video|source|object)\b[^>]*\b(?:src|data)=["']?([^"'\s>]+)["']?[^>]*>/gi) || []
  for (const match of htmlMatches) {
    const srcMatch = match.match(/\b(?:src|data)=["']?([^"'\s>]+)["']?/)
    if (srcMatch) {
      const filename = srcMatch[1]
      if (filename) filenames.push(filename)
    }
  }
  
  // Extract filenames from CSS url() declarations
  const cssMatches = content.match(/url\(['"]?([^'")]+)['"]?\)/gi) || []
  for (const match of cssMatches) {
    const urlMatch = match.match(/url\(['"]?([^'")]+)['"]?\)/i)
    if (urlMatch) {
      const filename = urlMatch[1]
      if (filename) filenames.push(filename)
    }
  }
  
  return [...new Set(filenames)] // Remove duplicates
}

// Validate media pool contains all referenced media files
function validateMediaPool(parsed) {
  const errors = []
  const mediaPool = parsed.media || {}
  const mediaPoolKeys = Object.keys(mediaPool)
  const allReferencedFiles = new Set()
  
  // Extract media filenames from all template content
  if (parsed.bundles) {
    for (const bundleId in parsed.bundles) {
      const bundle = parsed.bundles[bundleId]
      
      // Check templates
      if (bundle.tmpls) {
        for (const template of bundle.tmpls) {
          const qfmtFiles = extractMediaFilenames(template.qfmt)
          const afmtFiles = extractMediaFilenames(template.afmt)
          
          qfmtFiles.forEach(f => allReferencedFiles.add(f))
          afmtFiles.forEach(f => allReferencedFiles.add(f))
        }
      }
      
      // Check notes (field content)
      if (parsed.notes) {
        for (const noteId in parsed.notes) {
          const note = parsed.notes[noteId]
          if (note.bundleId === bundleId && note.fields) {
            for (const field of note.fields) {
              const fieldFiles = extractMediaFilenames(field)
              fieldFiles.forEach(f => allReferencedFiles.add(f))
            }
          }
        }
      }
    }
  }
  
  // Check for missing files
  const referencedFilesArray = Array.from(allReferencedFiles)
  const missingFiles = referencedFilesArray.filter(filename => !mediaPoolKeys.includes(filename))
  
  if (missingFiles.length > 0) {
    errors.push(`Missing ${missingFiles.length} media files in mediaPool: ${missingFiles.slice(0, 10).join(', ')}${missingFiles.length > 10 ? '...' : ''}`)
  }
  
  console.log(`📊 Media validation: ${referencedFilesArray.length} referenced, ${mediaPoolKeys.length} in pool, ${missingFiles.length} missing`)
  
  return { errors, referenced: referencedFilesArray.length, poolSize: mediaPoolKeys.length, missing: missingFiles.length }
}

describe('parse/import single APKG (debug)', () => {
  test('parse one specific .apkg and write outputs', async () => {
    const apkgDir = path.resolve(__dirname, 'apkg')
    const parsedDir = path.resolve(__dirname, 'parsed')
    if (!fs.existsSync(parsedDir)) fs.mkdirSync(parsedDir, { recursive: true })

    const files = fs.readdirSync(apkgDir).filter(f => f.endsWith('.apkg'))
    const preferred = 'Ultimate Geography [ZH].apkg'
    const target = process.env.ANKI_APKG || (files.includes(preferred) ? preferred : files[0])
    if (!target) throw new Error(`No .apkg samples found in ${apkgDir}; add fixtures under test/apkg or set ANKI_APKG`)
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
    await mediaManager.clear()

    const buffer = fs.readFileSync(apkgPath)
    const outputName = target.replace('.apkg', '.json')

    try {
      const parsed = await parseApkgFile(buffer)
      fs.writeFileSync(path.join(parsedDir, outputName), JSON.stringify(parsed, null, 2))
      
      // Validate media pool integrity
      const mediaValidation = validateMediaPool(parsed)
      if (mediaValidation.errors.length > 0) {
        console.error('❌ Media validation errors:')
        mediaValidation.errors.forEach(error => console.error(`  ${error}`))
        throw new Error(`Media validation failed: ${mediaValidation.errors.join('; ')}`)
      } else {
        console.log('✅ Media pool validation passed')
      }
      
      await importApkgData(parsed)
    } catch (e) {
      fs.writeFileSync(
        path.join(parsedDir, outputName),
        JSON.stringify({ error: String(e?.message || e), stack: e?.stack }, null, 2)
      )
      throw e // Re-throw to fail the test
    }

    await dumpDb(path.join(parsedDir, 'db-snapshot-single.json'))
    expect(true).toBe(true)
  }, 120_000)
})





