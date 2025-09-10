#!/usr/bin/env node

// Test approach using child_process to call sqlite3 (which we know works)
import { execSync } from 'child_process'

async function testWorkingApproach() {
  try {
    console.log('🔍 Testing with working sqlite3 approach...\n')

    // Use the working sqlite3 command
    const decksJson = execSync('sqlite3 collection.anki2 "SELECT decks FROM col LIMIT 1"', {
      encoding: 'utf8',
      cwd: '/Users/warits/code/ls100'
    }).trim()

    console.log('📊 Raw decks JSON from sqlite3:')
    console.log(decksJson)

    // Parse the JSON
    const decks = JSON.parse(decksJson)
    console.log('\n📂 Parsed decks:')
    Object.entries(decks).forEach(([id, deck]) => {
      console.log(`  • ${id}: "${deck.name}"`)
    })

    // Simulate cards data (we know cards belong to deck 2059400111)
    const cardDeckIds = [2059400111]
    console.log('\n🃏 Card deck IDs:', cardDeckIds)

    // Apply our fixed logic
    let deckName = 'Anki Deck'

    for (const bundleId of cardDeckIds) {
      const deck = decks[bundleId]
      console.log(`\n🔍 Looking up deck ${bundleId}:`)
      console.log(`  • Found: ${!!deck}`)
      if (deck) {
        console.log(`  • Name: "${deck.name}"`)
        console.log(`  • Not Default: ${deck.name !== 'Default'}`)

        if (deck.name && deck.name !== 'Default') {
          deckName = deck.name
          console.log(`  ✅ Using this deck name: "${deckName}"`)
          break
        }
      }
    }

    console.log('\n🎯 FINAL RESULT:')
    console.log(`Extracted deck name: "${deckName}"`)

    if (deckName === '2x2 PBL - Permutation of Both Layers') {
      console.log('🎉 SUCCESS! This is the correct approach.')
    } else {
      console.log('❌ Something is still wrong.')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testWorkingApproach()
