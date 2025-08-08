import { lookup, processCollinsHtml } from '../lib/collins/index.js'
import { log } from '../utils/logger.js'

const testWords = [
  'would',
  'apple',
  'nonexistentwordxyz'
]

const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

const containsNoUsageNote = (html) => !/Usage\s*Note/gi.test(html || '')
// Ensure the top star rating line doesn't include the headword itself
const containsNoHeadwordDup = (html, word) => !new RegExp(`${word}\\s*[★☆]`, 'i').test(html || '')

const run = async () => {
  for (const word of testWords) {
    const res = lookup(word)
    const { source, definitionHtml } = res
    const found = !!definitionHtml

    log.info({ word, source, found, length: (definitionHtml || '').length }, 'Dict lookup test')

    if (word === 'nonexistentwordxyz') {
      assert(!found, 'Expected not found for nonexistent word')
      continue
    }

    assert(found, `Expected definition for ${word}`)
    assert(containsNoUsageNote(definitionHtml), 'Should remove "Usage Note" label')
    assert(containsNoHeadwordDup(definitionHtml, word), 'Should remove duplicated headword line')
    // Verify bracket replacement utility behavior
    const sample = processCollinsHtml(word, '【Test】')
    assert(sample.includes('<b>Test</b>'), 'Should replace full-width brackets with <b>')
  }

  console.log('OK: dict module tests passed')
}

run().catch((e) => {
  console.error('DICT TEST FAILED:', e.message)
  process.exit(1)
})


