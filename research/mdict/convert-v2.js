#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Generic Dictionary Converter v2
 * 
 * Walks through HTML DOM and feeds elements to a pluggable parser.
 * Parser-agnostic architecture - works with any parser that implements:
 * - startElement(tag, classes, attrs, path)
 * - text(content)
 * - endElement(tag, classes)
 * - finish() -> { result, unknownPatterns }
 */

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import { MDX } from 'js-mdict'
import { parseArgs } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============= CLI Configuration =============
const { values: args, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    parser: {
      type: 'string',
      short: 'p',
      default: 'ece'
    },
    output: {
      type: 'string',
      short: 'o'
    },
    start: {
      type: 'string',
      short: 's'
    },
    count: {
      type: 'string',
      short: 'c'
    },
    help: {
      type: 'boolean',
      short: 'h'
    }
  },
  allowPositionals: true
})

// Show help
if (args.help || positionals.length === 0) {
  console.log(`
📚 Dictionary Converter v2 (Stream Parser)

Usage:
  convert-v2.js <mdx-file> [options]

Arguments:
  <mdx-file>          Path to MDX dictionary file

Options:
  -p, --parser <name>   Parser to use (default: ece)
                        Available: ece
  -o, --output <file>   Output JSON file (default: <mdx-name>-converted.json)
  -s, --start <word>    Start from specific word (default: from beginning)
  -c, --count <num>     Number of entries to convert (default: all)
  -h, --help            Show this help message

Examples:
  # Convert first 1000 entries
  ./convert-v2.js Collins-Advanced-ECE.mdx -c 1000

  # Convert starting from 'abandon'
  ./convert-v2.js Collins-Advanced-ECE.mdx --start=abandon -c 500

  # Convert all entries
  ./convert-v2.js Collins-Advanced-ECE.mdx -o output.json

  # Use different parser
  ./convert-v2.js Other-Dictionary.mdx --parser=ee
`)
  process.exit(0)
}

// ============= Parse Arguments =============
const mdxFile = positionals[0]
if (!mdxFile) {
  console.error('❌ Error: MDX file path is required\n')
  console.error('Run with --help for usage information')
  process.exit(1)
}

const mdxPath = path.isAbsolute(mdxFile) ? mdxFile : path.resolve(process.cwd(), mdxFile)
if (!fs.existsSync(mdxPath)) {
  console.error(`❌ Error: MDX file not found: ${mdxPath}`)
  process.exit(1)
}

const parserName = args.parser
const startWord = args.start
const count = args.count ? parseInt(args.count, 10) : null
const outputFile = args.output || path.join(
  path.dirname(mdxPath),
  `${path.basename(mdxFile, '.mdx')}-converted.json`
)

// ============= Load Parser =============
// Map parser names to their locations
const parserLocations = {
  'ece': './Collins-Advanced-ECE/parser-ece.js',
  '2015': './Collins-EDnT-2015/parser-2015.js'
}

let ParserClass
try {
  // Try mapped location first, then fallback to root
  const parserPath = parserLocations[parserName] || `./parser-${parserName}.js`
  const parserModule = await import(parserPath)
  
  // Try different export patterns
  ParserClass = parserModule.default || parserModule.ECEParser || parserModule.Parser || parserModule[Object.keys(parserModule)[0]]
  
  if (!ParserClass) {
    throw new Error(`Parser module '${parserPath}' does not export a parser class`)
  }
} catch (error) {
  console.error(`❌ Error loading parser '${parserName}':`, error.message)
  console.error(`\nMake sure parser exists in correct location:`)
  console.error(`  - ECE: Collins-Advanced-ECE/parser-ece.js`)
  console.error(`  - 2015: Collins-EDnT-2015/parser-2015.js`)
  console.error(`  - Or: parser-${parserName}.js`)
  process.exit(1)
}

// ============= Main Conversion =============
console.log('🔄 Dictionary Converter v2 (Stream Parser)\n')
console.log(`Input:  ${mdxPath}`)
console.log(`Output: ${outputFile}`)
console.log(`Parser: ${parserName}`)
if (startWord) console.log(`Start:  ${startWord}`)
if (count) console.log(`Count:  ${count}`)
console.log()

// Load MDX
console.log('📖 Loading MDX file...')
const mdx = new MDX(mdxPath)
console.log('✅ MDX loaded\n')

const keywordList = mdx.keywordList || []
console.log(`Total entries in MDX: ${keywordList.length}`)

// Determine start index
let startIndex = 0
if (startWord) {
  startIndex = keywordList.findIndex(item => item.keyText === startWord)
  if (startIndex === -1) {
    console.warn(`⚠️  Warning: Start word '${startWord}' not found, starting from beginning`)
    startIndex = 0
  } else {
    console.log(`Starting from: ${startWord} (index ${startIndex})`)
  }
}

// Determine entries to process
const endIndex = count ? Math.min(startIndex + count, keywordList.length) : keywordList.length
const entriesToProcess = keywordList.slice(startIndex, endIndex)

console.log(`Converting ${entriesToProcess.length} entries...\n`)

const results = []
const unknownPatternsLog = []
let successCount = 0
let errorCount = 0

for (let i = 0; i < entriesToProcess.length; i++) {
  const keywordItem = entriesToProcess[i]
  const word = keywordItem.keyText
  
  try {
    const result = mdx.lookup(word)
    if (!result || !result.definition) {
      errorCount++
      continue
    }
    
    const html = result.definition
    const parsed = parseEntry(word, html, ParserClass)
    
    if (parsed.result) {
      results.push(parsed.result)
      successCount++
      
      // Log unknown patterns
      if (parsed.unknownPatterns && parsed.unknownPatterns.length > 0) {
        unknownPatternsLog.push({
          word,
          patterns: parsed.unknownPatterns
        })
      }
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`  Processed ${i + 1}/${entriesToProcess.length} (${successCount} success, ${errorCount} errors)`)
    }
  } catch (error) {
    console.warn(`  ⚠️  Error processing "${word}": ${error.message}`)
    errorCount++
  }
}

console.log('\n✅ Conversion complete!')
console.log(`   Success: ${successCount}`)
console.log(`   Errors: ${errorCount}\n`)

// Save results
fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8')
console.log(`💾 Saved to: ${outputFile}`)
console.log(`   File size: ${(fs.statSync(outputFile).size / 1024 / 1024).toFixed(2)} MB\n`)

// Report unknown patterns
if (unknownPatternsLog.length > 0) {
  console.log('━'.repeat(80))
  console.log('⚠️  UNKNOWN PATTERNS DETECTED')
  console.log('━'.repeat(80))
  console.log(`Found unknown patterns in ${unknownPatternsLog.length} entries:\n`)
  
  // Group by pattern
  const patternGroups = {}
  for (const entry of unknownPatternsLog) {
    for (const pattern of entry.patterns) {
      const key = `${pattern.state} → ${pattern.selector}`
      if (!patternGroups[key]) {
        patternGroups[key] = {
          count: 0,
          examples: [],
          samplePath: pattern.path
        }
      }
      patternGroups[key].count++
      if (patternGroups[key].examples.length < 3) {
        patternGroups[key].examples.push(entry.word)
      }
    }
  }
  
  // Sort by frequency
  const sorted = Object.entries(patternGroups)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20) // Top 20
  
  for (const [pattern, data] of sorted) {
    console.log(`${pattern}: ${data.count} occurrences`)
    console.log(`  Examples: ${data.examples.join(', ')}`)
    console.log()
  }
}

// Show sample results
console.log('━'.repeat(80))
console.log('📝 SAMPLE RESULTS (first 3)')
console.log('━'.repeat(80))
console.log()

for (let i = 0; i < Math.min(3, results.length); i++) {
  const entry = results[i]
  console.log(`${i + 1}. "${entry.word}"`)
  
  if (entry.defs && entry.defs.length > 0) {
    console.log(`   Definitions: ${entry.defs.length}`)
    const def = entry.defs[0]
    if (def.pos) console.log(`   POS: ${def.pos} ${def.posZh || ''}`)
    if (def.zh) console.log(`   ZH: ${def.zh.substring(0, 50)}...`)
    if (def.en) console.log(`   EN: ${def.en.substring(0, 60)}...`)
    if (def.exs) console.log(`   Examples: ${def.exs.length}`)
  } else {
    console.log('   (No definitions extracted)')
  }
  
  if (entry.refTo && entry.refTo.length > 0) {
    console.log(`   RefTo: ${entry.refTo.map(r => r.phrases?.join(', ') || '').join('; ')}`)
  }
  console.log()
}

console.log('━'.repeat(80))
console.log('✅ Done!\n')

// ============= Parser-Agnostic Functions =============

/**
 * Parse a single entry using the specified parser class
 * This function is parser-agnostic - it just walks the DOM and feeds events
 * 
 * @param {string} word - The word/entry being parsed
 * @param {string} html - The HTML content
 * @param {class} ParserClass - Parser class to instantiate
 * @returns {{result: object, unknownPatterns: array}}
 */
function parseEntry(word, html, ParserClass) {
  const $ = cheerio.load(html)
  const parser = new ParserClass(word)
  
  // Walk the DOM tree (get first element, which is the root)
  const root = $.root()[0]
  if (root) {
    walkDOM(root, parser, $)
  }
  
  // Finalize parsing
  return parser.finish()
}

/**
 * Recursively walk the DOM tree and feed events to parser
 * This function is completely parser-agnostic
 * 
 * @param {object} node - DOM node
 * @param {object} parser - Parser instance (must implement startElement, text, endElement)
 * @param {object} $ - Cheerio instance
 * @param {array} pathStack - Current path in DOM tree
 */
function walkDOM(node, parser, $, pathStack = []) {
  // Process each child node (including text nodes)
  node.childNodes?.forEach((child) => {
    // Handle text nodes
    if (child.type === 'text') {
      const text = child.data
      if (text && text.trim()) {
        parser.text(text)
      }
      return
    }
    
    // Skip comments and other non-element nodes
    if (child.type !== 'tag') {
      return
    }
    
    const tag = child.tagName || child.name
    
    // Get classes and attributes
    const classes = (child.attribs?.class || '').split(/\s+/).filter(Boolean)
    const attrs = child.attribs || {}
    
    // Build path
    const classStr = classes.length > 0 ? `.${classes.join('.')}` : ''
    const selector = `${tag}${classStr}`
    const newPath = [...pathStack, selector]
    
    // Start element
    parser.startElement(tag, classes, attrs, newPath)
    
    // Process children recursively
    walkDOM(child, parser, $, newPath)
    
    // End element
    parser.endElement(tag, classes)
  })
}

