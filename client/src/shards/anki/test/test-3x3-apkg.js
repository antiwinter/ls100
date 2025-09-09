#!/usr/bin/env node

// Test the 3x3 Rubiks Cube .apkg file
import { execSync } from 'child_process'
import JSZip from 'jszip'
import { readFileSync, writeFileSync } from 'fs'

async function test3x3Apkg() {
  try {
    console.log('🧩 Testing 3x3 Rubiks Cube .apkg file...\n')

    const apkgPath = './3x3_Rubiks_Cube_4_Look_Last_Layer_Algorithms.apkg'

    // Extract and examine structure
    const zip = new JSZip()
    const zipData = await zip.loadAsync(readFileSync(apkgPath))

    console.log('📋 ZIP Contents:')
    Object.keys(zipData.files).forEach(name => {
      console.log(`  • ${name}`)
    })

    // Extract collection database (try newer format first)
    let dbFile = zipData.files['collection.anki21'] || zipData.files['collection.anki2']
    let filename = '3x3-collection.anki2'

    if (zipData.files['collection.anki21']) {
      console.log('🆕 Using newer collection.anki21 format')
      filename = '3x3-collection.anki21'
    } else {
      console.log('📜 Using legacy collection.anki2 format')
    }

    if (dbFile) {
      const dbBuffer = await dbFile.async('nodebuffer')
      writeFileSync(`./${filename}`, dbBuffer)

      // Use sqlite3 to examine the data
      console.log('\n📊 Raw decks from sqlite3:')
      const decksJson = execSync(`sqlite3 ${filename} "SELECT decks FROM col LIMIT 1"`, {
        encoding: 'utf8',
        cwd: '/Users/warits/code/ls100/client/src/shards/anki/test'
      }).trim()

      console.log(decksJson)

      console.log('\n📂 Parsed decks:')
      const decks = JSON.parse(decksJson)
      Object.entries(decks).forEach(([id, deck]) => {
        console.log(`  • ID ${id}: "${deck.name}"`)
      })

      // Check cards
      console.log('\n🃏 Card deck assignments:')
      const cardDecks = execSync(`sqlite3 ${filename} "SELECT DISTINCT did FROM cards"`, {
        encoding: 'utf8',
        cwd: '/Users/warits/code/ls100/client/src/shards/anki/test'
      }).trim().split('\n').filter(Boolean)

      console.log('Card deck IDs:', cardDecks)

      // Apply our logic
      console.log('\n🔧 Applying our deck name extraction logic:')
      let deckName = 'Anki Deck'

      for (const bundleId of cardDecks) {
        const deck = decks[bundleId]
        console.log(`\n🔍 Checking deck ${bundleId}:`)
        console.log(`  • Found: ${!!deck}`)
        if (deck) {
          console.log(`  • Name: "${deck.name}"`)
          console.log(`  • Not Default: ${deck.name !== 'Default'}`)

          if (deck.name && deck.name !== 'Default') {
            deckName = deck.name
            console.log(`  ✅ Using: "${deckName}"`)
            break
          }
        }
      }

      console.log('\n🎯 RESULT:')
      console.log(`Extracted: "${deckName}"`)
      console.log('Expected: "4LLL (JPerm)"')
      console.log(`Match: ${deckName === '4LLL (JPerm)'}`)

      // Check configuration too
      console.log('\n⚙️  Configuration check:')
      const confJson = execSync(`sqlite3 ${filename} "SELECT conf FROM col LIMIT 1"`, {
        encoding: 'utf8',
        cwd: '/Users/warits/code/ls100/client/src/shards/anki/test'
      }).trim()

      console.log('Config:', confJson)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

test3x3Apkg()
