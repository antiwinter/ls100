#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Validate converted JSON against original MDX
 * Tests: POS split, Chinese text, refTo flattening, nested examples, etc.
 */

import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'
import fs from 'fs'

const mdxPath = '/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx'
const jsonPath = process.argv[2] || '/Users/warits/code/ls100/research/mdict/1/collins-ece-1000-abandon.json'

console.log('🧪 Validating conversion...\n')
console.log(`MDX: ${mdxPath}`)
console.log(`JSON: ${jsonPath}\n`)

const mdx = new MDX(mdxPath)
const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))

const results = {
  total: entries.length,
  passed: 0,
  failed: 0,
  issues: {
    posNotSplit: [],
    missingZhInExamples: [],
    refToNotFlat: [],
    missingNestedExamples: [],
    missingDefs: []
  }
}

for (const entry of entries) {
  const word = entry.word
  const mdxResult = mdx.lookup(word)
  if (!mdxResult || !mdxResult.definition) continue
  
  const html = mdxResult.definition
  const $ = cheerio.load(html)
  
  let hasIssues = false
  
  // Test 1: POS should be split correctly (no Chinese in English POS)
  for (const def of entry.defs) {
    if (def.pos && /[\u4e00-\u9fa5]/.test(def.pos)) {
      results.issues.posNotSplit.push({ word, pos: def.pos })
      hasIssues = true
    }
  }
  
  // Test 2: Examples should have Chinese translations (where they exist in MDX)
  $('div.collins_en_cn ul li').each((idx, el) => {
    const pTags = $(el).find('> p')
    if (pTags.length >= 2) {
      // Has both English and Chinese
      const zhText = $(pTags[1]).text().trim()
      if (zhText) {
        // Find corresponding example in JSON
        const enText = $(pTags[0]).text().trim()
        const jsonDef = entry.defs.find(d => 
          d.exs && d.exs.some(ex => ex.en && enText.includes(ex.en.substring(0, 20)))
        )
        if (jsonDef) {
          const jsonEx = jsonDef.exs.find(ex => ex.en && enText.includes(ex.en.substring(0, 20)))
          if (jsonEx && !jsonEx.zh) {
            results.issues.missingZhInExamples.push({ word, example: enText.substring(0, 50) })
            hasIssues = true
          }
        }
      }
    }
  })
  
  // Test 3: refTo should be flat array, not nested
  if (entry.refTo && entry.refTo.length > 0) {
    if (typeof entry.refTo[0] === 'object' && entry.refTo[0].phrases) {
      results.issues.refToNotFlat.push({ word, refTo: entry.refTo })
      hasIssues = true
    }
  }
  
  // Test 4: Nested examples (en_tip with vli ul) should be captured
  $('li.en_tip').each((idx, el) => {
    const nestedUl = $(el).find('ul.vli')
    if (nestedUl.length > 0) {
      const nestedCount = nestedUl.find('> li').length
      if (nestedCount > 0) {
        // Check if JSON has this usage note with nested examples
        const usageNoteText = $(el).find('> b').first().text().trim()
        let found = false
        
        for (const def of entry.defs) {
          for (const ex of def.exs) {
            if (ex.en && ex.en.includes(usageNoteText) && ex.exs && ex.exs.length === nestedCount) {
              found = true
              break
            }
          }
          if (found) break
        }
        
        if (!found) {
          results.issues.missingNestedExamples.push({ 
            word, 
            usageNote: usageNoteText,
            nestedCount 
          })
          hasIssues = true
        }
      }
    }
  })
  
  // Test 5: Number of definitions should match (roughly)
  const mdxDefCount = $('div.collins_en_cn').length
  const jsonDefCount = entry.defs.length
  if (mdxDefCount > 0 && Math.abs(mdxDefCount - jsonDefCount) > 1) {
    results.issues.missingDefs.push({ word, mdx: mdxDefCount, json: jsonDefCount })
    hasIssues = true
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

if (results.issues.posNotSplit.length > 0) {
  console.log(`❌ POS not split correctly: ${results.issues.posNotSplit.length}`)
  console.log('   Examples:', results.issues.posNotSplit.slice(0, 3).map(i => `${i.word}: ${i.pos}`).join(', '))
  console.log()
}

if (results.issues.missingZhInExamples.length > 0) {
  console.log(`❌ Missing Chinese in examples: ${results.issues.missingZhInExamples.length}`)
  console.log('   Examples:', results.issues.missingZhInExamples.slice(0, 3).map(i => `${i.word}: ${i.example}`).join(' | '))
  console.log()
}

if (results.issues.refToNotFlat.length > 0) {
  console.log(`❌ refTo not flattened: ${results.issues.refToNotFlat.length}`)
  console.log('   Examples:', results.issues.refToNotFlat.slice(0, 3).map(i => i.word).join(', '))
  console.log()
}

if (results.issues.missingNestedExamples.length > 0) {
  console.log(`❌ Missing nested examples: ${results.issues.missingNestedExamples.length}`)
  console.log('   Examples:', results.issues.missingNestedExamples.slice(0, 3).map(i => 
    `${i.word} (${i.nestedCount} nested)`
  ).join(', '))
  console.log()
}

if (results.issues.missingDefs.length > 0) {
  console.log(`❌ Definition count mismatch: ${results.issues.missingDefs.length}`)
  console.log('   Examples:', results.issues.missingDefs.slice(0, 3).map(i => 
    `${i.word} (MDX:${i.mdx} JSON:${i.json})`
  ).join(', '))
  console.log()
}

console.log('━'.repeat(60))
process.exit(results.failed > 0 ? 1 : 0)

