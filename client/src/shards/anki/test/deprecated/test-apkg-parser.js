#!/usr/bin/env node

// Test the fixed apkgParser with both .apkg files
import { parseApkgFile } from '../parser/apkgParser.js'
import { readFileSync } from 'fs'

// Simple log implementation for testing
global.log = {
  debug: (...args) => console.log('🔍', ...args),
  warn: (...args) => console.warn('⚠️', ...args),
  error: (...args) => console.error('❌', ...args),
  info: (...args) => console.log('ℹ️', ...args)
}

async function testBothFiles() {
  try {
    console.log('🧪 Testing both .apkg files with fixed parser...\n')

    // Test 1: Original 1.apkg file
    console.log('📁 Testing 1.apkg (should extract "2x2 PBL - Permutation of Both Layers"):')
    const file1 = readFileSync('./1.apkg')
    const result1 = await parseApkgFile(file1)
    console.log(`✅ Result: "${result1.name}"`)
    console.log('Expected: "2x2 PBL - Permutation of Both Layers"')
    console.log(`Match: ${result1.name === '2x2 PBL - Permutation of Both Layers'}\n`)

    // Test 2: 3x3 Rubiks Cube .apkg file
    console.log('📁 Testing 3x3_Rubiks_Cube_4_Look_Last_Layer_Algorithms.apkg (should extract "4LLL (Jperm)"):')
    const file2 = readFileSync('./3x3_Rubiks_Cube_4_Look_Last_Layer_Algorithms.apkg')
    const result2 = await parseApkgFile(file2)
    console.log(`✅ Result: "${result2.name}"`)
    console.log('Expected: "4LLL (Jperm)" (database name) or "4LLL (JPerm)" (display name)')
    console.log(`Match DB: ${result2.name === '4LLL (Jperm)'}`)
    console.log(`Match Display: ${result2.name === '4LLL (JPerm)'}\n`)

    // Summary
    console.log('📊 SUMMARY:')
    console.log(`1.apkg: ${result1.name === '2x2 PBL - Permutation of Both Layers' ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`3x3.apkg: ${result2.name === '4LLL (Jperm)' || result2.name === '4LLL (JPerm)' ? '✅ PASS' : '❌ FAIL'}`)

  } catch (error) {
    console.error('❌ Error testing parser:', error.message)
    console.error('Stack:', error.stack)
  }
}

testBothFiles()
