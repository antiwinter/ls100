#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Analyze HTML structure of 2015 dictionary samples
 */

import * as cheerio from 'cheerio'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const samplesDir = path.join(__dirname, 'samples')
const htmlFiles = fs.readdirSync(samplesDir).filter(f => f.endsWith('.html'))

if (htmlFiles.length === 0) {
  console.error('No HTML samples found. Run extract-sample.js first.')
  process.exit(1)
}

console.log(`📊 Analyzing ${htmlFiles.length} samples...\n`)

const allClasses = new Set()
const containers = {
  '.c1a': 0,      // Main container
  '.fvv': 0,      // Tabs
  '.dxr': 0,      // Dictionary
  '.tvr': 0,      // Thesaurus
  '.roj': 0,      // Origin
  '.exq': 0,      // Quotes
  '.t6l': 0       // Quotes container
}

const posClasses = new Set()
const defClasses = new Set()
const exampleClasses = new Set()

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(samplesDir, file), 'utf8')
  const $ = cheerio.load(html)
  
  // Count main containers
  for (const selector in containers) {
    containers[selector] += $(selector).length
  }
  
  // Collect all classes
  $('*').each((i, el) => {
    const classes = $(el).attr('class')
    if (classes) {
      classes.split(/\s+/).forEach(c => allClasses.add(c))
    }
  })
  
  // Collect POS-related classes
  $('[class*="jnw"], [class*="sg0"]').each((i, el) => {
    const classes = $(el).attr('class')
    if (classes) {
      classes.split(/\s+/).forEach(c => posClasses.add(c))
    }
  })
  
  // Collect definition-related classes
  $('[class*="iji"], [class*="sd9"]').each((i, el) => {
    const classes = $(el).attr('class')
    if (classes) {
      classes.split(/\s+/).forEach(c => defClasses.add(c))
    }
  })
  
  // Collect example-related classes
  $('[class*="u9w"], [class*="k75"]').each((i, el) => {
    const classes = $(el).attr('class')
    if (classes) {
      classes.split(/\s+/).forEach(c => exampleClasses.add(c))
    }
  })
}

console.log('=== Main Containers ===')
for (const [selector, count] of Object.entries(containers)) {
  if (count > 0) {
    console.log(`${selector.padEnd(10)} ${count} occurrences`)
  }
}

console.log(`\n=== Structure Summary ===`)
console.log(`Total unique classes: ${allClasses.size}`)
console.log(`POS classes: ${posClasses.size}`)
console.log(`Definition classes: ${defClasses.size}`)
console.log(`Example classes: ${exampleClasses.size}`)

console.log(`\n=== Key Classes ===`)
console.log('POS:', Array.from(posClasses).slice(0, 10).join(', '))
console.log('Def:', Array.from(defClasses).slice(0, 10).join(', '))
console.log('Ex: ', Array.from(exampleClasses).slice(0, 10).join(', '))

// Analyze one sample in detail
console.log(`\n=== Detailed Analysis: ability.html ===`)
const abilityHtml = fs.readFileSync(path.join(samplesDir, 'ability.html'), 'utf8')
const $ = cheerio.load(abilityHtml)

console.log('Main structure:')
console.log(`  .c1a:     ${$('.c1a').length} (main container)`)
console.log(`  .fvv:     ${$('.fvv').length} (tabs)`)
console.log(`  .dxr:     ${$('.dxr').length} (dictionary section)`)
console.log(`  .tvr:     ${$('.tvr').length} (thesaurus section)`)
console.log(`  .roj:     ${$('.roj').length} (origin/etymology)`)
console.log(`  .exq:     ${$('.exq').length} (quotes section)`)

console.log('\nDictionary content:')
console.log(`  .j84:     ${$('.j84').length} (entry blocks)`)
console.log(`  .quf:     ${$('.quf').length} (headword with IPA)`)
console.log(`  .kf5:     ${$('.kf5').length} (IPA pronunciation)`)
console.log(`  .x5z:     ${$('.x5z').length} (POS sections)`)
console.log(`  .jnw:     ${$('.jnw').length} (POS headers)`)
console.log(`  .sg0:     ${$('.sg0').length} (POS labels)`)
console.log(`  .iji:     ${$('.iji').length} (definition items)`)
console.log(`  .sd9:     ${$('.sd9').length} (definition text)`)
console.log(`  .u9w:     ${$('.u9w').length} (example text)`)

console.log('\n✅ Done!')

