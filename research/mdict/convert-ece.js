import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import { MDX } from 'js-mdict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MDX_FILE = path.join(__dirname, 'Collins-Advanced-ECE.mdx')
const OUTPUT_FILE = path.join(__dirname, '1/collins-ece-1000.json')

console.log('🔄 Starting Collins-Advanced-ECE Conversion...\n')

// Load MDX file
console.log('📖 Loading MDX file...')
const mdx = new MDX(MDX_FILE)
console.log('✅ MDX loaded\n')

const keywordList = mdx.keywordList || []
console.log(`Total entries available: ${keywordList.length}`)

const SAMPLE_SIZE = 1000
const entriesToProcess = keywordList.slice(0, SAMPLE_SIZE)
console.log(`Converting first ${entriesToProcess.length} entries...\n`)

const results = []
let successCount = 0
let errorCount = 0

for (let i = 0; i < entriesToProcess.length; i++) {
  const keywordItem = entriesToProcess[i]
  const word = keywordItem.keyText
  
  try {
    // Lookup definition from MDX
    const result = mdx.lookup(word)
    if (!result || !result.definition) {
      errorCount++
      continue
    }
    
    const html = result.definition
    const entry = parseECEEntry(html, word)
    
    if (entry) {
      results.push(entry)
      successCount++
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${entriesToProcess.length} entries (${successCount} success, ${errorCount} errors)`)
    }
  } catch (error) {
    console.warn(`  ⚠️  Error processing "${word}": ${error.message}`)
    errorCount++
  }
}

console.log(`\n✅ Conversion complete!`)
console.log(`   Success: ${successCount}`)
console.log(`   Errors: ${errorCount}`)
console.log(`   Total: ${results.length}\n`)

// Save to JSON
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8')
console.log(`💾 Saved to: ${OUTPUT_FILE}`)
console.log(`   File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB\n`)

// Generate statistics
const stats = generateStats(results)
console.log('━'.repeat(80))
console.log('📊 CONVERSION STATISTICS')
console.log('━'.repeat(80))
console.log(`Total entries: ${stats.total}`)
console.log(`With Chinese: ${stats.withChinese} (${(stats.withChinese / stats.total * 100).toFixed(1)}%)`)
console.log(`With examples: ${stats.withExamples} (${(stats.withExamples / stats.total * 100).toFixed(1)}%)`)
console.log(`Average definitions per entry: ${stats.avgDefinitions}`)
console.log(`Average examples per entry: ${stats.avgExamples}`)
console.log(`Part of speech types found: ${stats.posTypes.length}`)
console.log(`  Top 10: ${stats.posTypes.slice(0, 10).join(', ')}`)
console.log()

// Show sample entries
console.log('━'.repeat(80))
console.log('📝 SAMPLE ENTRIES (first 3)')
console.log('━'.repeat(80))
for (let i = 0; i < Math.min(3, results.length); i++) {
  const entry = results[i]
  console.log(`\n${i + 1}. "${entry.word}"`)
  console.log(`   Definitions: ${entry.definitions.length}`)
  if (entry.definitions[0]) {
    const def = entry.definitions[0]
    console.log(`   POS: ${def.partOfSpeech}`)
    console.log(`   CN: ${def.chinese?.substring(0, 60) || 'N/A'}`)
    console.log(`   EN: ${def.english?.substring(0, 80) || 'N/A'}...`)
    console.log(`   Examples: ${def.examples.length}`)
  }
}
console.log()

console.log('━'.repeat(80))
console.log('✅ Done! Review the output and run full extraction if satisfied.\n')

// ============= Parser Function =============
function parseECEEntry(html, word) {
  const $ = cheerio.load(html)
  
  const entry = {
    word: word || '',
    source: 'Collins-Advanced-ECE',
    definitions: [],
    rawHTML: html
  }
  
  // Backup: Extract headword from HTML if not provided
  if (!entry.word) {
    const headword = $('font[color="purple"]').first().text().trim()
    if (headword) {
      entry.word = headword
    }
  }
  
  // Extract definitions from each .caption section
  $('.caption').each((_, captionEl) => {
    const definition = {
      partOfSpeech: '',
      chinese: '',
      english: '',
      examples: []
    }
    
    // Extract part of speech from .st
    const posEl = $(captionEl).find('.st')
    if (posEl.length) {
      let posText = posEl.text().trim()
      // Clean up: remove extra whitespace and newlines
      posText = posText.replace(/\s+/g, ' ').trim()
      definition.partOfSpeech = posText
    }
    
    // Extract Chinese translation from .text_blue
    const chineseEl = $(captionEl).find('.text_blue')
    if (chineseEl.length) {
      definition.chinese = chineseEl.text().trim()
    }
    
    // Extract English definition
    // Clone caption, remove unwanted elements, get remaining text
    let englishDef = $(captionEl).clone()
    englishDef.find('.st, .text_blue, .num').remove()
    let englishText = englishDef.text().trim()
    // Clean up multiple spaces and newlines
    englishText = englishText.replace(/\s+/g, ' ').trim()
    definition.english = englishText
    
    // Find examples in the next <ul> sibling
    const parentDiv = $(captionEl).parent()
    const nextUl = parentDiv.find('ul').first()
    
    if (nextUl.length) {
      nextUl.find('li').each((_, liEl) => {
        const paragraphs = $(liEl).find('p')
        const example = {
          english: '',
          chinese: ''
        }
        
        if (paragraphs.length >= 1) {
          example.english = $(paragraphs[0]).text().trim()
        }
        if (paragraphs.length >= 2) {
          example.chinese = $(paragraphs[1]).text().trim()
        }
        
        // Only add if we have at least English text
        if (example.english) {
          definition.examples.push(example)
        }
      })
    }
    
    // Only add definition if it has content
    if (definition.partOfSpeech || definition.chinese || definition.english || definition.examples.length > 0) {
      entry.definitions.push(definition)
    }
  })
  
  // Fallback: If no .caption found, try alternative structure
  if (entry.definitions.length === 0) {
    // Check for .collins_en_cn structure without .caption
    const contentEl = $('.collins_en_cn').first()
    if (contentEl.length) {
      const definition = {
        partOfSpeech: '',
        chinese: '',
        english: '',
        examples: []
      }
      
      // Try to extract any structured content
      const text = contentEl.text().trim()
      if (text) {
        definition.english = text
      }
      
      // Extract examples from ul > li
      contentEl.find('ul li').each((_, liEl) => {
        const paragraphs = $(liEl).find('p')
        const example = {
          english: '',
          chinese: ''
        }
        
        if (paragraphs.length >= 1) {
          example.english = $(paragraphs[0]).text().trim()
        }
        if (paragraphs.length >= 2) {
          example.chinese = $(paragraphs[1]).text().trim()
        }
        
        if (example.english) {
          definition.examples.push(example)
        }
      })
      
      if (definition.english || definition.examples.length > 0) {
        entry.definitions.push(definition)
      }
    }
  }
  
  return entry
}

// ============= Statistics Generator =============
function generateStats(entries) {
  const stats = {
    total: entries.length,
    withChinese: 0,
    withExamples: 0,
    avgDefinitions: 0,
    avgExamples: 0,
    posTypes: new Set()
  }
  
  let totalDefinitions = 0
  let totalExamples = 0
  
  for (const entry of entries) {
    totalDefinitions += entry.definitions.length
    
    let hasChineseInEntry = false
    let examplesInEntry = 0
    
    for (const def of entry.definitions) {
      if (def.chinese) {
        hasChineseInEntry = true
      }
      if (def.partOfSpeech) {
        stats.posTypes.add(def.partOfSpeech)
      }
      examplesInEntry += def.examples.length
      totalExamples += def.examples.length
    }
    
    if (hasChineseInEntry) {
      stats.withChinese++
    }
    if (examplesInEntry > 0) {
      stats.withExamples++
    }
  }
  
  stats.avgDefinitions = (totalDefinitions / entries.length).toFixed(2)
  stats.avgExamples = (totalExamples / entries.length).toFixed(2)
  stats.posTypes = Array.from(stats.posTypes).sort()
  
  return stats
}
