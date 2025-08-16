import { lookupPronunciation } from './lib/collins/phonetic.js'

const testCases = [
  // Original test cases
  { word: 'world', expected: 'wɜːrld' },
  { word: 'beautiful', expected: 'ˈbjuːtɪfl' },
  { word: 'hello', expected: 'həˈloʊ' },
  { word: 'test', expected: 'test' },
  { word: 'water', expected: 'ˈwɔːtər' },
  { word: 'computer', expected: 'kəmˈpjuːtər' },
  
  // Additional test cases to verify systematic approach
  { word: 'happy', expected: 'ˈhæpi' },
  { word: 'running', expected: 'ˈrʌnɪŋ' },
  { word: 'better', expected: 'ˈbetər' },
  { word: 'sister', expected: 'ˈsɪstər' },
  { word: 'wonder', expected: 'ˈwʌndər' },
  { word: 'simple', expected: 'ˈsɪmpəl' },
  { word: 'table', expected: 'ˈteɪbəl' },
  { word: 'possible', expected: 'ˈpɑːsəbəl' },
  { word: 'important', expected: 'ɪmˈpɔːrtənt' },
  { word: 'understand', expected: 'ˌʌndərˈstænd' }
]

console.log('IPA Pronunciation Testing - Extended')
console.log('=' .repeat(60))

let passCount = 0
let totalCount = testCases.length

for (const { word, expected } of testCases) {
  const actual = lookupPronunciation(word, 'ipa')
  const arpabet = lookupPronunciation(word, 'arpabet')
  const match = actual === expected
  
  if (match) passCount++
  
  console.log(`${word}:`)
  console.log(`  ARPABET:  ${arpabet}`)
  console.log(`  Expected: /${expected}/`)
  console.log(`  Actual:   /${actual}/`)
  console.log(`  Match:    ${match ? '✅' : '❌'}`)
  console.log('')
}

console.log(`Summary: ${passCount}/${totalCount} tests passing (${Math.round(passCount/totalCount*100)}%)`)

// Analysis summary
console.log('\nStress Pattern Analysis:')
console.log('Words with primary stress only (ending in 1):')
testCases.forEach(({ word }) => {
  const arpabet = lookupPronunciation(word, 'arpabet')
  if (arpabet.includes('1') && !arpabet.includes('2')) {
    console.log(`  ${word}: ${arpabet}`)
  }
})

console.log('\nWords with both primary and secondary stress (1 and 2):')
testCases.forEach(({ word }) => {
  const arpabet = lookupPronunciation(word, 'arpabet')
  if (arpabet.includes('1') && arpabet.includes('2')) {
    console.log(`  ${word}: ${arpabet}`)
  }
})

console.log('\nWords with no stress marks:')
testCases.forEach(({ word }) => {
  const arpabet = lookupPronunciation(word, 'arpabet')
  if (!arpabet.includes('1') && !arpabet.includes('2')) {
    console.log(`  ${word}: ${arpabet}`)
  }
})
