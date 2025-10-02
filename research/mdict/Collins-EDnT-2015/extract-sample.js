#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Extract HTML samples for specific words from 2015 MDX
 */

import { MDX } from 'js-mdict'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const mdxPath = '/Users/warits/code/ls100/server/lib/collins/Collins English Dictionary and Thesaurus, 2015.mdx'
const words = process.argv.slice(2)

if (words.length === 0) {
  console.error('Usage: node extract-sample.js <word1> [word2] ...')
  console.error('Example: node extract-sample.js ability happy love')
  process.exit(1)
}

console.log('🔍 Extracting samples from 2015 dictionary...\n')

const mdx = new MDX(mdxPath)
const samplesDir = path.join(__dirname, 'samples')

// Create samples directory
if (!fs.existsSync(samplesDir)) {
  fs.mkdirSync(samplesDir, { recursive: true })
}

for (const word of words) {
  console.log(`Extracting: ${word}`)
  
  const result = mdx.lookup(word)
  
  if (!result || !result.definition) {
    console.log(`  ❌ Not found`)
    continue
  }
  
  const outputPath = path.join(samplesDir, `${word}.html`)
  fs.writeFileSync(outputPath, result.definition, 'utf8')
  
  const size = Buffer.byteLength(result.definition, 'utf8')
  console.log(`  ✅ Saved to ${path.basename(outputPath)} (${(size / 1024).toFixed(1)} KB)`)
}

console.log(`\n✅ Done! Samples in: ${samplesDir}`)

