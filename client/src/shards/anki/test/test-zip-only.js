#!/usr/bin/env node

// Test script to examine .apkg file structure using only JSZip
import JSZip from 'jszip'
import { readFileSync, writeFileSync } from 'fs'

async function testApkgStructure() {
  try {
    console.log('🔍 Examining .apkg file structure...\n')

    // Read the .apkg file
    const apkgPath = './1.apkg'
    const fileBuffer = readFileSync(apkgPath)
    console.log(`📁 File size: ${fileBuffer.length} bytes`)

    // Parse ZIP file
    console.log('📦 Extracting ZIP contents...')
    const zip = new JSZip()
    const zipData = await zip.loadAsync(fileBuffer)

    console.log('\n📋 ZIP CONTENTS:')
    console.log('================')
    for (const filename of Object.keys(zipData.files)) {
      const file = zipData.files[filename]
      console.log(`• ${filename} (${file._data?.uncompressedSize || 'unknown'} bytes)`)
    }

    // Extract collection.anki2 to examine later
    const dbFile = zipData.files['collection.anki2']
    if (dbFile) {
      console.log('\n💾 Extracting collection.anki2...')
      const dbBuffer = await dbFile.async('nodebuffer')
      writeFileSync('./collection.anki2', dbBuffer)
      console.log(`✅ Saved collection.anki2 (${dbBuffer.length} bytes)`)
    }

    // Check for media files
    const mediaFile = zipData.files['media']
    if (mediaFile) {
      console.log('\n🎵 Media mapping:')
      const mediaText = await mediaFile.async('text')
      console.log(mediaText)
    }

    // List numbered media files
    const mediaFiles = Object.keys(zipData.files).filter(name => /^\d+$/.test(name))
    if (mediaFiles.length > 0) {
      console.log('\n🖼️  Media files found:', mediaFiles)
    }

  } catch (error) {
    console.error('❌ Error examining .apkg file:', error)
  }
}

// Run the test
testApkgStructure()
