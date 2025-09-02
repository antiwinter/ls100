#!/usr/bin/env node

// Test the fixed deck name extraction with a minimal version of apkgParser
import JSZip from 'jszip'
import { readFileSync } from 'fs'

// Simple log implementation
const log = {
  debug: (...args) => console.log('🔍', ...args),
  warn: (...args) => console.warn('⚠️', ...args),
  error: (...args) => console.error('❌', ...args)
}

// Minimal parseDecks function from our parser
const parseDecks = (sqlData) => {
  try {
    const decks = JSON.parse(sqlData.decks || '{}')
    return decks
  } catch (error) {
    log.warn('Failed to parse decks:', error)
    return {}
  }
}

// Minimal parseCards function
const parseCards = (sqlData) => {
  // For testing, we'll use the data we know from sqlite3 query
  // Cards belong to deck ID 2059400111
  return [
    { did: 2059400111, id: 1 },
    { did: 2059400111, id: 2 },
    { did: 2059400111, id: 3 },
    { did: 2059400111, id: 4 },
    { did: 2059400111, id: 5 },
    { did: 2059400111, id: 6 }
  ]
}

// Our fixed deck name extraction logic
function extractDeckName(decks, cards) {
  let deckName = 'Anki Deck'
  
  if (cards.length > 0) {
    // Find deck that contains the cards
    const cardDeckIds = [...new Set(cards.map(c => c.did))]
    log.debug('Card deck IDs:', cardDeckIds)
    
    for (const deckId of cardDeckIds) {
      const deck = decks[deckId]
      if (deck && deck.name && deck.name !== 'Default') {
        deckName = deck.name
        log.debug(`Using deck name from cards: "${deckName}"`)
        break
      }
    }
  }
  
  // Fallback to first non-default deck
  if (deckName === 'Anki Deck') {
    const nonDefaultDecks = Object.values(decks || {})
      .filter(d => d.name && d.name !== 'Default')
      .map(d => d.name)
    
    if (nonDefaultDecks.length > 0) {
      deckName = nonDefaultDecks[0]
      log.debug(`Using first non-default deck: "${deckName}"`)
    }
  }
  
  return deckName
}

async function testFixedParser() {
  try {
    console.log('🧪 Testing FIXED deck name extraction...\n')
    
    // Use the raw deck data we extracted earlier
    const rawDecks = `{"1": {"collapsed": false, "conf": 1, "desc": "", "dyn": 0, "extendNew": 10, "extendRev": 50, "id": 1, "lrnToday": [0, 0], "mod": 1425279151, "name": "Default", "newToday": [0, 0], "revToday": [0, 0], "timeToday": [0, 0], "usn": 0}, "2059400111": {"collapsed": false, "conf": 1, "desc": "", "dyn": 0, "extendNew": 0, "extendRev": 50, "id": 2059400111, "lrnToday": [163, 2], "mod": 1425278051, "name": "2x2 PBL - Permutation of Both Layers", "newToday": [163, 2], "revToday": [163, 0], "timeToday": [163, 23598], "usn": -1}}`
    
    console.log('📊 RAW DATA:')
    console.log('Raw decks JSON:', rawDecks)
    
    // Parse decks
    const decks = parseDecks({ decks: rawDecks })
    console.log('\n📂 PARSED DECKS:')
    Object.entries(decks).forEach(([id, deck]) => {
      console.log(`  • ${id}: "${deck.name}"`)
    })
    
    // Generate test cards
    const cards = parseCards()
    console.log('\n🃏 CARDS DATA:')
    console.log(`  • Total cards: ${cards.length}`)
    console.log(`  • Card deck IDs: ${[...new Set(cards.map(c => c.did))]}`)
    
    // Test our fixed extraction
    console.log('\n🔧 TESTING EXTRACTION:')
    const extractedName = extractDeckName(decks, cards)
    
    console.log('\n✅ RESULT:')
    console.log(`Extracted deck name: "${extractedName}"`)
    
    // Verify against expected
    const expected = "2x2 PBL - Permutation of Both Layers"
    if (extractedName === expected) {
      console.log('🎉 SUCCESS: Correctly extracted the deck name!')
    } else {
      console.log(`❌ FAILED: Expected "${expected}", got "${extractedName}"`)
    }
    
  } catch (error) {
    console.error('❌ Error testing parser:', error)
  }
}

// Run the test
testFixedParser()
