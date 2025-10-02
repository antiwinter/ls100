#!/usr/bin/env node

/**
 * Example usage of word-standardizer
 * 
 * Demonstrates how to use the standardizeWord function
 * for dictionary lookups
 */

import { standardizeWord, standardizeWords } from './word-standardizer.js'

console.log('📚 Word Standardizer Demo\n')

// Single words
console.log('Single word standardization:')
const examples = [
  'books', 'children', 'people', 'going', 'went', 'better',
  'happily', "company's", 'running', 'stopped', 'watches'
]

examples.forEach(word => {
  const standardized = standardizeWord(word)
  console.log(`  ${word.padEnd(12)} → ${standardized}`)
})

// Multiple words at once
console.log('\nBatch standardization:')
const batch = ['running', 'jumping', 'swimming', 'playing']
const standardized = standardizeWords(batch)
console.log(`  Input:  ${batch.join(', ')}`)
console.log(`  Output: ${standardized.join(', ')}`)

// Performance test
console.log('\nPerformance test:')
const testWords = []
for (let i = 0; i < 1000; i++) {
  testWords.push(examples[i % examples.length])
}

const start = Date.now()
standardizeWords(testWords)
const elapsed = Date.now() - start

console.log(`  Standardized ${testWords.length} words in ${elapsed}ms`)
console.log(`  Average: ${(elapsed / testWords.length).toFixed(3)}ms per word`)

