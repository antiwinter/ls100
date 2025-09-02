#!/usr/bin/env node

// Debug script to test exactly what's happening in parseDecks
import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { readFileSync } from 'fs'

// Load from local WASM file since CDN doesn't work in Node
import fs from 'fs'
import path from 'path'

const wasmPath = './node_modules/sql.js/dist/sql-wasm.wasm'

let SQL = null

const initSQL = async () => {
  if (!SQL) {
    const wasmBinary = fs.readFileSync(wasmPath)
    SQL = await initSqlJs({
      wasmBinary
    })
  }
  return SQL
}

async function debugParseDecks() {
  try {
    console.log('🔍 Testing exact parseDecks logic...\n')

    // Initialize SQL.js with local WASM
    await initSQL()

    // Parse ZIP file
    const zip = new JSZip()
    const zipData = await zip.loadAsync(readFileSync('./1.apkg'))

    // Extract and load database
    const dbFile = zipData.files['collection.anki2']
    const dbBuffer = await dbFile.async('uint8array')
    const db = new SQL.Database(dbBuffer)

    console.log('📊 Testing parseDecks function...')

    // Exact same logic as our parseDecks function
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()

    console.log('📋 Raw row data:')
    console.log('- Row keys:', Object.keys(row))
    console.log('- Has decks field:', 'decks' in row)
    console.log('- Decks field type:', typeof row.decks)
    console.log('- Decks field length:', row.decks?.length || 'undefined')

    console.log('\n🔍 Detailed row inspection:')
    Object.keys(row).forEach(key => {
      const value = row[key]
      const type = typeof value
      const preview = type === 'string' && value.length > 100
        ? value.substring(0, 100) + '...'
        : value
      console.log(`- ${key}: ${type} = ${preview}`)
    })

    if (row.decks) {
      console.log('\n🔧 Parsing decks JSON...')
      try {
        const decks = JSON.parse(row.decks)
        console.log('✅ Successfully parsed decks:')
        console.log('- Deck count:', Object.keys(decks).length)
        Object.entries(decks).forEach(([id, deck]) => {
          console.log(`  • ${id}: "${deck.name}"`)
        })

        console.log('\n🎯 Testing deck lookup for card deck ID 2059400111:')
        const testDeck = decks[2059400111]
        console.log('- Deck found:', !!testDeck)
        if (testDeck) {
          console.log('- Deck name:', testDeck.name)
          console.log('- Is not Default:', testDeck.name !== 'Default')
        }

      } catch (parseError) {
        console.error('❌ Failed to parse decks JSON:', parseError)
        console.log('Raw decks content:', row.decks?.substring(0, 200) + '...')
      }
    } else {
      console.log('❌ No decks field found in row!')
    }

    // Try specifically selecting the decks column
    console.log('\n🎯 Testing specific decks column selection:')
    try {
      const deckStmt = db.prepare('SELECT decks FROM col LIMIT 1')
      const deckRow = deckStmt.getAsObject()
      deckStmt.free()

      console.log('- Decks-only row keys:', Object.keys(deckRow))
      console.log('- Decks field type:', typeof deckRow.decks)

      if (deckRow.decks) {
        console.log('- Decks content preview:', deckRow.decks.substring(0, 200) + '...')
        const decks = JSON.parse(deckRow.decks)
        console.log('✅ Successfully parsed from specific query!')
        console.log('- Deck count:', Object.keys(decks).length)
      }
    } catch (specificError) {
      console.error('❌ Specific query failed:', specificError)
    }

    db.close()

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugParseDecks()
