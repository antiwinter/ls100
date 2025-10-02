import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'
import { MDX } from 'js-mdict'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MDX_FILE = path.join(__dirname, 'Collins-Advanced-ECE.mdx')

console.log('🔍 Analyzing Collins-Advanced-ECE Structure Patterns...\n')

// Load MDX file
console.log('📖 Loading MDX file...')
const mdx = new MDX(MDX_FILE)
console.log('✅ MDX loaded\n')

const keywordList = mdx.keywordList || []
const SAMPLE_SIZE = 1000
const entriesToProcess = keywordList.slice(0, SAMPLE_SIZE)

console.log(`Analyzing ${entriesToProcess.length} entries...\n`)

const structureTypes = {
  standard: { count: 0, examples: [] },
  noCaptions: { count: 0, examples: [] },
  noExamples: { count: 0, examples: [] },
  nested: { count: 0, examples: [] },
  plainText: { count: 0, examples: [] },
  unknown: { count: 0, examples: [] }
}

const parseIssues = []

for (let i = 0; i < entriesToProcess.length; i++) {
  const keywordItem = entriesToProcess[i]
  const word = keywordItem.keyText
  
  try {
    const result = mdx.lookup(word)
    if (!result || !result.definition) continue
    
    const html = result.definition
    const analysis = analyzeStructure(html, word)
    
    // Classify structure type
    const type = analysis.structureType
    structureTypes[type].count++
    
    // Save first 3 examples of each type
    if (structureTypes[type].examples.length < 3) {
      structureTypes[type].examples.push({
        word,
        details: analysis,
        htmlPreview: html.substring(0, 500)
      })
    }
    
    // Record parsing issues
    if (analysis.issues.length > 0) {
      parseIssues.push({
        word,
        issues: analysis.issues,
        structureType: type
      })
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`  Analyzed ${i + 1}/${entriesToProcess.length} entries`)
    }
  } catch (error) {
    console.warn(`  ⚠️  Error analyzing "${word}": ${error.message}`)
  }
}

// ============= Report =============
console.log('\n')
console.log('━'.repeat(80))
console.log('📊 STRUCTURE TYPE DISTRIBUTION')
console.log('━'.repeat(80))
console.log()

const sortedTypes = Object.entries(structureTypes)
  .sort((a, b) => b[1].count - a[1].count)

for (const [type, data] of sortedTypes) {
  const percentage = (data.count / SAMPLE_SIZE * 100).toFixed(1)
  console.log(`${type.toUpperCase()}: ${data.count} (${percentage}%)`)
}
console.log()

// Show examples for each structure type
console.log('━'.repeat(80))
console.log('📝 STRUCTURE EXAMPLES')
console.log('━'.repeat(80))
console.log()

for (const [type, data] of sortedTypes) {
  if (data.count === 0) continue
  
  console.log(`\n▶ ${type.toUpperCase()} (${data.count} entries)`)
  console.log('─'.repeat(80))
  
  for (let i = 0; i < data.examples.length; i++) {
    const ex = data.examples[i]
    console.log(`\n  Example ${i + 1}: "${ex.word}"`)
    console.log(`  Details:`)
    console.log(`    - Has .caption: ${ex.details.hasCaptions}`)
    console.log(`    - Caption count: ${ex.details.captionCount}`)
    console.log(`    - Has <ul>: ${ex.details.hasUl}`)
    console.log(`    - Has .collins_en_cn: ${ex.details.hasCollinsEnCn}`)
    console.log(`    - Has <p> tags: ${ex.details.hasParagraphs}`)
    console.log(`    - Text-only: ${ex.details.isTextOnly}`)
    
    if (ex.details.issues.length > 0) {
      console.log(`    - Issues: ${ex.details.issues.join(', ')}`)
    }
    
    console.log(`  HTML Preview:`)
    console.log(`    ${ex.htmlPreview.substring(0, 200).replace(/\n/g, ' ')}...`)
  }
}

// Report parsing issues
console.log('\n')
console.log('━'.repeat(80))
console.log('⚠️  PARSING ISSUES SUMMARY')
console.log('━'.repeat(80))
console.log()

if (parseIssues.length === 0) {
  console.log('✅ No parsing issues detected!')
} else {
  console.log(`Found ${parseIssues.length} entries with potential issues:\n`)
  
  // Group issues by type
  const issuesByType = {}
  for (const item of parseIssues) {
    for (const issue of item.issues) {
      if (!issuesByType[issue]) {
        issuesByType[issue] = []
      }
      issuesByType[issue].push(item.word)
    }
  }
  
  for (const [issue, words] of Object.entries(issuesByType)) {
    console.log(`${issue}: ${words.length} entries`)
    console.log(`  Examples: ${words.slice(0, 5).join(', ')}`)
    console.log()
  }
}

// Recommendations
console.log('━'.repeat(80))
console.log('💡 RECOMMENDATIONS')
console.log('━'.repeat(80))
console.log()

if (structureTypes.standard.count > SAMPLE_SIZE * 0.9) {
  console.log('✅ Structure is highly consistent (>90% standard)')
  console.log('   → Current parser should work well')
} else {
  console.log('⚠️  Structure has variations')
  console.log(`   → Standard: ${structureTypes.standard.count}/${SAMPLE_SIZE}`)
  console.log('   → Need to handle additional patterns:')
  
  for (const [type, data] of sortedTypes) {
    if (type !== 'standard' && data.count > 0) {
      console.log(`     - ${type}: ${data.count} entries`)
    }
  }
}
console.log()

// ============= Analysis Function =============
function analyzeStructure(html, word) {
  const $ = cheerio.load(html)
  
  const analysis = {
    word,
    structureType: 'unknown',
    issues: [],
    
    // Structure indicators
    hasCaptions: false,
    captionCount: 0,
    hasUl: false,
    ulCount: 0,
    hasCollinsEnCn: false,
    hasParagraphs: false,
    paragraphCount: 0,
    isTextOnly: false,
    
    // Content indicators
    hasPartOfSpeech: false,
    hasChinese: false,
    hasEnglish: false,
    hasExamples: false,
    exampleCount: 0,
    
    // Nested/complex indicators
    hasNestedDivs: false,
    divDepth: 0,
    hasNestedCaptions: false
  }
  
  // Check for key elements
  const captions = $('.caption')
  analysis.hasCaptions = captions.length > 0
  analysis.captionCount = captions.length
  
  const uls = $('ul')
  analysis.hasUl = uls.length > 0
  analysis.ulCount = uls.length
  
  analysis.hasCollinsEnCn = $('.collins_en_cn').length > 0
  
  const paragraphs = $('p')
  analysis.hasParagraphs = paragraphs.length > 0
  analysis.paragraphCount = paragraphs.length
  
  // Check if it's mostly plain text
  const divs = $('div')
  const totalText = $.text().trim()
  analysis.isTextOnly = divs.length < 3 && totalText.length > 0
  
  // Check for Chinese characters
  analysis.hasChinese = /[\u4e00-\u9fa5]/.test(html)
  
  // Check for part of speech
  analysis.hasPartOfSpeech = $('.st').length > 0
  
  // Count examples (li elements in ul)
  $('ul li').each((_, liEl) => {
    const pCount = $(liEl).find('p').length
    if (pCount >= 1) {
      analysis.exampleCount++
    }
  })
  analysis.hasExamples = analysis.exampleCount > 0
  
  // Calculate div depth
  let maxDepth = 0
  $('div').each((_, el) => {
    let depth = 0
    let current = el
    while (current.parent) {
      if (current.parent.tagName === 'div') depth++
      current = current.parent
      if (depth > 20) break
    }
    maxDepth = Math.max(maxDepth, depth)
  })
  analysis.divDepth = maxDepth
  analysis.hasNestedDivs = maxDepth > 4
  
  // Check for nested captions (unusual)
  $('.caption .caption').each(() => {
    analysis.hasNestedCaptions = true
  })
  
  // Classify structure type
  if (analysis.hasCaptions && analysis.hasUl && analysis.hasCollinsEnCn) {
    // Standard structure: .collins_en_cn > .caption + ul
    if (analysis.captionCount === analysis.ulCount) {
      analysis.structureType = 'standard'
    } else if (analysis.captionCount > analysis.ulCount) {
      analysis.structureType = 'noExamples'
      analysis.issues.push('more captions than example lists')
    } else {
      analysis.structureType = 'nested'
      analysis.issues.push('more example lists than captions')
    }
  } else if (analysis.hasCaptions && !analysis.hasUl) {
    // Has structure but no examples
    analysis.structureType = 'noExamples'
    analysis.issues.push('has .caption but no <ul> examples')
  } else if (!analysis.hasCaptions && analysis.hasCollinsEnCn) {
    // Has content div but no caption structure
    analysis.structureType = 'noCaptions'
    analysis.issues.push('has .collins_en_cn but no .caption')
  } else if (analysis.isTextOnly) {
    // Plain text or minimal HTML
    analysis.structureType = 'plainText'
    analysis.issues.push('minimal HTML structure')
  } else {
    // Unknown/unusual structure
    analysis.structureType = 'unknown'
    analysis.issues.push('unusual HTML structure')
  }
  
  // Additional issue detection
  if (analysis.hasNestedCaptions) {
    analysis.issues.push('nested .caption elements')
  }
  
  if (!analysis.hasChinese && analysis.structureType !== 'plainText') {
    analysis.issues.push('no Chinese text found')
  }
  
  if (analysis.captionCount > 5) {
    analysis.issues.push('many definitions (>5)')
  }
  
  return analysis
}

console.log('✅ Analysis complete!\n')

