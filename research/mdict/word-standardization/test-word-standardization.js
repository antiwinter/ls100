#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Word Standardization Research
 * 
 * Tests dictionary lookup success rate for inflected words
 * with and without lemmatization/stemming.
 * 
 * Method:
 * 1. Test 100 words with realistic inflections (plurals, -ed, -ing, 's, etc)
 * 2. Look up directly in ECE and 2015 dictionaries
 * 3. Apply lemmatization and look up again
 * 4. Compare statistics
 */

import path from 'path'
import { fileURLToPath } from 'url'
import { MDX } from 'js-mdict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ============= Test Words =============
// 100 words in real usage (with inflections)
const TEST_WORDS = [
  // Plurals
  'books', 'children', 'people', 'countries', 'cities', 'companies', 'families', 'stories',
  'activities', 'opportunities', 'difficulties', 'responsibilities', 'possibilities',
  'knives', 'wolves', 'wives', 'leaves', 'thieves',
  
  // Past tense (-ed)
  'walked', 'talked', 'worked', 'played', 'studied', 'tried', 'carried', 'worried',
  'stopped', 'planned', 'preferred', 'admitted', 'committed',
  'went', 'took', 'made', 'said', 'came', 'saw', 'thought',
  
  // Present continuous (-ing)
  'walking', 'talking', 'working', 'playing', 'studying', 'trying', 'carrying', 'worrying',
  'stopping', 'planning', 'running', 'beginning', 'sitting',
  'going', 'taking', 'making', 'saying', 'coming', 'seeing', 'thinking',
  
  // Third person singular (-s/-es)
  'walks', 'talks', 'works', 'plays', 'studies', 'tries', 'carries', 'worries',
  'goes', 'does', 'has', 'is', 'watches', 'teaches', 'pushes', 'fixes',
  
  // Comparative/superlative
  'bigger', 'biggest', 'faster', 'fastest', 'easier', 'easiest', 'happier', 'happiest',
  'better', 'best', 'worse', 'worst', 'more', 'most',
  
  // Possessive
  "book's", "children's", "people's", "country's", "city's", "company's",
  
  // Adverbs (-ly)
  'quickly', 'slowly', 'carefully', 'happily', 'easily', 'certainly', 'probably',
  
  // Other common inflections
  'unable', 'unhappy', 'unknown', 'unnecessary', 'informal', 'impossible',
  'reaction', 'action', 'creation', 'decision', 'vision'
]

console.log(`📊 Word Standardization Research\n`)
console.log(`Testing ${TEST_WORDS.length} inflected words\n`)

// ============= Dictionary Lookup =============

async function lookupWord(mdx, word) {
  try {
    const result = await mdx.lookup(word)
    return result && result.definition ? true : false
  } catch (err) {
    return false
  }
}

async function lookupWords(mdx, words) {
  const results = []
  for (const word of words) {
    const found = await lookupWord(mdx, word)
    results.push({ word, found })
  }
  return results
}

// ============= Lemmatization Libraries =============

async function testNatural(words) {
  console.log('\n📦 Testing: natural (Porter Stemmer)')
  console.log('   Installing: npm install natural')
  
  try {
    // Dynamic import to handle missing dependency
    const { PorterStemmer } = await import('natural')
    
    const stemmed = words.map(word => ({
      original: word,
      stemmed: PorterStemmer.stem(word)
    }))
    
    return { success: true, results: stemmed }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function testWinkLemmatizer(words) {
  try {
    const module = await import('wink-lemmatizer')
    const lemmatize = module.default
    
    const lemmatized = words.map(word => {
      // Remove possessive 's first
      const cleaned = word.replace(/'s$/, '').toLowerCase()
      
      // Try all forms and pick the shortest (most likely to be base form)
      const candidates = [
        lemmatize.noun(cleaned),
        lemmatize.verb(cleaned),
        lemmatize.adjective(cleaned)
      ].filter(w => w !== cleaned) // Only consider if it changed
      
      const result = candidates.length > 0 
        ? candidates.reduce((a, b) => a.length <= b.length ? a : b)
        : cleaned
      
      return {
        original: word,
        lemmatized: result
      }
    })
    
    return { success: true, results: lemmatized }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function testCompromise(words) {
  console.log('\n📦 Testing: compromise')
  console.log('   Installing: npm install compromise')
  
  try {
    const nlp = await import('compromise')
    
    const normalized = words.map(word => {
      const doc = nlp.default(word)
      return {
        original: word,
        root: doc.verbs().toInfinitive().text() || 
              doc.nouns().toSingular().text() ||
              doc.adjectives().toRoot().text() ||
              word
      }
    })
    
    return { success: true, results: normalized }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ============= Simple Rule-Based Standardizer =============

function simpleStandardize(word) {
  // Remove possessive 's
  let result = word.replace(/'s$/i, '')
  
  // Common irregular verbs
  const irregulars = {
    'went': 'go', 'gone': 'go', 'going': 'go',
    'took': 'take', 'taken': 'take', 'taking': 'take',
    'made': 'make', 'making': 'make',
    'said': 'say', 'saying': 'say',
    'came': 'come', 'coming': 'come',
    'saw': 'see', 'seen': 'see', 'seeing': 'see',
    'thought': 'think', 'thinking': 'think',
    'was': 'be', 'were': 'be', 'been': 'be', 'being': 'be', 'is': 'be',
    'had': 'have', 'has': 'have', 'having': 'have',
    'did': 'do', 'done': 'do', 'does': 'do', 'doing': 'do',
    'better': 'good', 'best': 'good',
    'worse': 'bad', 'worst': 'bad',
    'more': 'many', 'most': 'many',
    'children': 'child', 'people': 'person'
  }
  
  if (irregulars[result.toLowerCase()]) {
    return irregulars[result.toLowerCase()]
  }
  
  // Regular patterns (simple rules)
  // -ies -> -y
  result = result.replace(/ies$/i, 'y')
  // -ves -> -f/-fe
  result = result.replace(/ves$/i, 'f')
  // -es (after s, x, z, ch, sh)
  result = result.replace(/(s|x|z|ch|sh)es$/i, '$1')
  // -s (plural)
  result = result.replace(/s$/i, '')
  // -ed
  result = result.replace(/ed$/i, '')
  // -ing
  result = result.replace(/ing$/i, '')
  // -er/-est (double consonant)
  result = result.replace(/([^aeiou])\1er$/i, '$1')
  result = result.replace(/([^aeiou])\1est$/i, '$1')
  // -er/-est
  result = result.replace(/er$/i, '')
  result = result.replace(/est$/i, '')
  // -ly
  result = result.replace(/ly$/i, '')
  
  return result
}

// ============= Main Test =============

async function runTest() {
  // Dictionary paths
  const eceFile = path.join(__dirname, '../../server/lib/collins/Collins-Advanced-ECE.mdx')
  const collins2015File = path.join(__dirname, '../../server/lib/collins/Collins English Dictionary and Thesaurus, 2015.mdx')
  
  console.log('📖 Loading dictionaries...')
  
  const ece = new MDX(eceFile)
  const collins2015 = new MDX(collins2015File)
  
  console.log('✅ ECE loaded')
  console.log('✅ Collins 2015 loaded\n')
  
  // Test 1: Direct lookup
  console.log('🔍 Test 1: Direct lookup (no standardization)')
  console.log('─'.repeat(60))
  
  const eceDirectResults = await lookupWords(ece, TEST_WORDS)
  const collins2015DirectResults = await lookupWords(collins2015, TEST_WORDS)
  
  const eceDirectFound = eceDirectResults.filter(r => r.found).length
  const collins2015DirectFound = collins2015DirectResults.filter(r => r.found).length
  
  console.log(`ECE:          ${eceDirectFound}/${TEST_WORDS.length} found (${(eceDirectFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  console.log(`Collins 2015: ${collins2015DirectFound}/${TEST_WORDS.length} found (${(collins2015DirectFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  
  // Test 2: Simple rule-based standardization
  console.log('\n🔍 Test 2: Simple rule-based standardization')
  console.log('─'.repeat(60))
  
  const simpleStandardized = TEST_WORDS.map(word => ({
    original: word,
    standardized: simpleStandardize(word)
  }))
  
  console.log('\nSample standardizations:')
  simpleStandardized.slice(0, 10).forEach(({ original, standardized }) => {
    console.log(`  ${original} → ${standardized}`)
  })
  
  const simpleStandardizedWords = simpleStandardized.map(s => s.standardized)
  const eceSimpleResults = await lookupWords(ece, simpleStandardizedWords)
  const collins2015SimpleResults = await lookupWords(collins2015, simpleStandardizedWords)
  
  const eceSimpleFound = eceSimpleResults.filter(r => r.found).length
  const collins2015SimpleFound = collins2015SimpleResults.filter(r => r.found).length
  
  console.log(`\nECE:          ${eceSimpleFound}/${TEST_WORDS.length} found (${(eceSimpleFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  console.log(`Collins 2015: ${collins2015SimpleFound}/${TEST_WORDS.length} found (${(collins2015SimpleFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  console.log(`Improvement:  ECE +${eceSimpleFound - eceDirectFound}, Collins +${collins2015SimpleFound - collins2015DirectFound}`)
  
  // Test 3: wink-lemmatizer
  console.log('\n🔍 Test 3: wink-lemmatizer (proper lemmatization)')
  console.log('─'.repeat(60))
  
  const winkResult = await testWinkLemmatizer(TEST_WORDS)
  
  if (winkResult.success) {
    console.log('\nSample lemmatizations:')
    winkResult.results.slice(0, 10).forEach(({ original, lemmatized }) => {
      console.log(`  ${original} → ${lemmatized}`)
    })
    
    const winkWords = winkResult.results.map(r => r.lemmatized)
    const eceWinkResults = await lookupWords(ece, winkWords)
    const collins2015WinkResults = await lookupWords(collins2015, winkWords)
    
    const eceWinkFound = eceWinkResults.filter(r => r.found).length
    const collins2015WinkFound = collins2015WinkResults.filter(r => r.found).length
    
    console.log(`\nECE:          ${eceWinkFound}/${TEST_WORDS.length} found (${(eceWinkFound/TEST_WORDS.length*100).toFixed(1)}%)`)
    console.log(`Collins 2015: ${collins2015WinkFound}/${TEST_WORDS.length} found (${(collins2015WinkFound/TEST_WORDS.length*100).toFixed(1)}%)`)
    console.log(`Improvement:  ECE +${eceWinkFound - eceDirectFound}, Collins +${collins2015WinkFound - collins2015DirectFound}`)
  } else {
    console.log(`❌ Failed to load wink-lemmatizer: ${winkResult.error}`)
  }
  
  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 SUMMARY')
  console.log('='.repeat(60))
  console.log(`\nDirect lookup:`)
  console.log(`  ECE:          ${eceDirectFound}/${TEST_WORDS.length} (${(eceDirectFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  console.log(`  Collins 2015: ${collins2015DirectFound}/${TEST_WORDS.length} (${(collins2015DirectFound/TEST_WORDS.length*100).toFixed(1)}%)`)
  console.log(`\nSimple standardization:`)
  console.log(`  ECE:          ${eceSimpleFound}/${TEST_WORDS.length} (${(eceSimpleFound/TEST_WORDS.length*100).toFixed(1)}%) [+${eceSimpleFound - eceDirectFound}]`)
  console.log(`  Collins 2015: ${collins2015SimpleFound}/${TEST_WORDS.length} (${(collins2015SimpleFound/TEST_WORDS.length*100).toFixed(1)}%) [+${collins2015SimpleFound - collins2015DirectFound}]`)
  
  if (winkResult.success) {
    const winkWords = winkResult.results.map(r => r.lemmatized)
    const eceWinkResults = await lookupWords(ece, winkWords)
    const collins2015WinkResults = await lookupWords(collins2015, winkWords)
    const eceWinkFound = eceWinkResults.filter(r => r.found).length
    const collins2015WinkFound = collins2015WinkResults.filter(r => r.found).length
    
    console.log(`\nwink-lemmatizer:`)
    console.log(`  ECE:          ${eceWinkFound}/${TEST_WORDS.length} (${(eceWinkFound/TEST_WORDS.length*100).toFixed(1)}%) [+${eceWinkFound - eceDirectFound}]`)
    console.log(`  Collins 2015: ${collins2015WinkFound}/${TEST_WORDS.length} (${(collins2015WinkFound/TEST_WORDS.length*100).toFixed(1)}%) [+${collins2015WinkFound - collins2015DirectFound}]`)
  }
  
  // Detailed analysis
  console.log('\n📋 Detailed breakdown by category:')
  analyzeByCategory(eceDirectResults, collins2015DirectResults, eceSimpleResults, collins2015SimpleResults, simpleStandardized)
}

function analyzeByCategory(eceDir, col2015Dir, eceSimple, col2015Simple, standardized) {
  const categories = [
    { name: 'Plurals', words: TEST_WORDS.slice(0, 18) },
    { name: 'Past tense (-ed)', words: TEST_WORDS.slice(18, 38) },
    { name: 'Present continuous (-ing)', words: TEST_WORDS.slice(38, 58) },
    { name: 'Third person (-s/-es)', words: TEST_WORDS.slice(58, 74) },
    { name: 'Comparative/superlative', words: TEST_WORDS.slice(74, 88) },
    { name: 'Possessive', words: TEST_WORDS.slice(88, 94) },
    { name: 'Adverbs (-ly)', words: TEST_WORDS.slice(94, 101) },
    { name: 'Other', words: TEST_WORDS.slice(101) }
  ]
  
  categories.forEach(cat => {
    const indices = cat.words.map(w => TEST_WORDS.indexOf(w))
    
    const eceDirFound = indices.filter(i => eceDir[i]?.found).length
    const col2015DirFound = indices.filter(i => col2015Dir[i]?.found).length
    const eceSimpleFound = indices.filter(i => eceSimple[i]?.found).length
    const col2015SimpleFound = indices.filter(i => col2015Simple[i]?.found).length
    
    console.log(`\n${cat.name} (${cat.words.length} words):`)
    console.log(`  ECE:          ${eceDirFound} → ${eceSimpleFound} (+${eceSimpleFound - eceDirFound})`)
    console.log(`  Collins 2015: ${col2015DirFound} → ${col2015SimpleFound} (+${col2015SimpleFound - col2015DirFound})`)
    
    // Show examples of failures
    const failures = indices.filter(i => !eceSimple[i]?.found && !col2015Simple[i]?.found)
    if (failures.length > 0 && failures.length <= 3) {
      console.log(`  Still not found: ${failures.map(i => `${TEST_WORDS[i]} → ${standardized[i].standardized}`).join(', ')}`)
    }
  })
}

// Run the test
runTest().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

