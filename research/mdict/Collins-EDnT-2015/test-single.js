#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Test parser on a single word
 */

import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'
import { Collins2015Parser } from './parser-2015.js'

const word = process.argv[2] || 'ability'
const mdxPath = '/Users/warits/code/ls100/server/lib/collins/Collins English Dictionary and Thesaurus, 2015.mdx'

console.log(`🧪 Testing parser on: "${word}"\n`)

// Load MDX
const mdx = new MDX(mdxPath)
const result = mdx.lookup(word)

if (!result || !result.definition) {
  console.error(`❌ Word not found: ${word}`)
  process.exit(1)
}

const html = result.definition
const $ = cheerio.load(html)

// Show MDX structure
console.log('=== MDX Structure ===')
console.log(`HTML size: ${(Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)} KB`)
console.log(`Has dictionary: ${$('.dxr').length > 0 ? 'Yes' : 'No'}`)
console.log(`Has thesaurus: ${$('.tvr').length > 0 ? 'Yes' : 'No'}`)
console.log(`Has origin: ${$('.roj').length > 0 ? 'Yes' : 'No'}`)
console.log(`Has quotes: ${$('.exq').length > 0 ? 'Yes' : 'No'}`)
console.log(`IPA: ${$('.kf5').text() || 'None'}`)
console.log(`POS sections: ${$('.x5z').length}`)
console.log(`Definitions: ${$('.iji').length}`)
console.log(`Examples: ${$('.u9w').length}`)

// Run parser
console.log('\n=== Parser Output ===')
const parser = new Collins2015Parser(word)

// Walk DOM
function walkDOM(node, parser) {
  if (node.type === 'tag') {
    const classes = node.attribs && node.attribs.class ? node.attribs.class.split(/\s+/) : []
    const attrs = node.attribs || {}
    const path = [] // Would need to track this properly
    
    parser.startElement(node.name, classes, attrs, path)
    
    if (node.children) {
      node.children.forEach(child => walkDOM(child, parser))
    }
    
    parser.endElement(node.name, classes)
  } else if (node.type === 'text' && node.data.trim()) {
    parser.text(node.data.trim())
  }
}

walkDOM($.root()[0], parser)
const output = parser.finish()

console.log(JSON.stringify(output.result, null, 2))

// Show unknown patterns
if (output.unknownPatterns && output.unknownPatterns.length > 0) {
  console.log('\n=== Unknown Patterns ===')
  const grouped = {}
  output.unknownPatterns.forEach(p => {
    const key = `${p.state} → ${p.selector}`
    grouped[key] = (grouped[key] || 0) + 1
  })
  Object.entries(grouped).forEach(([pattern, count]) => {
    console.log(`${pattern}: ${count}x`)
  })
}

console.log('\n✅ Done!')

