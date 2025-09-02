#!/usr/bin/env node

// Simple test to verify our format detection works
import JSZip from 'jszip'
import { readFileSync } from 'fs'

async function testFormatDetection() {
  try {
    console.log('📋 Testing .apkg format detection...\n')

    // Test both files
    const files = [
      { name: '1.apkg', expected: 'collection.anki2' },
      { name: '3x3_Rubiks_Cube_4_Look_Last_Layer_Algorithms.apkg', expected: 'collection.anki21' }
    ]

    for (const fileInfo of files) {
      console.log(`📁 Testing ${fileInfo.name}:`)

      const zip = new JSZip()
      const zipData = await zip.loadAsync(readFileSync(fileInfo.name))

      // Apply our new detection logic
      let collectionType = 'none'
      if (zipData.files['collection.anki21b']) {
        collectionType = 'collection.anki21b'
      } else if (zipData.files['collection.anki21']) {
        collectionType = 'collection.anki21'
      } else if (zipData.files['collection.anki2']) {
        collectionType = 'collection.anki2'
      }

      console.log(`  • Detected format: ${collectionType}`)
      console.log(`  • Expected format: ${fileInfo.expected}`)
      console.log(`  • Match: ${collectionType === fileInfo.expected ? '✅' : '❌'}`)
      console.log(`  • Available files: ${Object.keys(zipData.files).filter(f => f.startsWith('collection')).join(', ')}\n`)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testFormatDetection()
