#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Generic JSON validator for dictionary conversions
 * Parser-agnostic: Only validates JSON structure and content
 * Does NOT compare to MDX/HTML - just checks JSON quality
 */

import fs from 'fs'

const jsonPath = process.argv[2]

if (!jsonPath) {
  console.error('Usage: node validate-json.js <path-to-json>')
  process.exit(1)
}

if (!fs.existsSync(jsonPath)) {
  console.error(`Error: File not found: ${jsonPath}`)
  process.exit(1)
}

console.log('🧪 Validating JSON structure...\n')
console.log(`JSON: ${jsonPath}\n`)

const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

const results = {
  total: entries.length,
  passed: 0,
  failed: 0,
  issues: {
    posNotSplit: [],
    refToNotFlat: [],
    labelsNotExtracted: [],
    labelMarkersInJson: [],
    invalidStructure: []
  }
}

const stats = {
  withLabels: 0,
  withIPA: 0,
  withThesaurus: 0,
  withOrigin: 0,
  withQuotes: 0
}

for (const entry of entries) {
  const word = entry.word
  let hasIssues = false
  
  // Test 1: Basic structure
  if (!entry.word || !Array.isArray(entry.defs)) {
    results.issues.invalidStructure.push({ word, reason: 'Missing word or defs array' })
    hasIssues = true
    continue
  }
  
  // Test 2: POS should be split correctly (no Chinese in English POS)
  // This is a JSON quality check - Chinese should be in posZh, not pos
  for (const def of entry.defs) {
    if (def.pos && /[\u4e00-\u9fa5]/.test(def.pos)) {
      results.issues.posNotSplit.push({ word, pos: def.pos })
      hasIssues = true
    }
  }
  
  // Test 3: refTo should be flat array of strings, not nested objects
  // JSON standard: refTo: ["word1", "word2"], NOT refTo: [{phrases: [...]}]
  if (entry.refTo && entry.refTo.length > 0) {
    if (typeof entry.refTo[0] === 'object' && entry.refTo[0].phrases) {
      results.issues.refToNotFlat.push({ word })
      hasIssues = true
    }
  }
  
  // Test 4: Label markers (】) should NOT exist in JSON
  // All label patterns should be extracted to labels[] field
  const jsonStr = JSON.stringify(entry)
  if (jsonStr.includes('】')) {
    // Find where the marker appears
    const locations = []
    for (const def of entry.defs) {
      if (def.en && def.en.includes('】')) {
        locations.push(`en: ${def.en.substring(0, 60)}...`)
      }
      if (def.zh && def.zh.includes('】')) {
        locations.push(`zh: ${def.zh.substring(0, 60)}...`)
      }
    }
    results.issues.labelMarkersInJson.push({ word, locations: locations.slice(0, 2) })
    hasIssues = true
  }
  
  // Test 5: Count entries with labels (for statistics)
  const hasLabels = entry.defs.some(d => d.labels && d.labels.length > 0)
  if (hasLabels) {
    stats.withLabels++
  }
  
  // Test 6: IPA format validation (optional field, 2015 edition)
  if (entry.ipa !== undefined) {
    if (typeof entry.ipa !== 'string' || (entry.ipa && !/^\/.*\/$/.test(entry.ipa))) {
      results.issues.invalidStructure.push({ word, reason: 'Invalid IPA format (should be /.../)' })
      hasIssues = true
    }
    if (entry.ipa) stats.withIPA++
  }
  
  // Test 7: Thesaurus structure validation (optional field, 2015 edition)
  if (entry.thesaurus !== undefined && entry.thesaurus !== null) {
    if (typeof entry.thesaurus !== 'object') {
      results.issues.invalidStructure.push({ word, reason: 'Thesaurus not an object' })
      hasIssues = true
    } else {
      for (const pos in entry.thesaurus) {
        if (!Array.isArray(entry.thesaurus[pos])) {
          results.issues.invalidStructure.push({ word, reason: `thesaurus.${pos} not array` })
          hasIssues = true
        } else {
          entry.thesaurus[pos].forEach((group, i) => {
            if (!group.syno && !group.anto) {
              results.issues.invalidStructure.push({ word, reason: `thesaurus.${pos}[${i}] missing syno/anto` })
              hasIssues = true
            }
            if (group.syno && !Array.isArray(group.syno)) {
              results.issues.invalidStructure.push({ word, reason: `thesaurus.${pos}[${i}].syno not array` })
              hasIssues = true
            }
            if (group.anto && !Array.isArray(group.anto)) {
              results.issues.invalidStructure.push({ word, reason: `thesaurus.${pos}[${i}].anto not array` })
              hasIssues = true
            }
          })
        }
      }
      if (Object.keys(entry.thesaurus).length > 0) stats.withThesaurus++
    }
  }
  
  // Test 8: Origin format validation (optional field, 2015 edition)
  if (entry.origin !== undefined) {
    if (typeof entry.origin !== 'string') {
      results.issues.invalidStructure.push({ word, reason: 'Origin not a string' })
      hasIssues = true
    }
    if (entry.origin) stats.withOrigin++
  }
  
  // Test 9: Quotes structure validation (optional field, 2015 edition)
  if (entry.quotes !== undefined) {
    if (!Array.isArray(entry.quotes)) {
      results.issues.invalidStructure.push({ word, reason: 'Quotes not an array' })
      hasIssues = true
    } else {
      entry.quotes.forEach((quote, i) => {
        if (!quote || typeof quote !== 'object') {
          results.issues.invalidStructure.push({ word, reason: `quotes[${i}] not an object` })
          hasIssues = true
        } else {
          if (!quote.text || typeof quote.text !== 'string') {
            results.issues.invalidStructure.push({ word, reason: `quotes[${i}] missing text` })
            hasIssues = true
          }
          if (!quote.author || typeof quote.author !== 'string') {
            results.issues.invalidStructure.push({ word, reason: `quotes[${i}] missing author` })
            hasIssues = true
          }
        }
      })
      if (entry.quotes.length > 0) stats.withQuotes++
    }
  }
  
  if (hasIssues) {
    results.failed++
  } else {
    results.passed++
  }
}

// Report results
console.log('━'.repeat(60))
console.log('📊 VALIDATION RESULTS')
console.log('━'.repeat(60))
console.log(`Total entries: ${results.total}`)
console.log(`✅ Passed: ${results.passed} (${((results.passed / results.total) * 100).toFixed(1)}%)`)
console.log(`❌ Failed: ${results.failed} (${((results.failed / results.total) * 100).toFixed(1)}%)`)
console.log()

// Statistics
console.log('📈 STATISTICS')
console.log('━'.repeat(60))
console.log(`Entries with labels: ${stats.withLabels} (${((stats.withLabels / results.total) * 100).toFixed(1)}%)`)
if (stats.withIPA > 0) {
  console.log(`Entries with IPA: ${stats.withIPA} (${((stats.withIPA / results.total) * 100).toFixed(1)}%)`)
}
if (stats.withThesaurus > 0) {
  console.log(`Entries with thesaurus: ${stats.withThesaurus} (${((stats.withThesaurus / results.total) * 100).toFixed(1)}%)`)
}
if (stats.withOrigin > 0) {
  console.log(`Entries with origin: ${stats.withOrigin} (${((stats.withOrigin / results.total) * 100).toFixed(1)}%)`)
}
if (stats.withQuotes > 0) {
  console.log(`Entries with quotes: ${stats.withQuotes} (${((stats.withQuotes / results.total) * 100).toFixed(1)}%)`)
}
console.log()

// Issue details
if (results.issues.invalidStructure.length > 0) {
  console.log(`❌ Invalid structure: ${results.issues.invalidStructure.length}`)
  console.log('   Examples:', results.issues.invalidStructure.slice(0, 3).map(i => 
    `${i.word}: ${i.reason}`
  ).join(' | '))
  console.log()
}

if (results.issues.posNotSplit.length > 0) {
  console.log(`❌ POS not split correctly (Chinese in pos field): ${results.issues.posNotSplit.length}`)
  console.log('   Examples:', results.issues.posNotSplit.slice(0, 3).map(i => `${i.word}: ${i.pos}`).join(', '))
  console.log()
}

if (results.issues.refToNotFlat.length > 0) {
  console.log(`❌ refTo not flattened (should be string[], not object[]): ${results.issues.refToNotFlat.length}`)
  console.log('   Examples:', results.issues.refToNotFlat.slice(0, 3).map(i => i.word).join(', '))
  console.log()
}

if (results.issues.labelMarkersInJson.length > 0) {
  console.log(`❌ Label markers (】) found in JSON (should be extracted): ${results.issues.labelMarkersInJson.length}`)
  console.log('   Examples:', results.issues.labelMarkersInJson.slice(0, 3).map(i => 
    `${i.word}: ${i.locations.join(', ')}`
  ).join(' | '))
  console.log()
}

console.log('━'.repeat(60))

if (results.failed === 0) {
  console.log('✅ All checks passed!')
} else {
  console.log(`⚠️  ${results.failed} entries failed validation`)
}

console.log()
process.exit(results.failed > 0 ? 1 : 0)

