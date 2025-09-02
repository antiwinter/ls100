#!/usr/bin/env node

// Simple test script to debug .apkg parsing using only sql.js and jszip
// This isolates the deck name extraction without other dependencies

import JSZip from 'jszip'
import initSqlJs from 'sql.js'
import { readFileSync } from 'fs'

let SQL = null

const initSQL = async () => {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    })
  }
  return SQL
}

async function testApkgParsing() {
  try {
    console.log('🔍 Testing .apkg parsing with ls100/1.apkg...\n')
    
    // Read the .apkg file
    const apkgPath = './1.apkg'
    const fileBuffer = readFileSync(apkgPath)
    console.log(`📁 File size: ${fileBuffer.length} bytes`)
    
    // Initialize SQL.js
    console.log('🔧 Initializing SQL.js...')
    await initSQL()
    
    // Parse ZIP file
    console.log('📦 Extracting ZIP contents...')
    const zip = new JSZip()
    const zipData = await zip.loadAsync(fileBuffer)
    
    console.log('ZIP contents:', Object.keys(zipData.files))
    
    // Extract collection.anki2 (SQLite database)
    const dbFile = zipData.files['collection.anki2']
    if (!dbFile) {
      throw new Error('collection.anki2 not found in .apkg file')
    }
    
    const dbBuffer = await dbFile.async('uint8array')
    const db = new SQL.Database(dbBuffer)
    
    console.log('\n🗄️  SQLite database loaded successfully')
    
    // Get raw data from col table
    console.log('\n📋 Querying col table...')
    const stmt = db.prepare('SELECT * FROM col')
    const row = stmt.getAsObject()
    stmt.free()
    
    console.log('\n🔍 RAW DATA ANALYSIS:')
    console.log('=====================')
    
    // Parse decks JSON
    console.log('\n📂 DECKS JSON:')
    try {
      const decksRaw = row.decks || '{}'
      console.log('Raw decks field:', decksRaw)
      
      const decks = JSON.parse(decksRaw)
      console.log('Parsed decks object:', JSON.stringify(decks, null, 2))
      
      // Extract deck names
      const deckNames = Object.values(decks).map(d => d.name).filter(Boolean)
      console.log('Extracted deck names:', deckNames)
      
    } catch (e) {
      console.error('Failed to parse decks:', e.message)
    }
    
    // Parse conf JSON
    console.log('\n⚙️  CONF JSON:')
    try {
      const confRaw = row.conf || '{}'
      console.log('Raw conf field:', confRaw)
      
      const conf = JSON.parse(confRaw)
      console.log('Parsed conf object:', JSON.stringify(conf, null, 2))
      
      if (conf.colName) {
        console.log('Collection name from conf:', conf.colName)
      }
      
    } catch (e) {
      console.error('Failed to parse conf:', e.message)
    }
    
    // Check if there's a separate decks table
    console.log('\n🗂️  CHECKING DECKS TABLE:')
    try {
      const deckTableStmt = db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="decks"')
      const hasDecksTable = deckTableStmt.step()
      deckTableStmt.free()
      
      if (hasDecksTable) {
        console.log('Found decks table!')
        const deckStmt = db.prepare('SELECT * FROM decks LIMIT 5')
        const deckRows = []
        while (deckStmt.step()) {
          deckRows.push(deckStmt.getAsObject())
        }
        deckStmt.free()
        console.log('Decks table content:', deckRows)
      } else {
        console.log('No separate decks table found')
      }
    } catch (e) {
      console.error('Error checking decks table:', e.message)
    }
    
    // List all tables
    console.log('\n📊 ALL TABLES:')
    try {
      const tablesStmt = db.prepare('SELECT name FROM sqlite_master WHERE type="table"')
      const tables = []
      while (tablesStmt.step()) {
        tables.push(tablesStmt.getAsObject().name)
      }
      tablesStmt.free()
      console.log('Available tables:', tables)
    } catch (e) {
      console.error('Error listing tables:', e.message)
    }
    
    db.close()
    
  } catch (error) {
    console.error('❌ Error parsing .apkg file:', error)
    console.error('Stack:', error.stack)
  }
}

// Run the test
testApkgParsing()
