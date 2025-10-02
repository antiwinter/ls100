#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Analyze MDX structure to understand usage notes and nested examples
 */

import { MDX } from 'js-mdict'
import * as cheerio from 'cheerio'

const mdxPath = '/Users/warits/code/ls100/server/lib/collins/Collins-Advanced-ECE.mdx'

console.log('🔍 Analyzing MDX structure...\n')

const mdx = new MDX(mdxPath)
const keywordList = mdx.keywordList || []

const stats = {
  total: keywordList.length,
  withEnTip: 0,
  withVEnTip: 0,
  withBgDoc: 0,
  enTipWithExamples: 0,
  enTipExampleSamples: [],
  vEnTipSamples: []
}

// Sample every Nth entry for speed
const sampleRate = 10
for (let i = 0; i < keywordList.length; i += sampleRate) {
  const word = keywordList[i].keyText
  const result = mdx.lookup(word)
  if (!result || !result.definition) continue
  
  const html = result.definition
  
  // Check for en_tip (usage notes as list items)
  if (html.includes('en_tip')) {
    stats.withEnTip++
    
    // Check if it has nested examples
    const $ = cheerio.load(html)
    $('li.en_tip').each((idx, el) => {
      const nestedUl = $(el).find('ul.vli')
      if (nestedUl.length > 0) {
        const nestedExamples = nestedUl.find('li').length
        if (nestedExamples > 0) {
          stats.enTipWithExamples++
          if (stats.enTipExampleSamples.length < 5) {
            stats.enTipExampleSamples.push({
              word,
              nestedCount: nestedExamples,
              html: $(el).html().substring(0, 300)
            })
          }
        }
      }
    })
  }
  
  // Check for vEn_tip (usage notes as divs)
  if (html.includes('vEn_tip')) {
    stats.withVEnTip++
    if (stats.vEnTipSamples.length < 5) {
      const $ = cheerio.load(html)
      const sample = $('div.vEn_tip').first().html()
      if (sample) {
        stats.vEnTipSamples.push({
          word,
          html: sample.substring(0, 300)
        })
      }
    }
  }
  
  // Check for bg_doc (another usage note variant)
  if (html.includes('bg_doc')) {
    stats.withBgDoc++
  }
}

// Extrapolate to full dataset
const multiplier = sampleRate
console.log('📊 Analysis Results (sampled every ' + sampleRate + ' entries):\n')
console.log('Total entries:', stats.total)
console.log('Estimated with en_tip:', stats.withEnTip * multiplier, `(${((stats.withEnTip * multiplier / stats.total) * 100).toFixed(1)}%)`)
console.log('Estimated with vEn_tip:', stats.withVEnTip * multiplier, `(${((stats.withVEnTip * multiplier / stats.total) * 100).toFixed(1)}%)`)
console.log('Estimated with bg_doc:', stats.withBgDoc * multiplier, `(${((stats.withBgDoc * multiplier / stats.total) * 100).toFixed(1)}%)`)
console.log('en_tip entries with nested examples:', stats.enTipWithExamples * multiplier)
console.log()

console.log('📝 Sample en_tip with nested examples:')
stats.enTipExampleSamples.forEach((sample, idx) => {
  console.log(`\n${idx + 1}. ${sample.word} (${sample.nestedCount} nested examples)`)
  console.log('   HTML:', sample.html.replace(/\n/g, ' ').substring(0, 200) + '...')
})

console.log('\n📝 Sample vEn_tip structures:')
stats.vEnTipSamples.forEach((sample, idx) => {
  console.log(`\n${idx + 1}. ${sample.word}`)
  console.log('   HTML:', sample.html.replace(/\n/g, ' ').substring(0, 200) + '...')
})

