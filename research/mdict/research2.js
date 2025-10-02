import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import * as cheerio from 'cheerio'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.join(__dirname, '1')

console.log('🔬 Starting HTML Structure Analysis...\n')

// Get all dictionary directories
const dictDirs = fs.readdirSync(OUTPUT_DIR)
  .filter(d => {
    const fullPath = path.join(OUTPUT_DIR, d)
    return fs.statSync(fullPath).isDirectory() && d !== 'mdd' && d !== 'mdx'
  })

console.log(`Found ${dictDirs.length} dictionaries to analyze\n`)

const analysis = {}

// Analyze each dictionary
for (const dictName of dictDirs) {
  console.log('━'.repeat(80))
  console.log(`📖 Analyzing: ${dictName}`)
  console.log('━'.repeat(80))
  
  const mdxDir = path.join(OUTPUT_DIR, dictName, 'mdx')
  const htmlFiles = fs.readdirSync(mdxDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('_'))
    .slice(0, 20) // Analyze first 20 samples
  
  console.log(`Analyzing ${htmlFiles.length} sample files...\n`)
  
  const dictAnalysis = {
    name: dictName,
    samples: [],
    commonClasses: new Set(),
    commonTags: new Map(),
    structures: [],
    hasChinese: false,
    hasExamples: false,
    hasPronunciation: false,
    hasPartOfSpeech: false
  }
  
  for (const htmlFile of htmlFiles) {
    const filePath = path.join(mdxDir, htmlFile)
    const html = fs.readFileSync(filePath, 'utf8')
    const $ = cheerio.load(html)
    
    const sample = {
      file: htmlFile,
      word: '',
      structure: {},
      classes: new Set(),
      tags: new Set(),
      textLength: $.text().length,
      hasChinese: /[\u4e00-\u9fa5]/.test(html),
      rawHTML: html.substring(0, 200) + '...'
    }
    
    // Extract word/headword
    const headwordSelectors = [
      'font[color="purple"]',
      '.f9d',
      '.dict_title',
      'b:first',
      'div:first'
    ]
    
    for (const selector of headwordSelectors) {
      const el = $(selector).first()
      if (el.length && el.text().trim()) {
        sample.word = el.text().trim()
        break
      }
    }
    
    // Collect all classes
    $('[class]').each((_, el) => {
      const classes = $(el).attr('class').split(/\s+/)
      classes.forEach(c => {
        if (c) {
          sample.classes.add(c)
          dictAnalysis.commonClasses.add(c)
        }
      })
    })
    
    // Collect all tags
    $('*').each((_, el) => {
      const tag = el.tagName
      sample.tags.add(tag)
      dictAnalysis.commonTags.set(tag, (dictAnalysis.commonTags.get(tag) || 0) + 1)
    })
    
    // Check for specific patterns
    if (/[\u4e00-\u9fa5]/.test(html)) {
      dictAnalysis.hasChinese = true
    }
    
    if ($('.caption, .collins_en_cn li, ul li, .iji').length > 0) {
      dictAnalysis.hasExamples = true
    }
    
    if ($('.prons, .eg, .us, [class*="phon"]').length > 0) {
      dictAnalysis.hasPronunciation = true
    }
    
    if ($('.st, .sg0, [class*="pos"], .jgs').length > 0) {
      dictAnalysis.hasPartOfSpeech = true
    }
    
    // Analyze structure depth (simple count of nested divs)
    let maxDepth = 0
    $('*').each((_, el) => {
      let depth = 0
      let current = el
      while (current.parent) {
        depth++
        current = current.parent
        if (depth > 50) break // Safety limit
      }
      maxDepth = Math.max(maxDepth, depth)
    })
    sample.structure.depth = maxDepth
    sample.structure.topLevelClasses = []
    
    $.root().children().each((_, el) => {
      const classes = $(el).attr('class')
      if (classes) {
        sample.structure.topLevelClasses.push(classes.split(/\s+/)[0])
      }
    })
    
    dictAnalysis.samples.push({
      file: sample.file,
      word: sample.word,
      classes: Array.from(sample.classes).slice(0, 10),
      depth: sample.structure.depth,
      textLength: sample.textLength,
      hasChinese: sample.hasChinese
    })
  }
  
  analysis[dictName] = {
    name: dictName,
    samplesAnalyzed: dictAnalysis.samples.length,
    commonClasses: Array.from(dictAnalysis.commonClasses).sort(),
    topTags: Array.from(dictAnalysis.commonTags.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
    features: {
      hasChinese: dictAnalysis.hasChinese,
      hasExamples: dictAnalysis.hasExamples,
      hasPronunciation: dictAnalysis.hasPronunciation,
      hasPartOfSpeech: dictAnalysis.hasPartOfSpeech
    },
    sampleWords: dictAnalysis.samples.slice(0, 5).map(s => ({
      word: s.word,
      hasChinese: s.hasChinese
    }))
  }
  
  console.log(`✅ Analyzed ${dictAnalysis.samples.length} samples`)
  console.log(`   Common classes: ${Array.from(dictAnalysis.commonClasses).length}`)
  console.log(`   Features: ${JSON.stringify(dictAnalysis.features, null, 2)}`)
  console.log()
}


// ============= Generate Report =============
console.log('\n')
console.log('━'.repeat(80))
console.log('📊 STRUCTURAL ANALYSIS REPORT')
console.log('━'.repeat(80))
console.log()

for (const [dictName, data] of Object.entries(analysis)) {
  console.log(`📖 ${data.name}`)
  console.log(`   Samples: ${data.samplesAnalyzed}`)
  console.log(`   Unique classes: ${data.commonClasses.length}`)
  console.log(`   Features:`)
  console.log(`     - Chinese translations: ${data.features.hasChinese ? '✓' : '✗'}`)
  console.log(`     - Examples: ${data.features.hasExamples ? '✓' : '✗'}`)
  console.log(`     - Pronunciation: ${data.features.hasPronunciation ? '✓' : '✗'}`)
  console.log(`     - Part of speech: ${data.features.hasPartOfSpeech ? '✓' : '✗'}`)
  console.log(`   Sample words: ${data.sampleWords.map(w => w.word).join(', ')}`)
  console.log(`   Top classes: ${data.commonClasses.slice(0, 10).join(', ')}`)
  console.log()
}

// ============= Unified Structure Proposal =============
console.log('━'.repeat(80))
console.log('🎯 UNIFIED JSON STRUCTURE PROPOSAL')
console.log('━'.repeat(80))
console.log()

const unifiedStructure = {
  word: 'string',
  source: 'string (dict name)',
  pronunciations: [
    {
      type: 'BrE | AmE | IPA',
      value: 'string',
      audio: 'string (optional)'
    }
  ],
  entries: [
    {
      partOfSpeech: 'string (noun, verb, suffix, etc)',
      definitions: [
        {
          definition: 'string',
          chinese: 'string (optional)',
          examples: [
            {
              english: 'string',
              chinese: 'string (optional)'
            }
          ],
          labels: ['string (e.g., informal, medical, etc)']
        }
      ]
    }
  ],
  etymology: 'string (optional)',
  usage: 'string (optional)',
  synonyms: ['string'],
  derivedForms: ['string'],
  rawHTML: 'string (for fallback)'
}

console.log(JSON.stringify(unifiedStructure, null, 2))
console.log()

// ============= Commonalities and Differences =============
console.log('━'.repeat(80))
console.log('🔍 COMMONALITIES & DIFFERENCES')
console.log('━'.repeat(80))
console.log()

// Find shared classes across all dictionaries
const allClasses = Object.values(analysis).map(d => new Set(d.commonClasses))
const sharedClasses = [...allClasses[0]].filter(c =>
  allClasses.every(set => set.has(c))
)

console.log(`Shared CSS classes across ALL dictionaries: ${sharedClasses.length}`)
if (sharedClasses.length > 0) {
  console.log(`  ${sharedClasses.join(', ')}`)
} else {
  console.log('  (None - each dictionary uses unique class names)')
}
console.log()

// Group by features
const withChinese = Object.values(analysis).filter(d => d.features.hasChinese)
const withoutChinese = Object.values(analysis).filter(d => !d.features.hasChinese)

console.log(`Dictionaries with Chinese translations: ${withChinese.length}`)
withChinese.forEach(d => console.log(`  - ${d.name}`))
console.log()

console.log(`Dictionaries without Chinese translations: ${withoutChinese.length}`)
withoutChinese.forEach(d => console.log(`  - ${d.name}`))
console.log()

// ============= Conclusion =============
console.log('━'.repeat(80))
console.log('💡 CONCLUSION')
console.log('━'.repeat(80))
console.log()
console.log('1. Each dictionary uses DIFFERENT CSS class names')
console.log('   → Cannot rely on classes for unified parsing')
console.log()
console.log('2. Structure varies significantly:')
console.log('   - Collins-Advanced-ECE/EE: Chinese + English, structured with classes')
console.log('   - Collins 2015: Pure English, different class system')
console.log('   - Collins-Usage: Simple paragraph structure')
console.log('   - Collins-Thesaurus: Specialized format')
console.log()
console.log('3. Recommendation for JSON conversion:')
console.log('   ✓ Keep raw HTML as fallback')
console.log('   ✓ Extract basic fields (word, POS, definitions) with heuristics')
console.log('   ✓ Dictionary-specific parsers for detailed extraction')
console.log('   ✓ Store Chinese translations separately when available')
console.log()
console.log('4. Best approach:')
console.log('   → Use current HTML-based approach')
console.log('   → Apply CSS cleanup/normalization at display time')
console.log('   → Consider structured extraction only for specific use cases')
console.log('      (e.g., word list generation, pronunciation index)')
console.log()

console.log('━'.repeat(80))
console.log('✅ Analysis complete!\n')

// Save detailed analysis to JSON
const reportPath = path.join(OUTPUT_DIR, '_structure_analysis.json')
fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2), 'utf8')
console.log(`📄 Detailed analysis saved to: ${reportPath}\n`)

